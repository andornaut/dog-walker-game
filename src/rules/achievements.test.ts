import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import type { AchievementCondition } from "../data/types";
import { newPlayerSave, veteranSave } from "../save/fixtures";
import type { SaveDocument } from "../save/schema";
import { testState } from "../testing/runState";
import {
  conditionHolds,
  countBump,
  countChase,
  countDebuffZones,
  earnedByRun,
  newlyEarned,
  type RunFacts,
} from "./achievements";
import { cents } from "./units";

const facts = (changes: Partial<RunFacts> = {}): RunFacts => ({
  bumpsByZone: [],
  debuffZones: {},
  earnedCents: cents(0),
  firstZone: 0,
  packSize: 1,
  squirrelChases: 0,
  zonesFinished: 0,
  ...changes,
});

const holdsForRun = (condition: AchievementCondition, run: Partial<RunFacts>) =>
  conditionHolds(gameData, newPlayerSave, facts(run), condition);

const holdsForSave = (condition: AchievementCondition, save: SaveDocument) =>
  conditionHolds(gameData, save, null, condition);

const ALL_DOGS = Object.keys(gameData.dogs) as (keyof typeof gameData.dogs)[];
const ALL_GEAR = Object.keys(gameData.shopGear) as (keyof typeof gameData.shopGear)[];

function withStats(stats: Partial<SaveDocument["stats"]>): SaveDocument {
  return { ...newPlayerSave, stats: { ...newPlayerSave.stats, ...stats } };
}

function withOwned(owned: Partial<SaveDocument["owned"]>): SaveDocument {
  return { ...newPlayerSave, owned: { ...newPlayerSave.owned, ...owned } };
}

describe("run conditions", () => {
  it("zonesFinished: at least the count, or every zone of the world for all", () => {
    const first = { count: 1, kind: "zonesFinished" } as const;
    expect(holdsForRun(first, { zonesFinished: 0 })).toBe(false);
    expect(holdsForRun(first, { zonesFinished: 1 })).toBe(true);
    const all = { count: "all", kind: "zonesFinished" } as const;
    expect(holdsForRun(all, { zonesFinished: 3 })).toBe(false);
    expect(holdsForRun(all, { zonesFinished: 4 })).toBe(true);
  });

  it("cleanZones: counts only finished zones with no bump", () => {
    const one = { count: 1, kind: "cleanZones" } as const;
    expect(holdsForRun(one, { bumpsByZone: [2, 0], zonesFinished: 2 })).toBe(true);
    expect(holdsForRun(one, { bumpsByZone: [2], zonesFinished: 1 })).toBe(false);
    // The zone in progress when the run ended never counts, bumped or not.
    expect(holdsForRun(one, { bumpsByZone: [1], zonesFinished: 1 })).toBe(false);
    expect(holdsForRun(one, { zonesFinished: 0 })).toBe(false);
  });

  it("cleanZones all: every zone of the world finished without a bump", () => {
    const all = { count: "all", kind: "cleanZones" } as const;
    expect(holdsForRun(all, { zonesFinished: 4 })).toBe(true);
    expect(holdsForRun(all, { bumpsByZone: [0, 0, 0, 1], zonesFinished: 4 })).toBe(false);
    expect(holdsForRun(all, { zonesFinished: 3 })).toBe(false);
  });

  it("cleanZones: a minor obstacle bump spoils the zone", () => {
    const bumped = countBump(testState({ koda: 5 }));
    const clean = { count: 1, kind: "cleanZones" } as const;
    expect(holdsForRun(clean, { bumpsByZone: [...bumped.bumpsByZone], zonesFinished: 1 })).toBe(
      false,
    );
  });

  it("counts nothing toward zones a dev start skipped: they are neither finished nor clean", () => {
    const fromZone3 = { firstZone: 2, zonesFinished: 4 };
    expect(holdsForRun({ count: 2, kind: "zonesFinished" }, fromZone3)).toBe(true);
    expect(holdsForRun({ count: 3, kind: "zonesFinished" }, fromZone3)).toBe(false);
    expect(holdsForRun({ count: "all", kind: "zonesFinished" }, fromZone3)).toBe(false);
    expect(holdsForRun({ count: 2, kind: "cleanZones" }, fromZone3)).toBe(true);
    expect(holdsForRun({ count: "all", kind: "cleanZones" }, fromZone3)).toBe(false);
    const headedHomeInZone4 = { firstZone: 3, zonesFinished: 3 };
    expect(holdsForRun({ count: 1, kind: "zonesFinished" }, headedHomeInZone4)).toBe(false);
    expect(holdsForRun({ count: 1, kind: "cleanZones" }, headedHomeInZone4)).toBe(false);
  });

  it("packSize: the dogs that set out, fired or not", () => {
    const two = { count: 2, kind: "packSize" } as const;
    expect(holdsForRun(two, { packSize: 1 })).toBe(false);
    expect(holdsForRun(two, { packSize: 3 })).toBe(true);
  });

  it("earnings: at least the dollars, in what the run banked", () => {
    const payday = { dollars: 500, kind: "earnings" } as const;
    expect(holdsForRun(payday, { earnedCents: cents(49_999) })).toBe(false);
    expect(holdsForRun(payday, { earnedCents: cents(50_000) })).toBe(true);
  });

  it("debuffZones: zones of one run that ended with the debuff on", () => {
    const stinky = { count: 3, debuff: "stinky", kind: "debuffZones" } as const;
    expect(holdsForRun(stinky, { debuffZones: { stinky: 2 } })).toBe(false);
    expect(holdsForRun(stinky, { debuffZones: { stinky: 3 } })).toBe(true);
  });

  it("never holds without a run, as for a purchase", () => {
    const save = veteranSave();
    expect(holdsForSave({ count: 1, kind: "zonesFinished" }, save)).toBe(false);
    expect(holdsForSave({ count: 1, kind: "packSize" }, save)).toBe(false);
  });
});

