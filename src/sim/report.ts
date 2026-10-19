import { itemAt } from "../arrays";
import type { GearId } from "../data/types";
import { seededRandom } from "../runner/random";
import type { PackDogs } from "../state/runState";
import { POLICY_IDS, type PolicyId } from "./policies";
import { DEFAULT_RATES, type RunResult, type SimData, simulateRun } from "./simulate";

export interface NamedPack {
  readonly dogs: PackDogs;
  readonly name: string;
}

// Every combination of policy, hit rate and pack is one cell. Rates are chances from 0 to 1.
export interface Matrix {
  readonly gear: GearId | null;
  readonly hitRates: readonly number[];
  readonly luckyRate: number;
  readonly packs: readonly NamedPack[];
  readonly policies: readonly PolicyId[];
  readonly tipRate: number;
  readonly treatRate: number;
}

export interface MatrixCell {
  readonly hitRate: number;
  readonly pack: NamedPack;
  readonly policy: PolicyId;
}

// Earnings are in cents; shares are from 0 to 1.
export interface MatrixRow {
  readonly finishedShare: number;
  readonly hitRate: number;
  readonly meanCardsSeen: number;
  readonly meanEarnings: number;
  readonly meanFirings: number;
  readonly moneyShare: number;
  readonly p10: number;
  readonly p50: number;
  readonly p90: number;
  readonly pack: string;
  readonly policy: PolicyId;
  readonly runs: number;
}

export const DEFAULT_MATRIX: Matrix = {
  gear: null,
  hitRates: [0.06, 0.1, 0.15],
  packs: [
    { dogs: ["duchess"], name: "Duchess" },
    { dogs: ["biscuit"], name: "Biscuit" },
    { dogs: ["koda"], name: "Koda" },
    { dogs: ["duchess", "biscuit", "koda"], name: "Starters" },
    { dogs: ["zippy", "dash", "snowball"], name: "Risky trio" },
  ],
  policies: POLICY_IDS,
  ...DEFAULT_RATES,
};

export function matrixCells(matrix: Matrix): MatrixCell[] {
  return matrix.policies.flatMap((policy) =>
    matrix.hitRates.flatMap((hitRate) => matrix.packs.map((pack) => ({ hitRate, pack, policy }))),
  );
}

// FNV-1a over the text, as an unsigned 32-bit seed.
function hashSeed(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193);
  }
  return hash >>> 0;
}

// The nearest-rank percentile of sorted values.
function percentile(sorted: readonly number[], fraction: number): number {
  return itemAt(sorted, Math.max(0, Math.ceil(fraction * sorted.length) - 1));
}

const mean = (values: readonly number[]) =>
  values.reduce((sum, value) => sum + value, 0) / values.length;

// Run number run of a cell. It is seeded by the seed, the pack and the run number alone, so
// every policy and hit rate meets the same first zone plan and their rows differ by the
// choices, not by the draw.
export function simulateCellRun(
  data: SimData,
  seed: number,
  matrix: Matrix,
  cell: MatrixCell,
  run: number,
): RunResult {
  return simulateRun(data, seededRandom(hashSeed(`${seed}:${cell.pack.name}:${run}`)), {
    gear: matrix.gear,
    hitRate: cell.hitRate,
    luckyRate: matrix.luckyRate,
    pack: cell.pack.dogs,
    policy: cell.policy,
    tipRate: matrix.tipRate,
    treatRate: matrix.treatRate,
  });
}

export function simulateCell(
  data: SimData,
  seed: number,
  runsPerCell: number,
  matrix: Matrix,
  cell: MatrixCell,
): MatrixRow {
  const results = Array.from({ length: runsPerCell }, (_, run) =>
    simulateCellRun(data, seed, matrix, cell, run),
  );
  return summarizeCell(cell, results);
}

