import { keysOf } from "@andornaut/game-kit/records";
import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import type { DogId, WalkerId, ZoneId } from "../data/types";
import { walkerGoal } from "../rules/walkers";
import type { EndReason } from "../state/runState";
import { packOf, runFactsFor } from "../testing/achievements";
import { newPlayerSave, quietCounters, testAwards, veteranSave } from "../testing/saves";
import { cents } from "../units";
import {
  bankCheckpoint,
  isNewBestWalk,
  recordCheckpoint,
  recordRunEnd,
  type RunResult,
  zonesFinishedBy,
} from "./checkpoint";
import { type Checkpoint, type SaveDocument } from "./schema";
import { bestWalkCents, timesFired } from "./stats";

// veteranSave: bank 12,345, best walk 9,000 over 4 zones, lifetime 30,000 of which 2,000 starting
// cash, best zone 4, runs
// finished 2 / noDogs 1 / wentHome 2, 1 firing; kilo 1 fired / 5 walks / 12 zones, lady
// 0 / 2 / 6.

// After zone 2: kilo and ginger walked both zones, penny was fired in zone 2.
const checkpoint: Checkpoint = {
  counters: quietCounters(),
  dogs: [
    { firedInZone: null, id: "kilo" },
    { firedInZone: null, id: "ginger" },
    { firedInZone: 2, id: "penny" },
  ],
  earnedCents: cents(4_250),
  route: ["distilleryDistrict", "cabbagetown"],
  zonesFinished: 2,
};

// A walk from the first zone to the last.
const { firstZone, lastZone } = gameData.world;
const ROUTE = [firstZone, "cabbagetown", "theBeaches", lastZone] as ZoneId[];

// The walkers owned after a walk finished with this many dogs still walking: those walking from
// the start, and those whose goal that many dogs reach.
const unlockedBy = (dogs: number) =>
  keysOf(gameData.walkers)
    .filter((id) => (walkerGoal(gameData.walkers[id]) ?? 0) <= dogs)
    .sort();

const runResult = (changes: Partial<RunResult> = {}): RunResult => ({
  counters: quietCounters(),
  dogs: [
    { firedInZone: null, id: "kilo" },
    { firedInZone: 2, id: "lady" },
  ],
  earnedCents: cents(6_000),
  lastHeartOwners: 0,
  lostCents: cents(0),
  outcome: "finished",
  route: ROUTE,
  walker: "casey",
  zone: 4,
  ...changes,
});

describe("zonesFinishedBy", () => {
  it("counts the zone a run ended in as finished only for a finished run", () => {
    const counted = (
      [
        ["finished", 4],
        ["wentHome", 3],
        ["noDogs", 1],
      ] as const
    ).map(([outcome, zone]) => zonesFinishedBy({ outcome, zone }));
    expect(counted).toEqual([4, 2, 0]);
  });
});

describe("bankCheckpoint", () => {
  const banked = bankCheckpoint(testAwards, recordCheckpoint(veteranSave(), checkpoint));

  it("banks the run as gone home and clears the checkpoint", () => {
    expect(banked.bankCents).toBe(12_345 + 4_250);
    expect(banked.checkpoint).toBeNull();
    expect(banked.stats.runs).toEqual({ finished: 2, noDogs: 1, wentHome: 3 });
    expect(banked.stats.lifetimeCents).toBe(30_000 + 4_250);
  });

  it("banks the run's bumps by kind and tallies, and finishes no walk for its walker", () => {
    const counters = {
      ...quietCounters(),
      bumpsByKind: { raccoon: 1 },
      tallies: { tips: 7, walletsFound: 1 },
    };
    const { stats } = bankCheckpoint(
      testAwards,
      recordCheckpoint(veteranSave(), { ...checkpoint, counters }),
    );
    expect(stats.bumpsByKind).toEqual({ ...veteranSave().stats.bumpsByKind, raccoon: 1 });
    expect(stats.tallies).toEqual({ ...veteranSave().stats.tallies, tips: 7, walletsFound: 1 });
    expect(stats.walkersFinishedWith).toEqual(veteranSave().stats.walkersFinishedWith);
  });

  it("credits each dog with a walk, its zones finished and its firing", () => {
    expect(banked.stats.dogs).toEqual({
      ginger: { timesFired: 0, walks: 1, zonesFinished: 2 },
      kilo: { timesFired: 1, walks: 6, zonesFinished: 14 },
      lady: { timesFired: 0, walks: 2, zonesFinished: 6 },
      penny: { timesFired: 1, walks: 1, zonesFinished: 1 },
    });
    expect(timesFired(banked.stats)).toBe(2);
  });

  it("records the last walk with the zone that just ended", () => {
    expect(banked.stats.lastWalk).toEqual({
      dogs: ["kilo", "ginger", "penny"],
      earnedCents: 4_250,
      firings: ["penny"],
      outcome: "wentHome",
      route: ["distilleryDistrict", "cabbagetown"],
      zonesFinished: 2,
    });
  });
});

