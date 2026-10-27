import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import type { AchievementCondition, DogId, TallyId, WalkerId, ZoneId } from "../data/types";
import { type SaveDocument } from "../save/schema";
import { runFactsFor, saveFor } from "../testing/achievements";
import { testState } from "../testing/runState";
import { newPlayerSave, veteranSave } from "../testing/saves";
import {
  achievementConditionText,
  conditionHolds,
  countBump,
  countLandedBump,
  countOptionPick,
  countTally,
  earnedByRun,
  newlyEarned,
  runCountersOf,
  type RunFacts,
} from "./achievements";
import { applyEffects } from "./effects";
import { cents } from "./units";

const facts = (changes: Partial<RunFacts> = {}): RunFacts => ({
  bumpsByKind: {},
  bumpsByZone: [],
  debuffsGot: {},
  dogsHome: 1,
  earnedCents: cents(0),
  firstZone: 0,
  lastHeartOwners: 0,
  optionPicks: {},
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
const ALL_ZONES = gameData.world.zones.map(({ id }) => id as ZoneId);

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
const minorBump = [...countBump(testState({ kilo: 5 })).bumpsByZone];
const spotlight3 = { count: 3, debuff: "spotlight", kind: "debuffsGot" } as const;

describe("run conditions", () => {
  // A dev start from zone 3 skipped zones 1 and 2: they count as neither finished nor clean.
  const cases: [string, AchievementCondition, Partial<RunFacts>, boolean][] = [
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
    ["debuffsGot, the Spotlight a time short", spotlight3, { debuffsGot: { spotlight: 2 } }, false],
    ["debuffsGot, the Spotlight at the count", spotlight3, { debuffsGot: { spotlight: 3 } }, true],
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
  ];

  it("holds each run condition from its threshold, over the zones the walk finished", () => {
    const wrong = cases
      .filter(([, condition, run, holds]) => holdsForRun(condition, run) !== holds)
      .map(([name]) => name);
    expect(wrong).toEqual([]);
  });
});

describe("profile conditions", () => {
  const all = (kind: "dogsFinishedWith" | "dogsOwned" | "gearOwned") =>
    ({ count: "all", kind }) as const;
  const count = (
    kind: "noFiringStreak" | "timesFired" | "walksFinished" | "walksPlayed",
    n: number,
  ) => ({ count: n, kind }) as const;
  const helpKeeper = (n: number) =>
    ({ count: n, encounter: "capybara", kind: "optionPicks", option: "help" }) as const;
  const tally = (name: TallyId, n: number) => ({ count: n, kind: "tally", tally: name }) as const;
  const birds = (n: number) => ({ count: n, kind: "bumps", kinds: ["goose", "pigeons"] }) as const;
  const lifetime = { dollars: 200, kind: "lifetimeEarnings" } as const;
  const firedBy = (dogs: readonly DogId[]) =>
    Object.fromEntries(dogs.map((dog) => [dog, { timesFired: 1, walks: 1, zonesFinished: 0 }]));
  const ALL_WALKERS = Object.keys(gameData.walkers) as WalkerId[];
  const veteran = veteranSave();

  const cases: [string, AchievementCondition, SaveDocument | null, boolean][] = [
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
    [
      "noFiringStreak below the count",
      count("noFiringStreak", 10),
      withStats({ noFiringStreak: 9 }),
      false,
    ],
    [
      "noFiringStreak at the count",
      count("noFiringStreak", 10),
      withStats({ noFiringStreak: 10 }),
      true,
    ],
    [
      "optionPicks below the count",
      helpKeeper(10),
      withStats({ optionPicks: { capybara: { help: 9 } } }),
      false,
    ],
    [
      "optionPicks at the count",
      helpKeeper(10),
      withStats({ optionPicks: { capybara: { help: 10 } } }),
      true,
    ],
    [
      "optionPicks, another option of the card",
      helpKeeper(10),
      withStats({ optionPicks: { capybara: { callZoo: 10, drag: 10 } } }),
      false,
    ],
    [
      "optionPicks, an option of the same id on another card",
      { count: 10, encounter: "otherDog", kind: "optionPicks", option: "sniff" },
      withStats({ optionPicks: { fishCrates: { sniff: 10 } } }),
      false,
    ],
    ["timesFired at the count", count("timesFired", 10), withStats({ timesFired: 10 }), true],
    ["tally below", tally("dodges", 5), withStats({ tallies: { dodges: 4 } }), false],
    ["tally at", tally("dodges", 5), withStats({ tallies: { dodges: 5 } }), true],
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
    [
      "zonesEverFinished all, one missing",
      { count: "all", kind: "zonesEverFinished" },
      withStats({ zonesEverFinished: ALL_ZONES.slice(1) }),
      false,
    ],
    [
      "zonesEverFinished all, across walks",
      { count: "all", kind: "zonesEverFinished" },
      withStats({ zonesEverFinished: ALL_ZONES }),
      true,
    ],
    ["bumps below", birds(3), withStats({ bumpsByKind: { pigeons: 2 } }), false],
    ["bumps across kinds", birds(3), withStats({ bumpsByKind: { goose: 1, pigeons: 2 } }), true],
    [
      "bumps, another kind's count",
      birds(3),
      withStats({ bumpsByKind: { pigeons: 2, raccoon: 5 } }),
      false,
    ],
    [
      "firedByOwners all, one owner short",
      { count: "all", kind: "firedByOwners" },
      withStats({ dogs: firedBy(ALL_DOGS.slice(1)) }),
      false,
    ],
    [
      "firedByOwners all, every owner once",
      { count: "all", kind: "firedByOwners" },
      withStats({ dogs: firedBy(ALL_DOGS) }),
      true,
    ],
    [
      "firedByOwners, a dog walked but never fired",
      { count: 1, kind: "firedByOwners" },
      withStats({ dogs: { kilo: { timesFired: 0, walks: 3, zonesFinished: 4 } } }),
      false,
    ],
    ["lifetimeEarnings a cent short", lifetime, withStats({ lifetimeCents: cents(19_999) }), false],
    [
      "lifetimeEarnings at the dollars",
      lifetime,
      withStats({ lifetimeCents: cents(20_000) }),
      true,
    ],
    [
      "lifetimeEarnings a cent short net of starting cash",
      lifetime,
      withStats({ lifetimeCents: cents(25_000), lifetimeStartCents: cents(5_001) }),
      false,
    ],
    [
      "lifetimeEarnings at the dollars net of starting cash",
      lifetime,
      withStats({ lifetimeCents: cents(25_000), lifetimeStartCents: cents(5_000) }),
      true,
    ],
    [
      "walkersFinishedWith all, one missing",
      { count: "all", kind: "walkersFinishedWith" },
      withStats({ walkersFinishedWith: ALL_WALKERS.slice(1) }),
      false,
    ],
    [
      "walkersFinishedWith all, every walker",
      { count: "all", kind: "walkersFinishedWith" },
      withStats({ walkersFinishedWith: ALL_WALKERS }),
      true,
    ],
    [
      "walksPlayed below, however they ended",
      count("walksPlayed", 6),
      withStats({ runs: { finished: 1, noDogs: 2, wentHome: 2 } }),
      false,
    ],
    [
      "walksPlayed at, however they ended",
      count("walksPlayed", 6),
      withStats({ runs: { finished: 1, noDogs: 2, wentHome: 3 } }),
      true,
    ],
    [
      "walksFinished below, the others played ended early",
      count("walksFinished", 6),
      withStats({ runs: { finished: 5, noDogs: 4, wentHome: 4 } }),
      false,
    ],
    [
      "walksFinished at",
      count("walksFinished", 6),
      withStats({ runs: { finished: 6, noDogs: 0, wentHome: 0 } }),
      true,
    ],
    ["anything without a save, as for the simulator", count("timesFired", 0), null, false],
  ];

  it("holds each profile condition from its threshold, and none without a save", () => {
    const wrong = cases
      .filter(
        ([, condition, save, holds]) => conditionHolds(gameData, save, null, condition) !== holds,
      )
      .map(([name]) => name);
    expect(wrong).toEqual([]);
  });
});

const ALL_IDS = gameData.achievements.map(({ id }) => id);
// The condition kinds judged on one run; every other kind is judged on the save.
const RUN_KINDS: readonly AchievementCondition["kind"][] = [
  "cleanZones",
  "debuffsGot",
  "earnings",
  "finishOnLastHeart",
  "fullPackBonus",
  "packSize",
  "zonesFinished",
];

describe("newlyEarned", () => {
  it.each(ALL_IDS)("earns %s from the least its goal asks for, and only once", (id) => {
    const after = saveFor(gameData, [id], newPlayerSave);
    const run = runFactsFor(gameData, [id]);
    expect(newlyEarned(gameData, newPlayerSave, after, run)).toContain(id);
    const earned = { ...newPlayerSave, achievements: { [id]: 1 } };
    expect(newlyEarned(gameData, earned, after, run)).not.toContain(id);
  });

  it("lists every achievement met and not yet earned, in wall order", () => {
    const after = saveFor(gameData, ALL_IDS, newPlayerSave);
    const run = runFactsFor(gameData, ALL_IDS);
    expect(newlyEarned(gameData, newPlayerSave, after, run)).toEqual(ALL_IDS);
  });

  // A badge of two conditions: a pack of 2 that finishes the walk.
  const [first] = gameData.achievements;
  const both = { ...first, conditions: [packOf2, zonesFinished("all")] } as const;
  it.each<[string, Partial<RunFacts>, boolean]>([
    ["both met", { packSize: 2, ...walked }, true],
    ["the pack too small", { packSize: 1, ...walked }, false],
    ["a zone short", { packSize: 2, zonesFinished: 3 }, false],
  ])("needs every condition: %s", (_, run, earned) => {
    const data = { ...gameData, achievements: [both] as const };
    expect(newlyEarned(data, newPlayerSave, newPlayerSave, facts(run))).toEqual(
      earned ? [first.id] : [],
    );
  });
});

describe("earnedByRun", () => {
  it("counts only achievements whose conditions are all about the run", () => {
    const aboutTheRun = gameData.achievements
      .filter(({ conditions }) => conditions.every(({ kind }) => RUN_KINDS.includes(kind)))
      .map(({ id }) => id);
    expect(aboutTheRun.length).toBeLessThan(ALL_IDS.length);
    expect(earnedByRun(gameData, runFactsFor(gameData, ALL_IDS))).toEqual(aboutTheRun);
  });
});

describe("counters", () => {
  it("counts bumps by zone, filling the zones before with none", () => {
    const run = testState({ kilo: 5 }, { zoneIndex: 2 });
    expect(countBump(countBump(run)).bumpsByZone).toEqual([0, 0, 2]);
  });

  it("counts landed bumps by obstacle kind, adding to a kind already counted", () => {
    const run = testState({ kilo: 5 });
    const twice = countLandedBump("pigeons", countLandedBump("pigeons", run));
    expect(countLandedBump("raccoon", twice).bumpsByKind).toEqual({ pigeons: 2, raccoon: 1 });
  });

  it("counts each time a debuff is applied, again on a debuff already on", () => {
    const stinky = { debuff: "stinky", kind: "debuff" } as const;
    const context = {
      affected: [],
      source: { kind: "walker", walker: "casey" },
    } as const;
    const once = applyEffects(gameData, context, [stinky], testState({ kilo: 5 }));
    expect(once.debuffsGot).toEqual({ stinky: 1 });
    expect(applyEffects(gameData, context, [stinky], once).debuffsGot).toEqual({ stinky: 2 });
  });

  it("counts a tally, adding to one already counted", () => {
    const run = testState({ kilo: 5 });
    const twice = countTally("treats", countTally("treats", run));
    expect(twice.tallies).toEqual({ treats: 2 });
  });

  it("counts option picks by encounter and option id, each apart", () => {
    const run = testState({ kilo: 5 });
    const picked = [
      ["capybara", "help"],
      ["capybara", "help"],
      ["capybara", "drag"],
      ["fishCrates", "sniff"],
    ] as const;
    const after = picked.reduce(
      (state, [encounter, option]) => countOptionPick(encounter, option, state),
      run,
    );
    expect(after.optionPicks).toEqual({ capybara: { drag: 1, help: 2 }, fishCrates: { sniff: 1 } });
    expect(runCountersOf(after).optionPicks).toEqual(after.optionPicks);
  });
});

describe("achievementConditionText", () => {
  it("words every achievement's conditions in walks and neighbourhoods, never runs or zones", () => {
    const worded = gameData.achievements.flatMap(({ conditions }) =>
      conditions.map((condition) => achievementConditionText(gameData, condition)),
    );
    expect(worded.filter((text) => /\b(runs?|zones?|money)\b/.test(text))).toEqual([]);
  });
});
