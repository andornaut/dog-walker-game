import { itemAt } from "../arrays";
import type { GameData, GearId } from "../data/types";
import { MOVER_CONTACTS, type MoverKind } from "../runner/movers";
import { seededRandom } from "../runner/random";
import { itemCategory, type WalkItemKind } from "../runner/walk";
import type { PackDogs } from "../state/runState";
import { POLICY_IDS, type PolicyId } from "./policies";
import {
  DEFAULT_RATES,
  type ItemCount,
  type RunResult,
  type SimData,
  type SimPlayer,
  simulateRun,
} from "./simulate";
import { SKILL_PRESET_IDS, SKILL_PRESETS, type SkillPresetId } from "./skills";

export interface NamedPack {
  readonly dogs: PackDogs;
  readonly name: string;
}

// A matrix's player: a fixed obstacle hit rate from 0 to 1, with the matrix's pickup rates,
// or a steering bot of a skill preset.
export type MatrixPlayer =
  | { readonly hitRate: number; readonly kind: "rates" }
  | { readonly kind: "skill"; readonly preset: SkillPresetId };

// Every combination of policy, player and pack is one cell. Rates are chances from 0 to 1,
// for players with a fixed hit rate.
export interface Matrix {
  readonly gear: GearId | null;
  readonly luckyRate: number;
  readonly packs: readonly NamedPack[];
  readonly players: readonly MatrixPlayer[];
  readonly policies: readonly PolicyId[];
  readonly tipRate: number;
  readonly treatRate: number;
}

export interface MatrixCell {
  readonly pack: NamedPack;
  readonly player: MatrixPlayer;
  readonly policy: PolicyId;
}

// Earnings are in cents. Shares are from 0 to 1, of the items that reached the pack, and null
// when none did: hitShare of obstacles that open a card, bumpShare of minor obstacles, both
// moving or not, luckyShare of lucky encounters collected, kindHitShares of each kind of
// obstacle that does not move, minor or not, and moverHitShares of each mover. meanTips counts
// the tips collected per run.
export interface MatrixRow {
  readonly bumpShare: number | null;
  readonly finishedShare: number;
  readonly hitShare: number | null;
  readonly kindHitShares: Readonly<Partial<Record<WalkItemKind, number | null>>>;
  readonly luckyShare: number | null;
  // Achievements a run earns on its own facts, per run.
  readonly meanBadges: number;
  readonly meanCardsSeen: number;
  readonly meanEarnings: number;
  readonly meanFirings: number;
  readonly meanTipCents: number;
  readonly meanTips: number;
  readonly meanZones: number;
  readonly moneyShare: number;
  readonly moverHitShares: Readonly<Partial<Record<MoverKind, number | null>>>;
  readonly p10: number;
  readonly p50: number;
  readonly p90: number;
  readonly pack: string;
  readonly player: string;
  readonly policy: PolicyId;
  readonly runs: number;
}

const PACKS: readonly NamedPack[] = [
  { dogs: ["duchess"], name: "Duchess" },
  { dogs: ["biscuit"], name: "Biscuit" },
  { dogs: ["koda"], name: "Koda" },
  { dogs: ["koda", "biscuit"], name: "Koda + Biscuit" },
  { dogs: ["duchess", "biscuit", "koda"], name: "Starters" },
  { dogs: ["zippy", "archie", "snowball"], name: "Risky trio" },
];

export const SKILL_PLAYERS: readonly MatrixPlayer[] = SKILL_PRESET_IDS.map((preset) => ({
  kind: "skill",
  preset,
}));

export const HIT_RATE_PLAYERS: readonly MatrixPlayer[] = [0.06, 0.1, 0.15].map((hitRate) => ({
  hitRate,
  kind: "rates",
}));

export const DEFAULT_MATRIX: Matrix = {
  gear: null,
  packs: PACKS,
  players: SKILL_PLAYERS,
  policies: POLICY_IDS,
  ...DEFAULT_RATES,
};

export function playerName(player: MatrixPlayer): string {
  return player.kind === "skill" ? player.preset : percent(player.hitRate);
}

