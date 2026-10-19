import { describe, expect, it } from "vitest";

import { cents } from "../rules/units";
import type { EndReason } from "../state/runState";
import { bankCheckpoint, recordCheckpoint, recordRunEnd, type RunResult } from "./checkpoint";
import { veteranSave } from "./fixtures";
import type { Checkpoint } from "./schema";

// veteranSave: bank 12,345, best run 9,000, lifetime 30,000, best zone 3, runs finished 2 /
// noDogs 1 / wentHome 2, 1 firing; koda 1 fired / 5 walks / 12 zones, biscuit 0 / 2 / 6.

// After zone 2: koda and duchess walked both zones, waffles was fired in zone 2.
const checkpoint: Checkpoint = {
  dogs: [
    { fired: false, id: "koda", zonesFinished: 2 },
    { fired: false, id: "duchess", zonesFinished: 2 },
    { fired: true, id: "waffles", zonesFinished: 1 },
  ],
  earnedCents: cents(4_250),
  zoneReached: 2,
};

const runResult = (changes: Partial<RunResult> = {}): RunResult => ({
  dogs: [
    { fired: false, id: "koda", zonesFinished: 4 },
    { fired: true, id: "biscuit", zonesFinished: 1 },
  ],
  earnedCents: cents(6_000),
  outcome: "finished",
  zoneReached: 4,
  ...changes,
});

describe("recordCheckpoint", () => {
  it("stores the slice and leaves the rest of the save alone", () => {
    const save = veteranSave();
    expect(recordCheckpoint(save, checkpoint)).toEqual({ ...veteranSave(), checkpoint });
    expect(save).toEqual(veteranSave());
  });

  it("replaces an earlier checkpoint from the same run", () => {
    const first = recordCheckpoint(veteranSave(), { ...checkpoint, zoneReached: 1 });
    expect(recordCheckpoint(first, checkpoint).checkpoint).toEqual(checkpoint);
  });
});

describe("bankCheckpoint", () => {
  const banked = bankCheckpoint(recordCheckpoint(veteranSave(), checkpoint));

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
      waffles: { timesFired: 1, walks: 1, zonesFinished: 1 },
    });
    expect(banked.stats.timesFired).toBe(2);
  });

  it("keeps the best run and zone when the checkpoint is below them", () => {
    expect(banked.stats.bestRunCents).toBe(9_000);
    expect(banked.stats.bestZoneReached).toBe(3);
  });

  it("raises the best run and zone when the checkpoint beats them", () => {
    const { stats } = bankCheckpoint(
      recordCheckpoint(veteranSave(), { ...checkpoint, earnedCents: cents(9_500), zoneReached: 4 }),
    );
    expect(stats.bestRunCents).toBe(9_500);
    expect(stats.bestZoneReached).toBe(4);
  });

  it("does not change the save it is given", () => {
    const save = recordCheckpoint(veteranSave(), checkpoint);
    bankCheckpoint(save);
    expect(save).toEqual(recordCheckpoint(veteranSave(), checkpoint));
  });

  it("returns the save unchanged when there is no checkpoint", () => {
    const save = veteranSave();
    expect(bankCheckpoint(save)).toBe(save);
  });
});

describe("recordRunEnd", () => {
  const outcomes: [EndReason, Record<EndReason, number>][] = [
    ["finished", { finished: 3, noDogs: 1, wentHome: 2 }],
    ["noDogs", { finished: 2, noDogs: 2, wentHome: 2 }],
    ["wentHome", { finished: 2, noDogs: 1, wentHome: 3 }],
  ];

  it.each(outcomes)("counts a %s run under its own outcome only", (outcome, runs) => {
    expect(recordRunEnd(veteranSave(), runResult({ outcome })).stats.runs).toEqual(runs);
  });

  it.each(outcomes)("banks a %s run's earnings", (outcome) => {
    const save = recordRunEnd(veteranSave(), runResult({ outcome }));
    expect(save.bankCents).toBe(12_345 + 6_000);
    expect(save.stats.lifetimeCents).toBe(30_000 + 6_000);
  });

  it("credits each dog with a walk, its own zones finished and its firing", () => {
    const { stats } = recordRunEnd(veteranSave(), runResult());
    expect(stats.dogs).toEqual({
      biscuit: { timesFired: 1, walks: 3, zonesFinished: 7 },
      koda: { timesFired: 1, walks: 6, zonesFinished: 16 },
    });
  });

  it("adds the run's firings to the total", () => {
    const { stats } = recordRunEnd(
      veteranSave(),
      runResult({
        dogs: [
          { fired: true, id: "koda", zonesFinished: 0 },
          { fired: true, id: "biscuit", zonesFinished: 1 },
          { fired: true, id: "duchess", zonesFinished: 1 },
        ],
        outcome: "noDogs",
      }),
    );
    expect(stats.timesFired).toBe(1 + 3);
  });

  it("raises the best run and zone only when beaten", () => {
    const low = recordRunEnd(veteranSave(), runResult({ earnedCents: cents(100), zoneReached: 1 }));
    expect([low.stats.bestRunCents, low.stats.bestZoneReached]).toEqual([9_000, 3]);
    const high = recordRunEnd(
      veteranSave(),
      runResult({ earnedCents: cents(9_999), zoneReached: 4 }),
    );
    expect([high.stats.bestRunCents, high.stats.bestZoneReached]).toEqual([9_999, 4]);
  });

  it("clears the run's checkpoint so it is not banked again", () => {
    const save = recordRunEnd(recordCheckpoint(veteranSave(), checkpoint), runResult());
    expect(save.checkpoint).toBeNull();
    expect(bankCheckpoint(save)).toBe(save);
  });

  it("does not change the save it is given", () => {
    const save = veteranSave();
    recordRunEnd(save, runResult());
    expect(save).toEqual(veteranSave());
  });
});