describe("recordRunEnd", () => {
  const outcomes: [EndReason, Record<EndReason, number>][] = [
    ["finished", { finished: 3, noDogs: 1, wentHome: 2 }],
    ["noDogs", { finished: 2, noDogs: 2, wentHome: 2 }],
    ["wentHome", { finished: 2, noDogs: 1, wentHome: 3 }],
  ];

  it("counts each run under its own outcome only", () => {
    for (const [outcome, runs] of outcomes) {
      const recorded = recordRunEnd(testAwards, veteranSave(), runResult({ outcome }));
      expect(recorded.stats.runs, outcome).toEqual(runs);
    }
  });

  // A pack of 3 whose last 3 - walking owners fired you in zone 2.
  const walkingOf = (walking: number) => ({
    dogs: (["kilo", "lady", "penny"] as const).map((id, i) => ({
      firedInZone: i < walking ? null : 2,
      id,
    })),
  });
  const walkersAfter = (changes: Partial<RunResult>, save: SaveDocument = newPlayerSave) =>
    [...recordRunEnd(testAwards, save, runResult(changes)).owned.walkers].sort();

  it.each([0, 1, 2, 3])(
    "unlocks, for a walk finished with %i dogs still walking, every walker that many reach",
    (walking) => {
      expect(walkersAfter(walkingOf(walking))).toEqual(unlockedBy(walking));
    },
  );

  it.each([
    ["headed home", { ...walkingOf(3), outcome: "wentHome", zone: 3 }],
    ["fired out", { ...walkingOf(0), outcome: "noDogs", zone: 2 }],
    [
      "begun past zone 1 by a dev start",
      { ...walkingOf(3), counters: { ...quietCounters(), firstZone: 2 } },
    ],
  ] satisfies [string, Partial<RunResult>][])("unlocks none for a walk %s", (_, changes) => {
    expect(walkersAfter(changes)).toEqual(unlockedBy(0));
  });

  it("unlocks none for a walk banked from its checkpoint at a zone's end", () => {
    const save = recordCheckpoint(newPlayerSave, { ...checkpoint, ...walkingOf(3) });
    expect([...bankCheckpoint(testAwards, save).owned.walkers].sort()).toEqual(unlockedBy(0));
  });

  it("keeps every walker unlocked before, adding each only once", () => {
    const owned = { ...newPlayerSave.owned, walkers: keysOf(gameData.walkers) };
    const save = { ...newPlayerSave, owned };
    expect(recordRunEnd(testAwards, save, runResult(walkingOf(1))).owned.walkers).toEqual(
      owned.walkers,
    );
  });

  it("banks no money, starting cash or best walk for a dev start past zone 1, and counts the zones it walked", () => {
    const { bankCents, stats } = recordRunEnd(
      testAwards,
      newPlayerSave,
      runResult({ counters: { ...quietCounters(), firstZone: 2, startCents: cents(1_500) } }),
    );
    expect(bankCents).toBe(0);
    expect([stats.lifetimeCents, stats.lifetimeStartCents]).toEqual([0, 0]);
    expect(stats.bestWalk).toBeNull();
    expect(stats.bestCentsByPackSize).toEqual({});
    expect(stats.bestZoneFinished).toBe(2);
    expect(stats.runs).toEqual({ finished: 0, noDogs: 0, wentHome: 1 });
    expect(stats.dogs).toEqual({
      kilo: { timesFired: 0, walks: 1, zonesFinished: 2 },
      lady: { timesFired: 1, walks: 1, zonesFinished: 0 },
    });
  });

  it("records heading home mid-zone 3 as 2 zones finished", () => {
    const { stats } = recordRunEnd(
      testAwards,
      newPlayerSave,
      runResult({ outcome: "wentHome", zone: 3 }),
    );
    expect(stats.bestZoneFinished).toBe(2);
    expect(stats.lastWalk?.zonesFinished).toBe(2);
  });

  it("records the last walk every time, and the best walk only when beaten", () => {
    const low = recordRunEnd(
      testAwards,
      veteranSave(),
      runResult({ earnedCents: cents(100), zone: 1 }),
    );
    expect(low.stats.bestWalk).toEqual(veteranSave().stats.bestWalk);
    expect(low.stats.bestZoneFinished).toBe(4);
    expect(low.stats.lastWalk).toEqual({
      dogs: ["kilo", "lady"],
      earnedCents: 100,
      firings: ["lady"],
      outcome: "finished",
      route: ROUTE,
      zonesFinished: 1,
    });
    const high = recordRunEnd(testAwards, veteranSave(), runResult({ earnedCents: cents(9_999) }));
    expect(high.stats.bestWalk).toEqual({ dogs: ["kilo", "lady"], zonesFinished: 4 });
    expect(bestWalkCents(high.stats)).toBe(9_999);
  });

  it("clears the run's checkpoint so it is not banked again", () => {
    const save = recordRunEnd(testAwards, recordCheckpoint(veteranSave(), checkpoint), runResult());
    expect(save.checkpoint).toBeNull();
    expect(bankCheckpoint(testAwards, save)).toBe(save);
  });
});