export function matrixCells(matrix: Matrix): MatrixCell[] {
  return matrix.policies.flatMap((policy) =>
    matrix.players.flatMap((player) => matrix.packs.map((pack) => ({ pack, player, policy }))),
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

function simPlayer(matrix: Matrix, player: MatrixPlayer): SimPlayer {
  if (player.kind === "skill") {
    return { kind: "skill", skill: SKILL_PRESETS[player.preset] };
  }
  const { luckyRate, tipRate, treatRate } = matrix;
  return { hitRate: player.hitRate, kind: "rates", luckyRate, tipRate, treatRate };
}

// Run number run of a cell. It is seeded by the seed, the pack and the run number alone, so
// every policy and player meets the same first zone plan and their rows differ by the
// choices and the play, not by the draw.
export function simulateCellRun(
  data: SimData,
  seed: number,
  matrix: Matrix,
  cell: MatrixCell,
  run: number,
): RunResult {
  return simulateRun(data, seededRandom(hashSeed(`${seed}:${cell.pack.name}:${run}`)), {
    gear: matrix.gear,
    pack: cell.pack.dogs,
    player: simPlayer(matrix, cell.player),
    policy: cell.policy,
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
  return summarizeCell(data, cell, results);
}

const MOVER_KINDS = Object.keys(MOVER_CONTACTS) as MoverKind[];

// Column names for the movers, apart from the obstacles that stand still.
const MOVER_COLUMNS: Readonly<Record<MoverKind, string>> = {
  ball: "ball",
  cyclist: "cyclist",
  looseDog: "looseDog",
  squirrel: "dartingSquirrel",
};

// Every obstacle kind, those that open a card first, then the minor ones.
export function obstacleKinds(
  data: Pick<GameData, "encounters" | "minorObstacles">,
): WalkItemKind[] {
  const kinds = [
    ...Object.keys(data.encounters),
    ...Object.keys(data.minorObstacles),
  ] as WalkItemKind[];
  return kinds.filter((kind) => {
    const category = itemCategory(data, kind);
    return category === "obstacle" || category === "minor";
  });
}

function touchedShare(counts: readonly ItemCount[]): number | null {
  const met = counts.reduce((sum, count) => sum + count.met, 0);
  return met === 0 ? null : counts.reduce((sum, count) => sum + count.touched, 0) / met;
}

export function summarizeCell(
  data: Pick<GameData, "encounters" | "minorObstacles">,
  cell: MatrixCell,
  results: readonly RunResult[],
): MatrixRow {
  if (results.length === 0) {
    throw new RangeError("A cell needs at least 1 run");
  }
  const earnings = results.map((result) => result.earnings as number).sort((a, b) => a - b);
  const choices = results.flatMap((result) => result.choices);
  // A mover's counts are kept under the kind it meets the pack as, for the shares by category.
  const counted = results.flatMap((result) => [
    ...Object.entries(result.items).map(([kind, count]) => ({
      count,
      kind: kind as WalkItemKind,
      mover: undefined,
    })),
    ...Object.entries(result.movers).map(([mover, count]) => ({
      count,
      kind: MOVER_CONTACTS[mover as MoverKind],
      mover: mover as MoverKind,
    })),
  ]);
  const countsOf = (keep: (entry: (typeof counted)[number]) => boolean) =>
    counted.filter(keep).map(({ count }) => count);
  const inCategory =
    (category: string) =>
    ({ kind }: (typeof counted)[number]) =>
      itemCategory(data, kind) === category;
  return {
    bumpShare: touchedShare(countsOf(inCategory("minor"))),
    finishedShare: mean(results.map((result) => (result.finished ? 1 : 0))),
    hitShare: touchedShare(countsOf(inCategory("obstacle"))),
    kindHitShares: Object.fromEntries(
      obstacleKinds(data).map((kind) => [
        kind,
        touchedShare(countsOf((entry) => entry.mover === undefined && entry.kind === kind)),
      ]),
    ),
    luckyShare: touchedShare(countsOf(inCategory("lucky"))),
    meanBadges: mean(results.map((result) => result.badges.length)),
    meanCardsSeen: mean(results.map((result) => result.cardsSeen)),
    meanEarnings: mean(earnings),
    meanFirings: mean(results.map((result) => result.firings.length)),
    meanTipCents: mean(results.map((result) => result.tips as number)),
    meanTips: mean(results.map((result) => result.items.tip?.touched ?? 0)),
    meanZones: mean(results.map((result) => result.zonesCompleted)),
    moneyShare:
      choices.length === 0
        ? 0
        : choices.filter((choice) => choice.cost > 0).length / choices.length,
    moverHitShares: Object.fromEntries(
      MOVER_KINDS.map((mover) => [mover, touchedShare(countsOf((entry) => entry.mover === mover))]),
    ),
    p10: percentile(earnings, 0.1),
    p50: percentile(earnings, 0.5),
    p90: percentile(earnings, 0.9),
    pack: cell.pack.name,
    player: playerName(cell.player),
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

// A share to one decimal of a percent, or a dash when nothing was met.
function measured(share: number | null): string {
  return share === null ? "-" : `${(share * 100).toFixed(1)}%`;
}

// A row's cells as text, in MATRIX_HEADERS order. Player is the hit rate or skill preset;
// Hit, Bump and Lucky are measured.
export const MATRIX_HEADERS = [
  "Policy",
  "Player",
  "Pack",
  "Hit",
  "Bump",
  "Lucky",
  "Tips",
  "Mean",
  "p10",
  "p50",
  "p90",
  "Fired",
  "Zones",
  "Finished",
  "Cards",
  "Paid",
  "Badges",
] as const;

export function rowCells(row: MatrixRow): string[] {
  return [
    row.policy,
    row.player,
    row.pack,
    measured(row.hitShare),
    measured(row.bumpShare),
    measured(row.luckyShare),
    row.meanTips.toFixed(1),
    dollars(row.meanEarnings),
    dollars(row.p10),
    dollars(row.p50),
    dollars(row.p90),
    row.meanFirings.toFixed(2),
    row.meanZones.toFixed(2),
    percent(row.finishedShare),
    row.meanCardsSeen.toFixed(1),
    percent(row.moneyShare),
    row.meanBadges.toFixed(2),
  ];
}

// A fixed-width text table: the first three columns left-aligned, the rest right-aligned.
function textTable(headers: readonly string[], rows: readonly (readonly string[])[]): string {
  const lines = [headers, ...rows];
  const widths = headers.map((_, column) =>
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

export function formatTable(rows: readonly MatrixRow[]): string {
  return textTable(MATRIX_HEADERS, rows.map(rowCells));
}

// The measured hit rate of each obstacle kind, one column per kind, then of each mover.
export function formatKindTable(
  data: Pick<GameData, "encounters" | "minorObstacles">,
  rows: readonly MatrixRow[],
): string {
  const kinds = obstacleKinds(data);
  return textTable(
    ["Policy", "Player", "Pack", ...kinds, ...MOVER_KINDS.map((mover) => MOVER_COLUMNS[mover])],
    rows.map((row) => [
      row.policy,
      row.player,
      row.pack,
      ...kinds.map((kind) => measured(row.kindHitShares[kind] ?? null)),
      ...MOVER_KINDS.map((mover) => measured(row.moverHitShares[mover] ?? null)),
    ]),
  );
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
      rows.push(summarizeCell(data, cell, results));
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
