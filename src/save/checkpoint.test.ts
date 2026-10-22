import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import type { DogId, WalkerId, ZoneId } from "../data/types";
import { cents } from "../rules/units";
import type { EndReason } from "../state/runState";
import { packOf, runFactsFor } from "../testing/achievements";
import { newPlayerSave, quietCounters, testAwards, veteranSave } from "../testing/saves";
import {
  bankCheckpoint,
  isNewBestWalk,
  recordCheckpoint,
  recordRunEnd,
  type RunResult,
  zonesFinishedBy,
} from "./checkpoint";
import { type Checkpoint, type SaveDocument } from "./schema";

// veteranSave: bank 12,345, best walk 9,000 over 4 zones, lifetime 30,000 of which 2,000 starting
// cash, best zone 4, runs
// finished 2 / noDogs 1 / wentHome 2, 1 firing; koda 1 fired / 5 walks / 12 zones, biscuit
// 0 / 2 / 6.

// After zone 2: koda and duchess walked both zones, penny was fired in zone 2.
const checkpoint: Checkpoint = {
  counters: quietCounters(),
  dogs: [
    { fired: false, id: "koda", zonesFinished: 2 },
    { fired: false, id: "duchess", zonesFinished: 2 },
    { fired: true, id: "penny", zonesFinished: 1 },
  ],
  earnedCents: cents(4_250),
  route: ["street", "snoozeCrescent"],
  zonesFinished: 2,
};

// A walk from the first zone through every zone that unlocks a walker, to the last zone.
const WALKERS = Object.entries(gameData.walkers) as [
  WalkerId,
  (typeof gameData.walkers)[WalkerId],
][];
const { firstZone, lastZone } = gameData.world;
const ROUTE = [
  firstZone,
  ...WALKERS.flatMap(([, walker]) =>
    walker.unlock === "finishZone" && walker.zone !== firstZone && walker.zone !== lastZone
      ? [walker.zone]
      : [],
  ),
  lastZone,
] as ZoneId[];

// The walkers owned once these zones are finished: those walking from the start, and those
// those zones unlock.
const unlockedBy = (finished: readonly ZoneId[]) =>
  WALKERS.filter(
    ([, walker]) =>
      walker.unlock === "start" ||
      (walker.unlock === "finishZone" && finished.includes(walker.zone)),
  )
    .map(([id]) => id)
    .sort();

