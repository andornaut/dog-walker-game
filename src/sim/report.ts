import { itemAt } from "../arrays";
import type { GameData, GearId, WalkerId } from "../data/types";
import { DEFAULT_WALKER } from "../data/walkers";
import { MOVER_CONTACTS, type MoverKind } from "../runner/movers";
import { ALWAYS_MOVERS, itemCategory, type WalkItemKind } from "../runner/walk";
import type { PackDogs } from "../state/runState";
import { DEFAULT_ROUTE_POLICY, POLICY_IDS, type PolicyId, type RoutePolicyId } from "./policies";
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

// Every combination of policy, route policy, player, gear, pack and walker is one cell. Rates
// are chances from 0 to 1, for players with a fixed hit rate. A null gear is a walk with none
// equipped.
export interface Matrix {
  readonly gears: readonly (GearId | null)[];
  readonly luckyRate: number;
  readonly packs: readonly NamedPack[];
  readonly players: readonly MatrixPlayer[];
  readonly policies: readonly PolicyId[];
  readonly routes: readonly RoutePolicyId[];
  readonly tipRate: number;
  readonly treatRate: number;
  readonly walkers: readonly WalkerId[];
}

export interface MatrixCell {
  readonly gear: GearId | null;
  readonly pack: NamedPack;
  readonly player: MatrixPlayer;
  readonly policy: PolicyId;
  readonly route: RoutePolicyId;
  readonly walker: WalkerId;
}

// Earnings are in cents. Shares are from 0 to 1, of the items that reached the pack, and null
// when none did: hitShare of obstacles that open a card, bumpShare of minor obstacles, both
// moving or not, luckyShare of lucky encounters collected, kindHitShares of each kind of
// obstacle that does not move, minor or not, and moverHitShares of each mover. meanTips counts
// the tips collected per run.
export interface MatrixRow {
  // Of the obstacle hits, minor ones and movers included, those that came right after a pull.
  readonly afterPullShare: number | null;
  readonly bumpShare: number | null;
  readonly finishedShare: number;
  // The share of walks with at least one firing.
  readonly firedShare: number;
  // The gear equipped, or none.
  readonly gear: string;
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
  readonly route: RoutePolicyId;
  readonly runs: number;
  readonly walker: WalkerId;
}

const PACKS: readonly NamedPack[] = [
  { dogs: ["duchess"], name: "Duchess" },
  { dogs: ["biscuit"], name: "Biscuit" },
  { dogs: ["koda"], name: "Koda" },
  // Nervous, walked alone, so never clingy: that takes firings.
  { dogs: ["penny"], name: "Penny" },
  { dogs: ["koda", "biscuit"], name: "Koda + Biscuit" },
  // Camera ready and show dog, the quirks no other pack walks.
  { dogs: ["nugget", "pierre"], name: "Nugget + Pierre" },
  { dogs: ["duchess", "biscuit", "koda"], name: "Starters" },
  { dogs: ["zippy", "archie", "snowball"], name: "Risky trio" },
];

export const SKILL_PLAYERS: readonly MatrixPlayer[] = SKILL_PRESET_IDS.map((preset) => ({
  kind: "skill",
  preset,
}));

export const DEFAULT_MATRIX: Matrix = {
  gears: [null],
  packs: PACKS,
  players: SKILL_PLAYERS,
  policies: POLICY_IDS,
  routes: [DEFAULT_ROUTE_POLICY],
  walkers: [DEFAULT_WALKER],
  ...DEFAULT_RATES,
};

export function gearName(gear: GearId | null): string {
  return gear ?? "none";
}

export function playerName(player: MatrixPlayer): string {
  return player.kind === "skill" ? player.preset : percent(player.hitRate);
}

