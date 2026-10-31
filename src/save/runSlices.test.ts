import { describe, expect, it } from "vitest";

import { DEBUFFS } from "../data/debuffs";
import { DOGS } from "../data/dogs";
import { ENCOUNTERS } from "../data/encounters";
import { SHOP_GEAR } from "../data/shop";
import { WORLD } from "../data/world";
import { newRun, type RunState } from "../state/runState";
import { defined } from "../testing/defined";
import { quietCounters } from "../testing/saves";
import { TEST_TUNING } from "../testing/tuning";
import { TEST_WALKER_DATA } from "../testing/walkers";
import { cents, clampHearts } from "../units";
import { checkpointOf, runResultOf } from "./runSlices";

const data = {
  debuffs: DEBUFFS,
  dogs: DOGS,
  encounters: ENCOUNTERS,
  shopGear: SHOP_GEAR,
  ...TEST_WALKER_DATA,
  tuning: TEST_TUNING,
  world: WORLD,
};
const start = newRun(data, 3, { dogs: ["kilo", "ginger"], gear: null, walker: "casey" });
// In zone 3 with 2 zones paid and $12.50 earned since; ginger fired you in zone 2.
const midRun: RunState = {
  ...start,
  money: cents(4_250),
  pack: [defined(start.pack[0]), { dog: "ginger", status: "fired", zoneIndex: 1 }],
  route: ["distilleryDistrict", "theBeaches", "highPark"],
  zoneEndMoney: cents(3_000),
  zoneIndex: 2,
};

const walking = defined(start.pack[0]);
if (walking.status !== "walking") {
  throw new Error("The run starts with kilo walking");
}

describe("checkpointOf", () => {
  it("records the zones paid, the money heading home keeps and the zone each owner fired you in", () => {
    expect(checkpointOf(data, midRun)).toEqual({
      counters: { ...quietCounters(), startCents: start.startMoney },
      dogs: [
        { firedInZone: null, id: "kilo" },
        { firedInZone: 2, id: "ginger" },
      ],
      earnedCents: midRun.zoneEndMoney,
      route: ["distilleryDistrict", "theBeaches", "highPark"],
      zonesFinished: 2,
    });
  });

  it("copies the run's achievement counters", () => {
    const counted: RunState = {
      ...midRun,
      bumpsByKind: { raccoon: 2 },
      bumpsByZone: [0, 2],
      debuffsGot: { stinky: 1 },
      optionPicks: { cheeseCrates: { sniff: 2 } },
      startMoney: cents(500),
      tallies: { squirrelPulls: 3 },
    };
    expect(checkpointOf(data, counted).counters).toEqual({
      bumpsByKind: { raccoon: 2 },
      bumpsByZone: [0, 2],
      debuffsGot: { stinky: 1 },
      firstZone: 0,
      optionPicks: { cheeseCrates: { sniff: 2 } },
      startCents: 500,
      tallies: { squirrelPulls: 3 },
    });
  });

  it("counts every zone once the last one is paid", () => {
    const finished = { ...midRun, phase: { kind: "ended", reason: "finished" } as const };
    expect(checkpointOf(data, finished).zonesFinished).toBe(4);
  });
});

describe("runResultOf", () => {
  it("ends a finished run in its last zone, every walking dog paid for all of them", () => {
    const finished = { ...midRun, phase: { kind: "ended", reason: "finished" } as const };
    expect(runResultOf(data, finished)).toEqual({
      counters: { ...quietCounters(), startCents: start.startMoney },
      dogs: [
        { firedInZone: null, id: "kilo" },
        { firedInZone: 2, id: "ginger" },
      ],
      earnedCents: 4_250,
      lastHeartOwners: 0,
      lostCents: 0,
      outcome: "finished",
      route: ["distilleryDistrict", "theBeaches", "highPark"],
      walker: start.walker,
      zone: 4,
    });
  });

  it("counts the walking owners on their last heart", () => {
    const run: RunState = { ...midRun, pack: [{ ...walking, hearts: clampHearts(5, 1) }] };
    expect([runResultOf(data, midRun), runResultOf(data, run)]).toMatchObject([
      { lastHeartOwners: 0 },
      { lastHeartOwners: 1 },
    ]);
  });

  it("ends each slice as heading home, in the zone it was in", () => {
    for (const [, run] of [
      ["a run that headed home", { ...midRun, phase: { kind: "ended", reason: "wentHome" } }],
      ["a run that has not ended", midRun],
    ] satisfies readonly [string, RunState][]) {
      expect(runResultOf(data, run)).toMatchObject({
        earnedCents: midRun.zoneEndMoney,
        lostCents: midRun.money - midRun.zoneEndMoney,
        outcome: "wentHome",
        zone: 3,
      });
    }
  });

  it("banks the last zone's end money of a run every owner fired you out of, losing the rest", () => {
    const firedOut: RunState = {
      ...midRun,
      pack: [
        { dog: "kilo", status: "fired", zoneIndex: 2 },
        { dog: "ginger", status: "fired", zoneIndex: 1 },
      ],
      phase: { kind: "ended", reason: "noDogs" },
    };
    expect(runResultOf(data, firedOut)).toMatchObject({
      earnedCents: midRun.zoneEndMoney,
      lostCents: midRun.money - midRun.zoneEndMoney,
      outcome: "noDogs",
    });
  });
});
