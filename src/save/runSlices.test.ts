import { describe, expect, it } from "vitest";

import { DEBUFFS } from "../data/debuffs";
import { DOGS } from "../data/dogs";
import { ENCOUNTERS } from "../data/encounters";
import { SHOP_GEAR } from "../data/shop";
import { WORLD } from "../data/world";
import { cents, clampHearts } from "../lib/units";
import { newRun, type RunState } from "../state/runState";
import { defined } from "../testing/defined";
import { quietCounters } from "../testing/saves";
import { TEST_TUNING } from "../testing/tuning";
import { TEST_WALKER_DATA } from "../testing/walkers";
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
const start = newRun(data, 3, { dogs: ["kilo", "duchess"], gear: null, walker: "casey" });
// In zone 3 with 2 zones paid; duchess fired you in zone 2.
const midRun: RunState = {
  ...start,
  bankedPay: cents(3_000),
  money: cents(4_250),
  pack: [defined(start.pack[0]), { dog: "duchess", status: "fired", zoneIndex: 1 }],
  route: ["street", "pawsPromenade", "park"],
  zoneIndex: 2,
};

const walking = defined(start.pack[0]);
if (walking.status !== "walking") {
  throw new Error("The run starts with kilo walking");
}

describe("checkpointOf", () => {
  it("records the zones paid, the money and each dog's zones", () => {
    expect(checkpointOf(data, midRun)).toEqual({
      counters: { ...quietCounters(), startCents: start.startMoney },
      dogs: [
        { fired: false, id: "kilo", zonesFinished: 2 },
        { fired: true, id: "duchess", zonesFinished: 1 },
      ],
      earnedCents: 4_250,
      route: ["street", "pawsPromenade", "park"],
      zonesFinished: 2,
    });
  });

  it("copies the run's achievement counters", () => {
    const counted: RunState = {
      ...midRun,
      bumpsByKind: { raccoon: 2 },
      bumpsByZone: [0, 2],
      debuffsGot: { stinky: 1 },
      optionPicks: { capybara: { help: 2 } },
      pack: [
        { ...walking, hearts: clampHearts(5, 1) },
        { dog: "duchess", status: "fired", zoneIndex: 1 },
      ],
      startMoney: cents(500),
      tallies: { squirrelPulls: 3 },
    };
    expect(checkpointOf(data, counted).counters).toEqual({
      bumpsByKind: { raccoon: 2 },
      bumpsByZone: [0, 2],
      debuffsGot: { stinky: 1 },
      firstZone: 0,
      lastHeartOwners: 1,
      optionPicks: { capybara: { help: 2 } },
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
        { fired: false, id: "kilo", zonesFinished: 4 },
        { fired: true, id: "duchess", zonesFinished: 1 },
      ],
      earnedCents: 4_250,
      lostCents: 0,
      outcome: "finished",
      route: ["street", "pawsPromenade", "park"],
      walker: start.walker,
      zone: 4,
    });
  });

  it("ends each slice as heading home, in the zone it was in", () => {
    for (const [, run] of [
      ["a run that headed home", { ...midRun, phase: { kind: "ended", reason: "wentHome" } }],
      ["a run that has not ended", midRun],
    ] satisfies readonly [string, RunState][]) {
      expect(runResultOf(data, run)).toMatchObject({
        earnedCents: 4_250,
        lostCents: 0,
        outcome: "wentHome",
        zone: 3,
      });
    }
  });

  it("banks only the pay of a run every owner fired you out of, losing the cash carried", () => {
    const firedOut: RunState = {
      ...midRun,
      pack: [
        { dog: "kilo", status: "fired", zoneIndex: 2 },
        { dog: "duchess", status: "fired", zoneIndex: 1 },
      ],
      phase: { kind: "ended", reason: "noDogs" },
    };
    expect(runResultOf(data, firedOut)).toMatchObject({
      earnedCents: 3_000,
      lostCents: 1_250,
      outcome: "noDogs",
    });
  });
});