const runResult = (changes: Partial<RunResult> = {}): RunResult => ({
  counters: quietCounters(),
  dogs: [
    { fired: false, id: "koda", zonesFinished: 4 },
    { fired: true, id: "biscuit", zonesFinished: 1 },
  ],
  earnedCents: cents(6_000),
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
      biscuit: { timesFired: 0, walks: 2, zonesFinished: 6 },
      duchess: { timesFired: 0, walks: 1, zonesFinished: 2 },
      koda: { timesFired: 1, walks: 6, zonesFinished: 14 },
      penny: { timesFired: 1, walks: 1, zonesFinished: 1 },
    });
    expect(banked.stats.timesFired).toBe(2);
  });

  it("records the last walk with the zone that just ended", () => {
    expect(banked.stats.lastWalk).toEqual({
      dogs: ["koda", "duchess", "penny"],
      earnedCents: 4_250,
      firings: [{ dog: "penny", zone: 2 }],
      outcome: "wentHome",
      route: ["street", "snoozeCrescent"],
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

  it("unlocks the walkers of the zones the run finished, not those a dev start skipped", () => {
    const walkers = (changes: Partial<RunResult>) =>
      recordRunEnd(testAwards, newPlayerSave, runResult(changes)).owned.walkers;
    expect([...walkers({ outcome: "wentHome", zone: 3 })].sort()).toEqual(
      unlockedBy(ROUTE.slice(0, 2)),
    );
    const devStart = { counters: { ...quietCounters(), firstZone: 2 } };
    expect([...walkers({ ...devStart, outcome: "wentHome", zone: 3 })].sort()).toEqual(
      unlockedBy(ROUTE.slice(2, 2)),
    );
    expect([...walkers(devStart)].sort()).toEqual(unlockedBy(ROUTE.slice(2)));
    expect([...walkers({})].sort()).toEqual(unlockedBy(ROUTE));
    expect(unlockedBy(ROUTE)).toEqual(WALKERS.map(([id]) => id).sort());
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
      biscuit: { timesFired: 1, walks: 1, zonesFinished: 0 },
      koda: { timesFired: 0, walks: 1, zonesFinished: 2 },
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
      dogs: ["koda", "biscuit"],
      earnedCents: 100,
      firings: [{ dog: "biscuit", zone: 2 }],
      outcome: "finished",
      route: ROUTE,
      zonesFinished: 1,
    });
    const high = recordRunEnd(testAwards, veteranSave(), runResult({ earnedCents: cents(9_999) }));
    expect(high.stats.bestWalk).toEqual({
      dogs: ["koda", "biscuit"],
      earnedCents: 9_999,
      zonesFinished: 4,
    });
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
    dogs: packOf(gameData, cleanPaws.packSize).map((id) => ({
      fired: false,
      id,
      zonesFinished: cleanPaws.zonesFinished,
    })),
    earnedCents: cleanPaws.earnedCents,
    route: ROUTE.slice(0, cleanPaws.zonesFinished),
    zonesFinished: cleanPaws.zonesFinished,
  });

  it("awards what a run earned, stamped with the time, and keeps those earned before", () => {
    const before = veteranSave();
    const banked = bankCheckpoint(testAwards, recordCheckpoint(before, cleanPawsWalk([])));
    expect(banked.achievements).toMatchObject({
      ...before.achievements,
      cleanPaws: testAwards.now,
    });
  });

  // veteranSave has 2 walks without firing, and biscuit finished one.
  const walks: [string, Partial<RunResult>, number, DogId[]][] = [
    [
      "counts a finished walk with no firing, and the dogs that finished it",
      {
        dogs: [
          { fired: false, id: "koda", zonesFinished: 4 },
          { fired: false, id: "penny", zonesFinished: 4 },
        ],
      },
      3,
      ["biscuit", "koda", "penny"],
    ],
    ["counts neither a walk with a firing", {}, 2, ["biscuit", "koda"]],
    [
      "counts neither a walk that ended early",
      { dogs: [{ fired: false, id: "penny", zonesFinished: 2 }], outcome: "wentHome" },
      2,
      ["biscuit"],
    ],
  ];

  it("counts a finished walk with no firing, and the dogs that finished it", () => {
    for (const [name, changes, walksWithoutFiring, dogsFinishedWith] of walks) {
      const { stats } = recordRunEnd(testAwards, veteranSave(), runResult(changes));
      expect(stats.walksWithoutFiring, name).toBe(walksWithoutFiring);
      expect(stats.dogsFinishedWith, name).toEqual(dogsFinishedWith);
    }
  });

  it("counts a walk a dev start began past zone 1 toward no total or zone badge", () => {
    const counters = { ...quietCounters(), firstZone: 2 };
    const clean = runResult({
      counters,
      dogs: [{ fired: false, id: "penny", zonesFinished: 4 }],
    });
    const save = recordRunEnd(testAwards, newPlayerSave, clean);
    expect(save.stats.walksWithoutFiring).toBe(0);
    expect(save.stats.dogsFinishedWith).toEqual([]);
    expect(save.stats.zonesEverFinished).toEqual([]);
    expect(save.achievements.notAScratch).toBeUndefined();
    expect(save.achievements.roundTrip).toBeUndefined();
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
    ["adds the walker of a finished walk", { walker: "ben" }, ["casey", "ben"]],
    ["adds a walker only once", {}, ["casey"]],
    ["not for a walk headed home", { outcome: "wentHome", walker: "ben", zone: 3 }, ["casey"]],
    [
      "not for a walk a dev start began past zone 1",
      { counters: { ...quietCounters(), firstZone: 2 }, walker: "ben" },
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
      expect(banked.achievements.cleanPaws).toBe(earned ? testAwards.now : undefined);
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
      { dogs: [{ fired: false, id: "koda", zonesFinished: 4 }], earnedCents: cents(100) },
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
