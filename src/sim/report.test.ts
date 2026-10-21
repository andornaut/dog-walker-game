import { describe, expect, it, vi } from "vitest";

import { gameData } from "../data";
import { DOGS } from "../data/dogs";
import type { DogId } from "../data/types";
import type { PackDogs } from "../state/runState";
import {
  DEFAULT_MATRIX,
  formatKindTable,
  formatTable,
  type Matrix,
  matrixCells,
  type MatrixRow,
  type NamedPack,
  simulateMatrix,
  simulateMatrixInBatches,
} from "./report";

// These tests cover how report.ts seeds, orders, batches and summarizes runs, not the runs
// themselves (simulate.test.ts does). A real run costs over a hundred milliseconds, so a stand-in
// replaces it: like the real one, it draws only from its seed, so a seed fixes its result.
vi.mock("./simulate", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./simulate")>();
  const { cents } = await import("../rules/units");
  const { newRun } = await import("../state/runState");
  const { seededRandom } = await import("../runner/random");
  const simulateRun: typeof actual.simulateRun = (data, seed, config) => {
    const random = seededRandom(seed);
    return {
      badges: [],
      cardsSeen: Math.floor(random() * 10),
      choices: [],
      earnings: cents(random() * 10_000),
      finished: random() >= (config.player.kind === "rates" ? config.player.hitRate : 0.1),
      firings:
        config.player.kind === "rates" && config.player.hitRate === 0.5
          ? [
              { dog: "koda", zoneIndex: 0 },
              { dog: "koda", zoneIndex: 1 },
            ]
          : [],
      hits: { afterPull: 1, all: 4 },
      inputs: [],
      items: { cone: { met: 4, touched: 1 }, tip: { met: 10, touched: 6 } },
      moneyShare: 0,
      movers: { "ball:ball-bounce": { met: 2, touched: 1 } },
      pullsMoved: 0,
      route: [],
      run: newRun(data, config.pack.length, {
        dogs: config.pack,
        gear: config.gear,
        walker: config.walker,
      }),
      tips: cents(0),
      upgrades: [],
      zones: [],
      zonesCompleted: 0,
    };
  };
  return { ...actual, simulateRun };
});

const SMALL: Matrix = {
  ...DEFAULT_MATRIX,
  packs: [
    { dogs: ["koda"], name: "Koda" },
    { dogs: ["zippy", "archie", "snowball"], name: "Risky trio" },
  ],
  players: [
    { hitRate: 0.06, kind: "rates" },
    { hitRate: 0.15, kind: "rates" },
  ],
  policies: ["heartsUnlessLow", "alwaysPay"],
};

const [A, B] = Object.keys(DOGS).sort() as [DogId, DogId];