describe("achievements at banking", () => {
  // A checkpoint walked as Clean Paws' goal asks, with these bumps in each zone.
  const cleanPaws = runFactsFor(gameData, ["cleanPaws"]);
  const cleanPawsWalk = (bumpsByZone: number[]): Checkpoint => ({
    counters: { ...quietCounters(), bumpsByZone },
    dogs: packOf(gameData, cleanPaws.packSize).map((id) => ({ firedInZone: null, id })),
    earnedCents: cleanPaws.earnedCents,
    route: ROUTE.slice(0, cleanPaws.zonesFinished),
    zonesFinished: cleanPaws.zonesFinished,
  });

  it("awards what a run earned after those earned before", () => {
    const before = veteranSave();
    const banked = bankCheckpoint(testAwards, recordCheckpoint(before, cleanPawsWalk([])));
    expect(banked.achievements).toEqual([...before.achievements, "cleanPaws"]);
  });

  // veteranSave is 2 finished walks into a streak with no firing, and lady finished one.
  const walks: [string, Partial<RunResult>, number, DogId[]][] = [
    [
      "a finished walk with no firing adds to the streak, with the dogs that finished it",
      {
        dogs: [
          { firedInZone: null, id: "kilo" },
          { firedInZone: null, id: "penny" },
        ],
      },
      3,
      ["lady", "kilo", "penny"],
    ],
    ["a finished walk with a firing resets the streak", {}, 0, ["lady", "kilo"]],
    [
      "a walk headed home early with no firing leaves the streak",
      { dogs: [{ firedInZone: null, id: "penny" }], outcome: "wentHome", zone: 3 },
      2,
      ["lady"],
    ],
    [
      "a walk headed home early with a firing resets the streak",
      {
        dogs: [
          { firedInZone: null, id: "penny" },
          { firedInZone: 2, id: "kilo" },
        ],
        outcome: "wentHome",
        zone: 3,
      },
      0,
      ["lady"],
    ],
    [
      "a walk that ran out of dogs resets the streak",
      { dogs: [{ firedInZone: 2, id: "penny" }], outcome: "noDogs", zone: 2 },
      0,
      ["lady"],
    ],
  ];

  it.each(walks)("%s", (_name, changes, noFiringStreak, dogsFinishedWith) => {
    const { stats } = recordRunEnd(testAwards, veteranSave(), runResult(changes));
    expect(stats.noFiringStreak).toBe(noFiringStreak);
    expect(stats.dogsFinishedWith).toEqual(dogsFinishedWith);
  });

  // Each badge for a streak of finished walks with no firing, and the streak it needs.
  const streakBadges = gameData.achievements.flatMap(({ conditions, id }) =>
    conditions.flatMap((condition) =>
      condition.kind === "noFiringStreak" ? [{ count: condition.count, id }] : [],
    ),
  );

  it.each(streakBadges)(
    "earns $id on the finished walk that makes the streak $count, not on one headed home",
    ({ count, id }) => {
      const before = {
        ...newPlayerSave,
        stats: { ...newPlayerSave.stats, noFiringStreak: count - 1 },
      };
      const dogs = [{ firedInZone: null, id: "kilo" }] as const;
      const finished = recordRunEnd(testAwards, before, runResult({ dogs: [...dogs] }));
      expect(finished.achievements).toContain(id);
      const home = runResult({ dogs: [...dogs], outcome: "wentHome", zone: 3 });
      expect(recordRunEnd(testAwards, before, home).achievements).not.toContain(id);
    },
  );

  it("adds the run's option picks to the lifetime ones, option by option", () => {
    const counters = {
      ...quietCounters(),
      optionPicks: { cheeseCrates: { sniff: 1 }, weddingPhotoShoot: { pose: 2 } },
    };
    const before = {
      ...newPlayerSave,
      stats: { ...newPlayerSave.stats, optionPicks: { cheeseCrates: { buy: 3, sniff: 4 } } },
    };
    const { stats } = recordRunEnd(testAwards, before, runResult({ counters }));
    expect(stats.optionPicks).toEqual({
      cheeseCrates: { buy: 3, sniff: 5 },
      weddingPhotoShoot: { pose: 2 },
    });
  });

  it("counts a walk a dev start began past zone 1 toward no total or zone badge", () => {
    const counters = { ...quietCounters(), firstZone: 2 };
    const clean = runResult({
      counters,
      dogs: [{ firedInZone: null, id: "penny" }],
    });
    const save = recordRunEnd(testAwards, newPlayerSave, clean);
    expect(save.stats.noFiringStreak).toBe(0);
    expect(save.stats.dogsFinishedWith).toEqual([]);
    expect(save.stats.zonesEverFinished).toEqual([]);
    expect(save.achievements).not.toContain("notAScratch");
    expect(save.achievements).not.toContain("roundTrip");
  });

  // Each row starts from a save that has finished the first zone of ROUTE.
  const finishedZones: [string, Partial<RunResult>, ZoneId[]][] = [
    ["adds each zone a finished walk finished, once", {}, ROUTE],
    [
      "leaves out the zone a walk headed home in",
      { outcome: "wentHome", zone: 3 },
      ROUTE.slice(0, 2),
    ],
    [
      "counts none for a walk a dev start began past zone 1",
      { counters: { ...quietCounters(), firstZone: 2 } },
      ROUTE.slice(0, 1),
    ],
  ];

  it.each(finishedZones)("counts the zones ever finished: %s", (_name, changes, zones) => {
    const before = {
      ...newPlayerSave,
      stats: { ...newPlayerSave.stats, zonesEverFinished: ROUTE.slice(0, 1) },
    };
    const { stats } = recordRunEnd(testAwards, before, runResult(changes));
    expect(stats.zonesEverFinished).toEqual(zones);
  });

  it("adds the run's tallies, bumps by kind, banked total and starting cash to the lifetime ones", () => {
    const counters = {
      ...quietCounters(),
      bumpsByKind: { pigeons: 1, raccoon: 2 },
      startCents: cents(1_500),
      tallies: { dodges: 2 },
    };
    const before = {
      ...newPlayerSave,
      stats: {
        ...newPlayerSave.stats,
        bumpsByKind: { pigeons: 4 },
        lifetimeCents: cents(10_000),
        lifetimeStartCents: cents(1_000),
        tallies: { dodges: 3 },
      },
    };
    const { stats } = recordRunEnd(testAwards, before, runResult({ counters }));
    expect(stats.tallies).toEqual({ dodges: 5 });
    expect(stats.bumpsByKind).toEqual({ pigeons: 5, raccoon: 2 });
    expect([stats.lifetimeCents, stats.lifetimeStartCents]).toEqual([10_000 + 6_000, 2_500]);
  });

  // Each row starts from a save in which casey has finished a walk.
  const walkersFinished: [string, Partial<RunResult>, WalkerId[]][] = [
    ["adds the walker of a finished walk", { walker: "mrB" }, ["casey", "mrB"]],
    ["adds a walker only once", {}, ["casey"]],
    ["not for a walk headed home", { outcome: "wentHome", walker: "mrB", zone: 3 }, ["casey"]],
    [
      "not for a walk a dev start began past zone 1",
      { counters: { ...quietCounters(), firstZone: 2 }, walker: "mrB" },
      ["casey"],
    ],
  ];

  it.each(walkersFinished)("counts the walkers who finished: %s", (_name, changes, walkers) => {
    const before = {
      ...newPlayerSave,
      stats: { ...newPlayerSave.stats, walkersFinishedWith: ["casey" as const] },
    };
    const { stats } = recordRunEnd(testAwards, before, runResult(changes));
    expect(stats.walkersFinishedWith).toEqual(walkers);
  });

  // Clean Paws' walk, banked with each run's bumps.
  const banks: [string, number[], boolean][] = [
    ["earns Clean Paws for a walk with no bump", [], true],
    [
      "not for a walk with a bump in every zone",
      Array.from({ length: cleanPaws.zonesFinished }, () => 1),
      false,
    ],
  ];

  it.each(banks)(
    "awards a checkpoint's run from its counters when it is banked: %s",
    (_name, bumpsByZone, earned) => {
      const walked = cleanPawsWalk(bumpsByZone);
      const banked = bankCheckpoint(testAwards, recordCheckpoint(newPlayerSave, walked));
      expect(banked.achievements.includes("cleanPaws")).toBe(earned);
    },
  );
});