export function matrixCells(matrix: Matrix): MatrixCell[] {
  return matrix.policies.flatMap((policy) =>
    matrix.routes.flatMap((route) =>
      matrix.players.flatMap((player) =>
        matrix.gears.flatMap((gear) =>
          matrix.packs.flatMap((pack) =>
            matrix.walkers.map((walker) => ({ gear, pack, player, policy, route, walker })),
          ),
        ),
      ),
    ),
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
// every policy, route policy, player, gear and walker meets the same first zone plan and their
// rows differ by the choices and the play, not by the draw.
export function simulateCellRun(
  data: SimData,
  seed: number,
  matrix: Matrix,
  cell: MatrixCell,
  run: number,
): RunResult {
  return simulateRun(data, hashSeed(`${seed}:${cell.pack.name}:${run}`), {
    gear: cell.gear,
    pack: cell.pack.dogs,
    player: simPlayer(matrix, cell.player),
    policy: cell.policy,
    route: cell.route,
    walker: cell.walker,
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
  goose: "goose",
  looseDog: "looseDog",
  squirrel: "dartingSquirrel",
};

// Every obstacle kind that can stand still, those that open a card first, then the minor ones.
export function obstacleKinds(
  data: Pick<GameData, "encounters" | "minorObstacles" | "needSpots">,
): WalkItemKind[] {
  const kinds = [
    ...Object.keys(data.encounters),
    ...Object.keys(data.minorObstacles),
  ] as WalkItemKind[];
  return kinds.filter((kind) => {
    const category = itemCategory(data, kind);
    return ALWAYS_MOVERS[kind] === undefined && (category === "obstacle" || category === "minor");
  });
}

function touchedShare(counts: readonly ItemCount[]): number | null {
  const met = counts.reduce((sum, count) => sum + count.met, 0);
  return met === 0 ? null : counts.reduce((sum, count) => sum + count.touched, 0) / met;
}

export function summarizeCell(
  data: Pick<GameData, "encounters" | "minorObstacles" | "needSpots">,
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
  const hits = results.reduce((sum, result) => sum + result.hits.all, 0);
  const afterPull = results.reduce((sum, result) => sum + result.hits.afterPull, 0);
  return {
    afterPullShare: hits === 0 ? null : afterPull / hits,
    bumpShare: touchedShare(countsOf(inCategory("minor"))),
    finishedShare: mean(results.map((result) => (result.finished ? 1 : 0))),
    firedShare: mean(results.map((result) => (result.firings.length > 0 ? 1 : 0))),
    gear: gearName(cell.gear),
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
    route: cell.route,
    runs: results.length,
    walker: cell.walker,
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
  "Route",
  "Player",
  "Gear",
  "Pack",
  "Walker",
  "Hit",
  "Bump",
  "Forced",
  "Lucky",
  "Tips",
  "Mean",
  "p10",
  "p50",
  "p90",
  "Fired",
  "Fired%",
  "Zones",
  "Finished",
  "Cards",
  "Paid",
  "Badges",
] as const;

export function rowCells(row: MatrixRow): string[] {
  return [
    row.policy,
    row.route,
    row.player,
    row.gear,
    row.pack,
    row.walker,
    measured(row.hitShare),
    measured(row.bumpShare),
    measured(row.afterPullShare),
    measured(row.luckyShare),
    row.meanTips.toFixed(1),
    dollars(row.meanEarnings),
    dollars(row.p10),
    dollars(row.p50),
    dollars(row.p90),
    row.meanFirings.toFixed(2),
    percent(row.firedShare),
    row.meanZones.toFixed(2),
    percent(row.finishedShare),
    row.meanCardsSeen.toFixed(1),
    percent(row.moneyShare),
    row.meanBadges.toFixed(2),
  ];
}

// A fixed-width text table: the first six columns left-aligned, the rest right-aligned.
function textTable(headers: readonly string[], rows: readonly (readonly string[])[]): string {
  const lines = [headers, ...rows];
  const widths = headers.map((_, column) =>
    Math.max(...lines.map((line) => itemAt(line, column).length)),
  );
  const leftAligned = 6;
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
  data: Pick<GameData, "encounters" | "minorObstacles" | "needSpots">,
  rows: readonly MatrixRow[],
): string {
  const kinds = obstacleKinds(data);
  return textTable(
    [
      "Policy",
      "Route",
      "Player",
      "Gear",
      "Pack",
      "Walker",
      ...kinds,
      ...MOVER_KINDS.map((mover) => MOVER_COLUMNS[mover]),
    ],
    rows.map((row) => [
      row.policy,
      row.route,
      row.player,
      row.gear,
      row.pack,
      row.walker,
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