export function summarizeCell(cell: MatrixCell, results: readonly RunResult[]): MatrixRow {
  if (results.length === 0) {
    throw new RangeError("A cell needs at least 1 run");
  }
  const earnings = results.map((result) => result.earnings as number).sort((a, b) => a - b);
  const choices = results.flatMap((result) => result.choices);
  return {
    finishedShare: mean(results.map((result) => (result.finished ? 1 : 0))),
    hitRate: cell.hitRate,
    meanCardsSeen: mean(results.map((result) => result.cardsSeen)),
    meanEarnings: mean(earnings),
    meanFirings: mean(results.map((result) => result.firings.length)),
    moneyShare:
      choices.length === 0
        ? 0
        : choices.filter((choice) => choice.cost > 0).length / choices.length,
    p10: percentile(earnings, 0.1),
    p50: percentile(earnings, 0.5),
    p90: percentile(earnings, 0.9),
    pack: cell.pack.name,
    policy: cell.policy,
    runs: results.length,
  };
}

// One row per cell, in matrix order. The same seed always gives the same rows.
export function simulateMatrix(
  data: SimData,
  seed: number,
  runsPerCell: number,
  matrix: Matrix,
): MatrixRow[] {
  return matrixCells(matrix).map((cell) => simulateCell(data, seed, runsPerCell, matrix, cell));
}

function dollars(cents: number): string {
  return `$${Math.round(cents / 100)}`;
}

function percent(share: number): string {
  return `${Math.round(share * 100)}%`;
}

// A row's cells as text, in MATRIX_HEADERS order.
export const MATRIX_HEADERS = [
  "Policy",
  "Hit",
  "Pack",
  "Mean",
  "p10",
  "p50",
  "p90",
  "Fired",
  "Finished",
  "Cards",
  "Paid",
] as const;

export function rowCells(row: MatrixRow): string[] {
  return [
    row.policy,
    percent(row.hitRate),
    row.pack,
    dollars(row.meanEarnings),
    dollars(row.p10),
    dollars(row.p50),
    dollars(row.p90),
    row.meanFirings.toFixed(2),
    percent(row.finishedShare),
    row.meanCardsSeen.toFixed(1),
    percent(row.moneyShare),
  ];
}

// A fixed-width text table: text columns left-aligned, numbers right-aligned.
export function formatTable(rows: readonly MatrixRow[]): string {
  const lines = [[...MATRIX_HEADERS], ...rows.map(rowCells)];
  const widths = MATRIX_HEADERS.map((_, column) =>
    Math.max(...lines.map((line) => itemAt(line, column).length)),
  );
  const leftAligned = 3;
  return lines
    .map((line) =>
      line
        .map((text, column) =>
          column < leftAligned
            ? text.padEnd(itemAt(widths, column))
            : text.padStart(itemAt(widths, column)),
        )
        .join("  ")
        .trimEnd(),
    )
    .join("\n");
}

// Simulates the matrix runsPerBatch runs at a time, each batch run by schedule (such as a
// zero-delay setTimeout) so a page stays responsive. onRows gets the rows so far each time
// a row completes. The rows match simulateMatrix's. Returns a function that stops it.
export function simulateMatrixInBatches(
  data: SimData,
  seed: number,
  runsPerCell: number,
  runsPerBatch: number,
  schedule: (step: () => void) => void,
  onRows: (rows: readonly MatrixRow[]) => void,
  matrix: Matrix,
): () => void {
  const cells = matrixCells(matrix);
  const rows: MatrixRow[] = [];
  let results: RunResult[] = [];
  let stopped = false;
  const step = () => {
    if (stopped || rows.length === cells.length) {
      return;
    }
    const cell = itemAt(cells, rows.length);
    const end = Math.min(runsPerCell, results.length + runsPerBatch);
    for (let run = results.length; run < end; run++) {
      results.push(simulateCellRun(data, seed, matrix, cell, run));
    }
    if (results.length === runsPerCell) {
      rows.push(summarizeCell(cell, results));
      results = [];
      onRows([...rows]);
    }
    schedule(step);
  };
  schedule(step);
  return () => {
    stopped = true;
  };
}
