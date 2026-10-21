import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import type { AchievementCondition, TallyId, WalkerId } from "../data/types";
import { newPlayerSave, veteranSave } from "../save/fixtures";
import { type SaveDocument, TALLY_IDS } from "../save/schema";
import { earningsGoal } from "../testing/achievements";
import { testState } from "../testing/runState";
import {
  achievementConditionText,
  conditionHolds,
  countBump,
  countOptionTally,
  countTally,
  earnedByRun,
  newlyEarned,
  type RunFacts,
} from "./achievements";
import { applyEffects } from "./effects";
import { cents } from "./units";

const facts = (changes: Partial<RunFacts> = {}): RunFacts => ({
  bumpsByZone: [],
  debuffsGot: {},
  dogsHome: 1,
  earnedCents: cents(0),
  firstZone: 0,
  lastHeartOwners: 0,
  packSize: 1,
  startCents: cents(0),
  tallies: {},
  zonesFinished: 0,
  ...changes,
});

const holdsForRun = (condition: AchievementCondition, run: Partial<RunFacts>) =>
  conditionHolds(gameData, newPlayerSave, facts(run), condition);

const ALL_DOGS = Object.keys(gameData.dogs) as (keyof typeof gameData.dogs)[];
const ALL_GEAR = Object.keys(gameData.shopGear) as (keyof typeof gameData.shopGear)[];

function withStats(stats: Partial<SaveDocument["stats"]>): SaveDocument {
  return { ...newPlayerSave, stats: { ...newPlayerSave.stats, ...stats } };
}

function withOwned(owned: Partial<SaveDocument["owned"]>): SaveDocument {
  return { ...newPlayerSave, owned: { ...newPlayerSave.owned, ...owned } };
}

type Count = number | "all";
const zonesFinished = (count: Count) => ({ count, kind: "zonesFinished" }) as const;
const cleanZones = (count: Count) => ({ count, kind: "cleanZones" }) as const;
const packOf2 = { count: 2, kind: "packSize" } as const;
const payday = { dollars: 500, kind: "earnings" } as const;
const stinky3 = { count: 3, debuff: "stinky", kind: "debuffsGot" } as const;
const zoomies3 = { count: 3, debuff: "zoomies", kind: "debuffsGot" } as const;
const closeShave = { kind: "finishOnLastHeart" } as const;
const everybodyHome = { kind: "fullPackBonus", packSize: 3 } as const;
const walked = { zonesFinished: 4 };
const bumped = (bumpsByZone: number[], finished: number) => ({
  bumpsByZone,
  zonesFinished: finished,
});
const fromZone3 = { firstZone: 2, zonesFinished: 4 };
const homeInZone4 = { firstZone: 3, zonesFinished: 3 };
const minorBump = [...countBump(testState({ koda: 5 })).bumpsByZone];

