import { describe, expect, it } from "vitest";

import type { DogId } from "../data/types";
import { cents } from "../rules/units";
import type { EndReason } from "../state/runState";
import {
  bankCheckpoint,
  isNewBestWalk,
  recordCheckpoint,
  recordRunEnd,
  type RunResult,
  zonesFinishedBy,
} from "./checkpoint";
import { newPlayerSave, quietCounters, testAwards, veteranSave } from "./fixtures";
import type { Checkpoint, SaveDocument } from "./schema";

// veteranSave: bank 12,345, best walk 9,000 over 4 zones, lifetime 30,000, best zone 4, runs
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

const runResult = (changes: Partial<RunResult> = {}): RunResult => ({
  counters: quietCounters(),
  dogs: [
    { fired: false, id: "koda", zonesFinished: 4 },
    { fired: true, id: "biscuit", zonesFinished: 1 },
  ],
  earnedCents: cents(6_000),
  outcome: "finished",
  route: ["street", "park", "pawsPromenade", "homeStretch"],
  zone: 4,
  ...changes,
});

describe("zonesFinishedBy", () => {
  it.each<[EndReason, number, number]>([
    ["finished", 4, 4],
    ["wentHome", 3, 2],
    ["noDogs", 1, 0],
  ])("counts a %s run in zone %i as %i zones finished", (outcome, zone, finished) => {
    expect(zonesFinishedBy({ outcome, zone })).toBe(finished);
  });
});

describe("recordCheckpoint", () => {
  it("stores the slice and leaves the rest of the save alone", () => {
    const save = veteranSave();
    expect(recordCheckpoint(save, checkpoint)).toEqual({ ...veteranSave(), checkpoint });
    expect(save).toEqual(veteranSave());
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

  it("returns the save unchanged when there is no checkpoint", () => {
    const save = veteranSave();
    expect(bankCheckpoint(testAwards, save)).toBe(save);
  });
});

describe("recordRunEnd", () => {
  const outcomes: [EndReason, Record<EndReason, number>][] = [
    ["finished", { finished: 3, noDogs: 1, wentHome: 2 }],
    ["noDogs", { finished: 2, noDogs: 2, wentHome: 2 }],
    ["wentHome", { finished: 2, noDogs: 1, wentHome: 3 }],
  ];

  it.each(outcomes)("counts a %s run under its own outcome only", (outcome, runs) => {
    expect(recordRunEnd(testAwards, veteranSave(), runResult({ outcome })).stats.runs).toEqual(
      runs,
    );
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
      route: ["street", "park", "pawsPromenade", "homeStretch"],
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

  it("does not change the save it is given", () => {
    const save = veteranSave();
    recordRunEnd(testAwards, save, runResult());
    expect(save).toEqual(veteranSave());
  });
});

describe("achievements at banking", () => {
  it("awards what a run earned, stamped with the time, and keeps those earned before", () => {
    const save = recordRunEnd(testAwards, veteranSave(), runResult());
    expect(save.achievements).toEqual({
      ...veteranSave().achievements,
      cleanPaws: testAwards.now,
      doubleLeash: testAwards.now,
      notAScratch: testAwards.now,
      roundTrip: testAwards.now,
    });
  });

  // veteranSave has 2 walks without firing, and biscuit finished one.
  it.each<[string, Partial<RunResult>, number, DogId[]]>([
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
  ])("%s", (_, changes, walksWithoutFiring, dogsFinishedWith) => {
    const { stats } = recordRunEnd(testAwards, veteranSave(), runResult(changes));
    expect(stats.walksWithoutFiring).toBe(walksWithoutFiring);
    expect(stats.dogsFinishedWith).toEqual(dogsFinishedWith);
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
    expect(save.achievements).toEqual({
      cleanPaws: testAwards.now,
      firstSteps: testAwards.now,
    });
  });

  it("adds the run's squirrel chases to the total", () => {
    const counters = { ...quietCounters(), squirrelChases: 2 };
    const { stats } = recordRunEnd(testAwards, newPlayerSave, runResult({ counters }));
    expect(stats.squirrelsChased).toBe(2);
  });

  it("awards a checkpoint's run from its counters when it is banked", () => {
    const bumped = { ...checkpoint, counters: { ...quietCounters(), bumpsByZone: [1, 0] } };
    const banked = bankCheckpoint(testAwards, recordCheckpoint(newPlayerSave, bumped));
    expect(banked.achievements).toEqual({
      cleanPaws: testAwards.now,
      doubleLeash: testAwards.now,
      firstSteps: testAwards.now,
      packLeader: testAwards.now,
    });
  });

  it("awards only profile achievements for a checkpoint saved without counters", () => {
    const old = { ...checkpoint, counters: null };
    const fired = { ...newPlayerSave, stats: { ...newPlayerSave.stats, timesFired: 9 } };
    const banked = bankCheckpoint(testAwards, recordCheckpoint(fired, old));
    expect(banked.achievements).toEqual({ youreFired: testAwards.now });
  });
});

describe("isNewBestWalk", () => {
  // veteranSave's best walk earned 9,000.
  it.each<[string, SaveDocument, number, boolean]>([
    ["a first walk", newPlayerSave, 0, true],
    ["a walk that beats the best", veteranSave(), 9_001, true],
    ["not a tie", veteranSave(), 9_000, false],
  ])("flags %s", (_, save, earned, best) => {
    expect(isNewBestWalk(save.stats, cents(earned))).toBe(best);
  });
});