describe("profile conditions", () => {
  it("dogsOwned: the count, or every dog in the data for all", () => {
    expect(holdsForSave({ count: 3, kind: "dogsOwned" }, newPlayerSave)).toBe(true);
    expect(holdsForSave({ count: "all", kind: "dogsOwned" }, newPlayerSave)).toBe(false);
    expect(holdsForSave({ count: "all", kind: "dogsOwned" }, withOwned({ dogs: ALL_DOGS }))).toBe(
      true,
    );
  });

  it("gearOwned: every gear item for all", () => {
    const all = { count: "all", kind: "gearOwned" } as const;
    expect(holdsForSave(all, withOwned({ gear: ALL_GEAR.slice(1) }))).toBe(false);
    expect(holdsForSave(all, withOwned({ gear: ALL_GEAR }))).toBe(true);
  });

  it("dogSlotsOwned: every dog slot for all", () => {
    const all = { count: "all", kind: "dogSlotsOwned" } as const;
    expect(holdsForSave(all, withOwned({ dogSlots: 2 }))).toBe(false);
    expect(holdsForSave(all, withOwned({ dogSlots: 3 }))).toBe(true);
  });

  it("walksWithoutFiring, timesFired and squirrelsChased: at least the count", () => {
    expect(
      holdsForSave({ count: 10, kind: "walksWithoutFiring" }, withStats({ walksWithoutFiring: 9 })),
    ).toBe(false);
    expect(
      holdsForSave(
        { count: 10, kind: "walksWithoutFiring" },
        withStats({ walksWithoutFiring: 10 }),
      ),
    ).toBe(true);
    expect(holdsForSave({ count: 10, kind: "timesFired" }, withStats({ timesFired: 10 }))).toBe(
      true,
    );
    expect(
      holdsForSave({ count: 5, kind: "squirrelsChased" }, withStats({ squirrelsChased: 4 })),
    ).toBe(false);
    expect(
      holdsForSave({ count: 5, kind: "squirrelsChased" }, withStats({ squirrelsChased: 5 })),
    ).toBe(true);
  });

  it("dogsFinishedWith: every dog for all, counted across walks", () => {
    const all = { count: "all", kind: "dogsFinishedWith" } as const;
    expect(holdsForSave(all, withStats({ dogsFinishedWith: ALL_DOGS.slice(1) }))).toBe(false);
    expect(holdsForSave(all, withStats({ dogsFinishedWith: ALL_DOGS }))).toBe(true);
  });

  it("never holds without a save, as for the simulator's runs", () => {
    expect(conditionHolds(gameData, null, facts(), { count: 0, kind: "timesFired" })).toBe(false);
  });
});

describe("newlyEarned", () => {
  it("lists every achievement met and not yet earned, in wall order", () => {
    const run = facts({ packSize: 2, zonesFinished: 1 });
    expect(newlyEarned(gameData, newPlayerSave, newPlayerSave, run)).toEqual([
      "firstSteps",
      "doubleLeash",
      "cleanPaws",
    ]);
  });

  it("skips one already earned", () => {
    const earned = { ...newPlayerSave, achievements: { firstSteps: 1 } };
    const run = facts({ bumpsByZone: [1], zonesFinished: 1 });
    expect(newlyEarned(gameData, earned, newPlayerSave, run)).toEqual([]);
  });

  it("needs every condition: Top Walker wants all dogs and all slots", () => {
    const allDogs = withOwned({ dogs: ALL_DOGS });
    expect(newlyEarned(gameData, newPlayerSave, allDogs, null)).toEqual(["fullKennel"]);
    expect(
      newlyEarned(gameData, newPlayerSave, withOwned({ dogSlots: 3, dogs: ALL_DOGS }), null),
    ).toEqual(["fullKennel", "topWalker"]);
  });
});

describe("earnedByRun", () => {
  it("counts only achievements whose conditions are all about the run", () => {
    const run = facts({ earnedCents: cents(60_000), packSize: 3, zonesFinished: 4 });
    expect(earnedByRun(gameData, run)).toEqual([
      "firstSteps",
      "roundTrip",
      "doubleLeash",
      "packLeader",
      "cleanPaws",
      "notAScratch",
      "bigPayday",
    ]);
  });
});

describe("counters", () => {
  it("counts bumps by zone, filling the zones before with none", () => {
    const run = testState({ koda: 5 }, { zoneIndex: 2 });
    expect(countBump(countBump(run)).bumpsByZone).toEqual([0, 0, 2]);
  });

  it("counts a zone for each debuff on", () => {
    const run = testState(
      { koda: 5 },
      { debuffZones: { stinky: 1 }, debuffs: [{ debuff: "stinky", untilZone: 1 }] },
    );
    expect(countDebuffZones(run).debuffZones).toEqual({ stinky: 2 });
    expect(countDebuffZones(testState({ koda: 5 })).debuffZones).toEqual({});
  });

  it("counts a chase only for an option that lets the chasers chase", () => {
    const run = testState({ koda: 5 });
    expect(countChase({ chase: true }, run).squirrelChases).toBe(1);
    expect(countChase({}, run)).toBe(run);
  });
});