describe("simulateMatrix", () => {
  it("covers every policy, skill preset and pack of the default matrix", () => {
    const cells = matrixCells(DEFAULT_MATRIX);

    expect(cells).toHaveLength(4 * 3 * 8);
    expect(
      new Set(
        cells.map(({ pack, player, policy }) => `${policy} ${JSON.stringify(player)} ${pack.name}`),
      ).size,
    ).toBe(cells.length);
    expect(new Set(cells.map(({ gear }) => gear))).toEqual(new Set([null]));
  });

  it("runs each gear as its own cell, after the player and before the pack", () => {
    const rows = simulateMatrix(gameData, 3, 2, {
      ...SMALL,
      gears: [null, "runningShoes"],
      players: [{ hitRate: 0.06, kind: "rates" }],
      policies: ["heartsUnlessLow"],
    });

    expect(rows.map(({ gear, pack }) => [gear, pack])).toEqual([
      ["none", "Koda"],
      ["none", "Risky trio"],
      ["runningShoes", "Koda"],
      ["runningShoes", "Risky trio"],
    ]);
  });

  it("gives a row per walker after each pack, the walker named in its own column", () => {
    const walkers = {
      ...SMALL,
      packs: SMALL.packs.slice(0, 1),
      walkers: ["casey", "trista"] as const,
    };
    const rows = simulateMatrix(gameData, 3, 2, { ...walkers, players: SMALL.players.slice(0, 1) });

    expect(rows.map(({ pack, policy, walker }) => [policy, pack, walker])).toEqual([
      ["heartsUnlessLow", "Koda", "casey"],
      ["heartsUnlessLow", "Koda", "trista"],
      ["alwaysPay", "Koda", "casey"],
      ["alwaysPay", "Koda", "trista"],
    ]);
    expect(formatTable(rows).split("\n")[0]).toMatch(/Pack +Walker/);
  });

  it("gives one row per cell, in policy, player, then pack order", () => {
    const rows = simulateMatrix(gameData, 3, 4, SMALL);

    expect(rows.map(({ pack, player, policy }) => [policy, player, pack])).toEqual([
      ["heartsUnlessLow", "6%", "Koda"],
      ["heartsUnlessLow", "6%", "Risky trio"],
      ["heartsUnlessLow", "15%", "Koda"],
      ["heartsUnlessLow", "15%", "Risky trio"],
      ["alwaysPay", "6%", "Koda"],
      ["alwaysPay", "6%", "Risky trio"],
      ["alwaysPay", "15%", "Koda"],
      ["alwaysPay", "15%", "Risky trio"],
    ]);
    for (const row of rows) {
      expect(row.runs).toBe(4);
      expect(row.p10).toBeLessThanOrEqual(row.p50);
      expect(row.p50).toBeLessThanOrEqual(row.p90);
      expect(row.finishedShare).toBeGreaterThanOrEqual(0);
      expect(row.finishedShare).toBeLessThanOrEqual(1);
    }
  });

  it("gives the same rows for the same seed", () => {
    const first = simulateMatrix(gameData, 5, 3, SMALL);

    expect(simulateMatrix(gameData, 5, 3, SMALL)).toEqual(first);
    expect(simulateMatrix(gameData, 6, 3, SMALL)).not.toEqual(first);
  });

  it("gives a cell the same row whatever else the matrix holds", () => {
    const [alone] = simulateMatrix(gameData, 5, 3, {
      ...SMALL,
      packs: SMALL.packs.slice(1),
      players: [{ hitRate: 0.15, kind: "rates" }],
      policies: ["alwaysPay"],
    });

    expect(simulateMatrix(gameData, 5, 3, SMALL).at(-1)).toEqual(alone);
  });

  it.each([
    { case: "a renamed dog", dogs: [A], otherDogs: [A], otherName: "Renamed", same: true },
    { case: "different dogs", dogs: [A], otherDogs: [B], otherName: undefined, same: false },
    {
      case: "the same dogs in another order",
      dogs: [A, B],
      otherDogs: [B, A],
      otherName: undefined,
      same: false,
    },
  ])(
    "seeds a pack from its dog ids, not its names: $case",
    ({ dogs, otherDogs, otherName, same }) => {
      const pack = (ids: readonly DogId[], rename?: string): NamedPack => ({
        dogs: ids as PackDogs,
        name: ids.map((id) => rename ?? DOGS[id].name).join(" + "),
      });
      const rows = (named: NamedPack) =>
        simulateMatrix(gameData, 5, 3, { ...SMALL, packs: [named] }).map((row) => ({
          ...row,
          pack: "",
        }));

      const expected = expect(rows(pack(otherDogs, otherName)));

      (same ? expected : expected.not).toEqual(rows(pack(dogs)));
    },
  );

  it("measures each share over every run's items that reached the pack", () => {
    const [row] = simulateMatrix(gameData, 3, 2, SMALL);

    expect(row?.kindHitShares.cone).toBe(0.25);
    expect(row?.kindHitShares.hedge).toBeNull();
    expect(row?.moverHitShares["ball:ball-bounce"]).toBe(0.5);
    expect(row?.bumpShare).toBe(2 / 6);
    expect(row?.hitShare).toBeNull();
    expect(row?.meanTips).toBe(6);
  });

  it.each([
    { expected: 0, hitRate: 0.06 },
    { expected: 1, hitRate: 0.5 },
  ])(
    "gives the share of walks with a firing, $expected at hit rate $hitRate",
    ({ expected, hitRate }) => {
      const [row] = simulateMatrix(gameData, 3, 4, {
        ...SMALL,
        players: [{ hitRate, kind: "rates" }],
      });

      expect(row?.firedShare).toBe(expected);
      expect(row?.meanFirings).toBe(expected * 2);
    },
  );

  it("formats a header line and one line per row", () => {
    const rows = simulateMatrix(gameData, 3, 2, SMALL);

    expect(formatTable(rows).split("\n")).toHaveLength(rows.length + 1);
    expect(formatKindTable(gameData, rows).split("\n")).toHaveLength(rows.length + 1);
  });
});

describe("simulateMatrixInBatches", () => {
  it("reports the same rows as simulateMatrix, one row at a time", () => {
    const queue: (() => void)[] = [];
    const reports: (readonly MatrixRow[])[] = [];
    simulateMatrixInBatches(
      gameData,
      3,
      4,
      3,
      (step) => queue.push(step),
      (rows) => reports.push(rows),
      SMALL,
    );
    for (let step = queue.shift(); step !== undefined; step = queue.shift()) {
      step();
    }

    expect(reports.map((rows) => rows.length)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(reports.at(-1)).toEqual(simulateMatrix(gameData, 3, 4, SMALL));
  });

  it("stops when asked", () => {
    const queue: (() => void)[] = [];
    const reports: (readonly MatrixRow[])[] = [];
    const stop = simulateMatrixInBatches(
      gameData,
      3,
      4,
      4,
      (step) => queue.push(step),
      (rows) => reports.push(rows),
      SMALL,
    );
    queue.shift()?.();
    stop();
    for (let step = queue.shift(); step !== undefined; step = queue.shift()) {
      step();
    }

    expect(reports).toHaveLength(1);
  });
});
