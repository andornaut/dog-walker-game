import { describe, expect, it } from "vitest";

import { DEBUFFS } from "../data/debuffs";
import { DOGS } from "../data/dogs";
import { SHOP_GEAR } from "../data/shop";
import { WORLD } from "../data/world";
import { cents } from "../rules/units";
import { newRun, type RunState } from "../state/runState";
import { defined } from "../testing/defined";
import { TEST_TUNING } from "../testing/tuning";
import { checkpointOf, runResultOf } from "./runSlices";

const data = {
  debuffs: DEBUFFS,
  dogs: DOGS,
  shopGear: SHOP_GEAR,
  tuning: TEST_TUNING,
  world: WORLD,
};
const start = newRun(data, 3, { dogs: ["koda", "duchess"], gear: null });
// In zone 3 with 2 zones paid; duchess fired you in zone 2.
const midRun: RunState = {
  ...start,
  money: cents(4_250),
  pack: [defined(start.pack[0]), { dog: "duchess", status: "fired", zoneIndex: 1 }],
  route: ["street", "pawsPromenade", "park"],
  zoneIndex: 2,
};

describe("checkpointOf", () => {
  it("records the zones paid, the money and each dog's zones", () => {
    expect(checkpointOf(data, midRun)).toEqual({
      counters: { bumpsByZone: [], debuffZones: {}, firstZone: 0, squirrelChases: 0 },
      dogs: [
        { fired: false, id: "koda", zonesFinished: 2 },
        { fired: true, id: "duchess", zonesFinished: 1 },
      ],
      earnedCents: 4_250,
      route: ["street", "pawsPromenade", "park"],
      zonesFinished: 2,
    });
  });

  it("copies the run's achievement counters", () => {
    const counted = {
      ...midRun,
      bumpsByZone: [0, 2],
      debuffZones: { stinky: 1 },
      squirrelChases: 3,
    };
    expect(checkpointOf(data, counted).counters).toEqual({
      bumpsByZone: [0, 2],
      debuffZones: { stinky: 1 },
      firstZone: 0,
      squirrelChases: 3,
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
      counters: { bumpsByZone: [], debuffZones: {}, firstZone: 0, squirrelChases: 0 },
      dogs: [
        { fired: false, id: "koda", zonesFinished: 4 },
        { fired: true, id: "duchess", zonesFinished: 1 },
      ],
      earnedCents: 4_250,
      outcome: "finished",
      route: ["street", "pawsPromenade", "park"],
      zone: 4,
    });
  });

  it("ends a run that headed home in the zone it was in", () => {
    const home = { ...midRun, phase: { kind: "ended", reason: "wentHome" } as const };
    expect(runResultOf(data, home)).toMatchObject({ outcome: "wentHome", zone: 3 });
  });

  it("counts a run that has not ended as heading home", () => {
    expect(runResultOf(data, midRun).outcome).toBe("wentHome");
  });
});
