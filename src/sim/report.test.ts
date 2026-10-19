import { describe, expect, it, vi } from "vitest";

import { gameData } from "../data";
import {
  DEFAULT_MATRIX,
  formatTable,
  type Matrix,
  matrixCells,
  type MatrixRow,
  simulateMatrix,
  simulateMatrixInBatches,
} from "./report";

// These tests cover how report.ts seeds, orders, batches and summarizes runs, not the runs
// themselves (simulate.test.ts does). A real run costs tens of milliseconds, so a stand-in
// replaces it: like the real one, it draws only from its random, so a seed fixes its result.
vi.mock("./simulate", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./simulate")>();
  const { cents } = await import("../rules/units");
  const simulateRun: typeof actual.simulateRun = (_data, random, config) => ({
    cardsSeen: Math.floor(random() * 10),
    choices: [],
    earnings: cents(random() * 10_000),
    finished: random() >= config.hitRate,
    firings: [],
    moneyShare: 0,
    tips: cents(0),
    upgrades: [],
    zones: [],
    zonesCompleted: 0,
  });
  return { ...actual, simulateRun };
});

const SMALL: Matrix = {
  ...DEFAULT_MATRIX,
  hitRates: [0.06, 0.15],
  packs: [
    { dogs: ["koda"], name: "Koda" },
    { dogs: ["zippy", "dash", "snowball"], name: "Risky trio" },
  ],
  policies: ["heartsUnlessLow", "alwaysPay"],
};

describe("simulateMatrix", () => {
  it("covers every policy, hit rate and pack of the default matrix", () => {
    const cells = matrixCells(DEFAULT_MATRIX);

    expect(cells).toHaveLength(3 * 3 * 6);
    expect(
      new Set(cells.map(({ hitRate, pack, policy }) => `${policy} ${hitRate} ${pack.name}`)).size,
    ).toBe(cells.length);
  });

  it("gives one row per cell, in policy, hit rate, then pack order", () => {
    const rows = simulateMatrix(gameData, 3, 4, SMALL);

    expect(rows.map(({ hitRate, pack, policy }) => [policy, hitRate, pack])).toEqual([
      ["heartsUnlessLow", 0.06, "Koda"],
      ["heartsUnlessLow", 0.06, "Risky trio"],
      ["heartsUnlessLow", 0.15, "Koda"],
      ["heartsUnlessLow", 0.15, "Risky trio"],
      ["alwaysPay", 0.06, "Koda"],
      ["alwaysPay", 0.06, "Risky trio"],
      ["alwaysPay", 0.15, "Koda"],
      ["alwaysPay", 0.15, "Risky trio"],
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
      hitRates: [0.15],
      packs: SMALL.packs.slice(1),
      policies: ["alwaysPay"],
    });

    expect(simulateMatrix(gameData, 5, 3, SMALL).at(-1)).toEqual(alone);
  });

  it("formats a header line and one line per row", () => {
    const rows = simulateMatrix(gameData, 3, 2, SMALL);

    expect(formatTable(rows).split("\n")).toHaveLength(rows.length + 1);
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