describe("run conditions", () => {
  // A dev start from zone 3 skipped zones 1 and 2: they count as neither finished nor clean.
  it.each<[string, AchievementCondition, Partial<RunFacts>, boolean]>([
    ["zonesFinished below the count", zonesFinished(1), { zonesFinished: 0 }, false],
    ["zonesFinished at the count", zonesFinished(1), { zonesFinished: 1 }, true],
    ["zonesFinished all, a zone short", zonesFinished("all"), { zonesFinished: 3 }, false],
    ["zonesFinished all, every zone", zonesFinished("all"), { zonesFinished: 4 }, true],
    ["cleanZones, a finished zone clean", cleanZones(1), bumped([2, 0], 2), true],
    ["cleanZones, the finished zone bumped", cleanZones(1), bumped([2], 1), false],
    ["cleanZones, never the zone in progress", cleanZones(1), bumped([1], 1), false],
    ["cleanZones, no zone finished", cleanZones(1), { zonesFinished: 0 }, false],
    ["cleanZones, spoilt by a plain hit", cleanZones(1), bumped(minorBump, 1), false],
    ["cleanZones all, no bump", cleanZones("all"), { zonesFinished: 4 }, true],
    ["cleanZones all, a bump in the last zone", cleanZones("all"), bumped([0, 0, 0, 1], 4), false],
    ["cleanZones all, a zone short", cleanZones("all"), { zonesFinished: 3 }, false],
    ["dev start from zone 3, zonesFinished 2", zonesFinished(2), fromZone3, true],
    ["dev start from zone 3, zonesFinished 3", zonesFinished(3), fromZone3, false],
    ["dev start from zone 3, zonesFinished all", zonesFinished("all"), fromZone3, false],
    ["dev start from zone 3, cleanZones 2", cleanZones(2), fromZone3, true],
    ["dev start from zone 3, cleanZones all", cleanZones("all"), fromZone3, false],
    ["dev start home in zone 4, zonesFinished", zonesFinished(1), homeInZone4, false],
    ["dev start home in zone 4, cleanZones", cleanZones(1), homeInZone4, false],
    ["packSize, fewer dogs set out", packOf2, { packSize: 1 }, false],
    ["packSize, more dogs set out, fired or not", packOf2, { packSize: 3 }, true],
    ["earnings a cent short", payday, { earnedCents: cents(49_999) }, false],
    ["earnings at the dollars", payday, { earnedCents: cents(50_000) }, true],
    [
      "earnings at the dollars only with the starting money",
      payday,
      { earnedCents: cents(50_000), startCents: cents(2_000) },
      false,
    ],
    [
      "earnings at the dollars net of the starting money",
      payday,
      { earnedCents: cents(52_000), startCents: cents(2_000) },
      true,
    ],
    ["debuffsGot below the count", stinky3, { debuffsGot: { stinky: 2 } }, false],
    ["debuffsGot at the count", stinky3, { debuffsGot: { stinky: 3 } }, true],
    ["debuffsGot counts one walk's zoomies", zoomies3, { debuffsGot: { zoomies: 3 } }, true],
    ["debuffsGot counts no other debuff", zoomies3, { debuffsGot: { stinky: 3 } }, false],
    ["finishOnLastHeart, finished on one", closeShave, { ...walked, lastHeartOwners: 1 }, true],
    ["finishOnLastHeart, none on one", closeShave, { ...walked, lastHeartOwners: 0 }, false],
    [
      "finishOnLastHeart, headed home on one",
      closeShave,
      { lastHeartOwners: 1, zonesFinished: 3 },
      false,
    ],
    ["finishOnLastHeart, dev start", closeShave, { ...fromZone3, lastHeartOwners: 1 }, false],
    [
      "fullPackBonus, every dog of 3 home",
      everybodyHome,
      { ...walked, dogsHome: 3, packSize: 3 },
      true,
    ],
    [
      "fullPackBonus, a dog of 3 fired",
      everybodyHome,
      { ...walked, dogsHome: 2, packSize: 3 },
      false,
    ],
    [
      "fullPackBonus, a smaller pack",
      everybodyHome,
      { ...walked, dogsHome: 2, packSize: 2 },
      false,
    ],
    [
      "fullPackBonus, headed home",
      everybodyHome,
      { dogsHome: 3, packSize: 3, zonesFinished: 3 },
      false,
    ],
  ])("%s", (_, condition, run, holds) => {
    expect(holdsForRun(condition, run)).toBe(holds);
  });
});