describe("isNewBestWalk", () => {
  // veteranSave's best walk, with 2 dogs, earned 9,000; it has walked no other pack size.
  const walksFlagged: [string, SaveDocument, number, number, boolean][] = [
    ["a first walk", newPlayerSave, 1, 0, true],
    ["a walk that beats the best with as many dogs", veteranSave(), 2, 9_001, true],
    ["not a tie", veteranSave(), 2, 9_000, false],
    ["a first walk with another number of dogs, below the best", veteranSave(), 1, 100, true],
    ["a first walk with another number of dogs, above the best", veteranSave(), 3, 9_999, true],
  ];

  it("flags a walk that beats the best with as many dogs, or is the first with its number", () => {
    const wrong = walksFlagged.filter(
      ([, save, packSize, earned, best]) =>
        isNewBestWalk(save.stats, packSize, cents(earned)) !== best,
    );
    expect(wrong.map(([name]) => name)).toEqual([]);
  });
});

describe("bests by pack size", () => {
  // runResult walks 2 dogs; veteranSave's best for 2 dogs is 9,000.
  const bests: [string, Partial<RunResult>, Record<number, number>][] = [
    ["keeps the best for its size when not beaten", { earnedCents: cents(100) }, { 2: 9_000 }],
    ["raises the best for its size when beaten", { earnedCents: cents(9_999) }, { 2: 9_999 }],
    [
      "adds a best for a size walked the first time",
      { dogs: [{ firedInZone: null, id: "kilo" }], earnedCents: cents(100) },
      { 1: 100, 2: 9_000 },
    ],
  ];

  it("keeps, raises or adds the best for the walk's pack size", () => {
    for (const [name, changes, kept] of bests) {
      const { stats } = recordRunEnd(testAwards, veteranSave(), runResult(changes));
      expect(stats.bestCentsByPackSize, name).toEqual(kept);
    }
  });
});