describe("profile conditions", () => {
  const all = (kind: "dogSlotsOwned" | "dogsFinishedWith" | "dogsOwned" | "gearOwned") =>
    ({ count: "all", kind }) as const;
  const count = (kind: "timesFired" | "walksWithoutFiring", n: number) =>
    ({ count: n, kind }) as const;
  const tally = (name: TallyId, n: number) => ({ count: n, kind: "tally", tally: name }) as const;
  const ALL_WALKERS = Object.keys(gameData.walkers) as WalkerId[];
  const veteran = veteranSave();

  it.each<[string, AchievementCondition, SaveDocument | null, boolean]>([
    ["a run condition, without a run", zonesFinished(1), veteran, false],
    ["packSize, without a run", { count: 1, kind: "packSize" }, veteran, false],
    [
      "dogsOwned at the count",
      { count: newPlayerSave.owned.dogs.length, kind: "dogsOwned" },
      newPlayerSave,
      true,
    ],
    [
      "dogsOwned below the count",
      { count: newPlayerSave.owned.dogs.length + 1, kind: "dogsOwned" },
      newPlayerSave,
      false,
    ],
    ["dogsOwned all, the starters", all("dogsOwned"), newPlayerSave, false],
    ["dogsOwned all, every dog", all("dogsOwned"), withOwned({ dogs: ALL_DOGS }), true],
    ["gearOwned all, one missing", all("gearOwned"), withOwned({ gear: ALL_GEAR.slice(1) }), false],
    ["gearOwned all, every item", all("gearOwned"), withOwned({ gear: ALL_GEAR }), true],
    ["dogSlotsOwned all, one missing", all("dogSlotsOwned"), withOwned({ dogSlots: 2 }), false],
    ["dogSlotsOwned all, every slot", all("dogSlotsOwned"), withOwned({ dogSlots: 3 }), true],
    [
      "walksWithoutFiring below the count",
      count("walksWithoutFiring", 10),
      withStats({ walksWithoutFiring: 9 }),
      false,
    ],
    [
      "walksWithoutFiring at the count",
      count("walksWithoutFiring", 10),
      withStats({ walksWithoutFiring: 10 }),
      true,
    ],
    ["timesFired at the count", count("timesFired", 10), withStats({ timesFired: 10 }), true],
    ...TALLY_IDS.flatMap((name): [string, AchievementCondition, SaveDocument, boolean][] => [
      [`tally ${name} below`, tally(name, 5), withStats({ tallies: { [name]: 4 } }), false],
      [`tally ${name} at`, tally(name, 5), withStats({ tallies: { [name]: 5 } }), true],
    ]),
    [
      "tally, another tally's count",
      tally("dodges", 5),
      withStats({ tallies: { treats: 9 } }),
      false,
    ],
    [
      "walkersUnlocked all, one missing",
      { count: "all", kind: "walkersUnlocked" },
      withOwned({ walkers: ALL_WALKERS.slice(1) }),
      false,
    ],
    [
      "walkersUnlocked all, every walker",
      { count: "all", kind: "walkersUnlocked" },
      withOwned({ walkers: ALL_WALKERS }),
      true,
    ],
    [
      "dogsFinishedWith all, one missing",
      all("dogsFinishedWith"),
      withStats({ dogsFinishedWith: ALL_DOGS.slice(1) }),
      false,
    ],
    [
      "dogsFinishedWith all, across walks",
      all("dogsFinishedWith"),
      withStats({ dogsFinishedWith: ALL_DOGS }),
      true,
    ],
    ["anything without a save, as for the simulator", count("timesFired", 0), null, false],
  ])("%s", (_, condition, save, holds) => {
    expect(conditionHolds(gameData, save, null, condition)).toBe(holds);
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
    const run = facts({ earnedCents: earningsGoal("bigPayday"), packSize: 3, zonesFinished: 4 });
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

  it("counts each time a debuff is applied, again on a debuff already on", () => {
    const stinky = { debuff: "stinky", kind: "debuff" } as const;
    const context = {
      affected: [],
      random: () => 0,
      source: { kind: "walker", walker: "casey" },
    } as const;
    const once = applyEffects(gameData, context, [stinky], testState({ koda: 5 }));
    expect(once.debuffsGot).toEqual({ stinky: 1 });
    expect(applyEffects(gameData, context, [stinky], once).debuffsGot).toEqual({ stinky: 2 });
  });

  it("counts a tally only for an option that names one", () => {
    const run = testState({ koda: 5 });
    expect(countOptionTally({ tally: "sniffs" }, run).tallies).toEqual({ sniffs: 1 });
    expect(countOptionTally({}, run)).toBe(run);
  });

  it("adds to a tally already counted", () => {
    const twice = countTally("treats", countTally("treats", testState({ koda: 5 })));
    expect(twice.tallies).toEqual({ treats: 2 });
  });
});

describe("achievementConditionText", () => {
  it.each(gameData.achievements.map(({ conditions, name }) => [name, conditions] as const))(
    "words %s's conditions in walks and neighborhoods, never runs or zones",
    (_, conditions) => {
      for (const condition of conditions) {
        expect(achievementConditionText(gameData, condition)).not.toMatch(
          /\b(runs?|zones?|money)\b/,
        );
      }
    },
  );
});
