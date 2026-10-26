import { DOGS } from "../data/dogs";
import type {
  AchievementCondition,
  DebuffId,
  GameData,
  GearId,
  MinorObstacleId,
  TallyId,
  WalkerId,
} from "../data/types";
import { DEFAULT_WALKER } from "../data/walkers";
import { itemAt } from "../lib/arrays";
import { type AchievementData, conditionHolds, type RunFacts } from "../rules/achievements";
import { isPullObstacle, itemCategory, type WalkItemKind } from "../runner/walk";
import { MAX_RUN_DOGS, TALLY_IDS } from "../save/schema";
import type { PackDogs } from "../state/runState";
import { type Delivered, DELIVERY_GROUPS, sumDeliveries, type ZoneDelivery } from "./delivery";
import { DEFAULT_ROUTE_POLICY, POLICY_IDS, type PolicyId, type RoutePolicyId } from "./policies";
import type { BotSight } from "./sight";
import {
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

// A matrix's player: a steering bot of a skill preset.
export interface MatrixPlayer {
  readonly kind: "skill";
  readonly preset: SkillPresetId;
}

// Every combination of policy, route policy, player, gear, pack and walker is one cell. A null
// gear is a walk with none equipped. sight is how every cell's bot reads movers.
export interface Matrix {
  readonly gears: readonly (GearId | null)[];
  readonly packs: readonly NamedPack[];
  readonly players: readonly MatrixPlayer[];
  readonly policies: readonly PolicyId[];
  readonly routes: readonly RoutePolicyId[];
  readonly sight: BotSight;
  readonly walkers: readonly WalkerId[];
}

interface MatrixCell {
  readonly gear: GearId | null;
  readonly pack: NamedPack;
  readonly player: MatrixPlayer;
  readonly policy: PolicyId;
  readonly route: RoutePolicyId;
  readonly sight: BotSight;
  readonly walker: WalkerId;
}

// Earnings are in cents. Shares are from 0 to 1, of the items that reached the pack, and null
// when none did: hitShare of the obstacles that are encounters, but for pull obstacles such as
// squirrels, which touching does nothing to, and bumpShare of minor obstacles, both moving or
// not, luckyShare of lucky encounters collected, kindHitShares of each kind of obstacle that
// does not move, minor or not, and moverHitShares of each obstacle that moves, minor or not,
// both but pull obstacles.
// meanTips counts the tips collected per run. delivery sums every run's zone plans by walk
// position and zone: what they asked for and what they placed, by group and by kind.
export interface MatrixRow extends BadgeCounters {
  // Of the obstacle hits, minor ones and movers included, those that came right after a pull.
  readonly afterPullShare: number | null;
  readonly bumpShare: number | null;
  readonly delivery: readonly ZoneDelivery[];
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
  // The share of choices that cost money, or null with no choice made.
  readonly moneyShare: number | null;
  readonly moverHitShares: Readonly<Partial<Record<WalkItemKind, number | null>>>;
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

// The counters the badges read, per walk, each judged by the achievements' own condition.
// Shares are of walks, from 0 to 1.
export interface BadgeCounters {
  // Every zone of the walk walked and finished without a landed bump.
  readonly allCleanShare: number;
  // At least one zone walked and finished without a landed bump.
  readonly cleanZoneShare: number;
  // Each debuff: the mean, and the 90th percentile, of the times one walk got it.
  readonly debuffsGot: Readonly<Record<DebuffId, { readonly mean: number; readonly p90: number }>>;
  // A walk finished with every dog of a full pack (MAX_RUN_DOGS) home: the Walk bonus. null for
  // a smaller pack, which never earns it.
  readonly fullPackBonusShare: number | null;
  // A walk finished with a walking owner on their last heart.
  readonly lastHeartShare: number;
  // Landed bumps per walk, by minor obstacle kind.
  readonly meanBumpsByKind: Readonly<Record<MinorObstacleId, number>>;
  // Each lifetime tally's count per walk.
  readonly meanTallies: Readonly<Record<TallyId, number>>;
}

// A pack named by its dogs' names in the data. The name is for display only: the pack's seeds
// are keyed on its dog ids, so renaming a dog changes no result.
function namedByDogs(dogs: PackDogs): NamedPack {
  return { dogs, name: dogs.map((dog) => DOGS[dog].name).join(" + ") };
}

const PACKS: readonly NamedPack[] = [
  namedByDogs(["duchess"]),
  namedByDogs(["biscuit"]),
  namedByDogs(["koda"]),
  namedByDogs(["penny"]),
  namedByDogs(["koda", "biscuit"]),
  namedByDogs(["nugget", "pierre"]),
  namedByDogs(["duchess", "biscuit", "koda"]),
  { dogs: ["zippy", "archie", "snowball"], name: "Risky trio" },
];

const SKILL_PLAYERS: readonly MatrixPlayer[] = SKILL_PRESET_IDS.map((preset) => ({
  kind: "skill",
  preset,
}));

export const DEFAULT_MATRIX: Matrix = {
  gears: [null],
  packs: PACKS,
  players: SKILL_PLAYERS,
  policies: POLICY_IDS,
  routes: [DEFAULT_ROUTE_POLICY],
  sight: "sight",
  walkers: [DEFAULT_WALKER],
};

function gearName(gear: GearId | null): string {
  return gear ?? "none";
}

function playerName(player: MatrixPlayer): string {
  return player.preset;
}

export function matrixCells(matrix: Matrix): MatrixCell[] {
  return matrix.policies.flatMap((policy) =>
    matrix.routes.flatMap((route) =>
      matrix.players.flatMap((player) =>
        matrix.gears.flatMap((gear) =>
          matrix.packs.flatMap((pack) =>
            matrix.walkers.map((walker) => ({
              gear,
              pack,
              player,
              policy,
              route,
              sight: matrix.sight,
              walker,
            })),
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

// The badge counters of a cell's walks, from each walk's facts. packSize is the cell's dogs.
export function badgeCounters(
  data: AchievementData & Pick<GameData, "minorObstacles">,
  packSize: number,
  facts: readonly RunFacts[],
): BadgeCounters {
  const share = (condition: AchievementCondition) =>
    mean(facts.map((walk) => (conditionHolds(data, null, walk, condition) ? 1 : 0)));
  const meanOf = (count: (walk: RunFacts) => number) => mean(facts.map(count));
  const debuffs = Object.keys(data.debuffs) as DebuffId[];
  const kinds = Object.keys(data.minorObstacles) as MinorObstacleId[];
  return {
    allCleanShare: share({ count: "all", kind: "cleanZones" }),
    cleanZoneShare: share({ count: 1, kind: "cleanZones" }),
    debuffsGot: Object.fromEntries(
      debuffs.map((debuff) => {
        const got = facts.map((walk) => walk.debuffsGot[debuff] ?? 0).sort((a, b) => a - b);
        return [debuff, { mean: mean(got), p90: percentile(got, 0.9) }];
      }),
    ) as BadgeCounters["debuffsGot"],
    fullPackBonusShare:
      packSize < MAX_RUN_DOGS ? null : share({ kind: "fullPackBonus", packSize: MAX_RUN_DOGS }),
    lastHeartShare: share({ kind: "finishOnLastHeart" }),
    meanBumpsByKind: Object.fromEntries(
      kinds.map((kind) => [kind, meanOf((walk) => walk.bumpsByKind[kind] ?? 0)]),
    ) as BadgeCounters["meanBumpsByKind"],
    meanTallies: Object.fromEntries(
      TALLY_IDS.map((tally) => [tally, meanOf((walk) => walk.tallies[tally] ?? 0)]),
    ) as BadgeCounters["meanTallies"],
  };
}

function simPlayer(sight: BotSight, player: MatrixPlayer): SimPlayer {
  return { kind: "skill", sight, skill: SKILL_PRESETS[player.preset] };
}

// Run number run of a cell. It is seeded by the seed, the pack's dog ids in pack order and the
// run number alone, so every policy, route policy, player, gear and walker meets the same first
// zone plan and their rows differ by the choices and the play, not by the draw.
function simulateCellRun(data: SimData, seed: number, cell: MatrixCell, run: number): RunResult {
  return simulateRun(data, hashSeed(`${seed}:${cell.pack.dogs.join(",")}:${run}`), {
    gear: cell.gear,
    pack: cell.pack.dogs,
    player: simPlayer(cell.sight, cell.player),
    policy: cell.policy,
    route: cell.route,
    walker: cell.walker,
  });
}

export function simulateCell(
  data: SimData,
  seed: number,
  runsPerCell: number,
  cell: MatrixCell,
): MatrixRow {
  const results = Array.from({ length: runsPerCell }, (_, run) =>
    simulateCellRun(data, seed, cell, run),
  );
  return summarizeCell(data, cell, results);
}

// Every obstacle kind, those that open a card first, then the minor ones, but pull obstacles
// such as squirrels, which touching does nothing to.
function obstacleKinds(data: Pick<GameData, "encounters" | "minorObstacles">): WalkItemKind[] {
  const kinds = [
    ...Object.keys(data.encounters),
    ...Object.keys(data.minorObstacles),
  ] as WalkItemKind[];
  return kinds.filter((kind) => {
    const category = itemCategory(data, kind);
    return (category === "obstacle" || category === "minor") && !isPullObstacle(data, kind);
  });
}

function touchedShare(counts: readonly ItemCount[]): number | null {
  const met = counts.reduce((sum, count) => sum + count.met, 0);
  return met === 0 ? null : counts.reduce((sum, count) => sum + count.touched, 0) / met;
}

function summarizeCell(
  data: AchievementData & Pick<GameData, "minorObstacles">,
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
      kind: mover as WalkItemKind,
      mover: mover as WalkItemKind,
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
    ...badgeCounters(
      data,
      cell.pack.dogs.length,
      results.map((result) => result.facts),
    ),
    afterPullShare: hits === 0 ? null : afterPull / hits,
    bumpShare: touchedShare(countsOf(inCategory("minor"))),
    delivery: sumDeliveries(results.flatMap((result) => result.deliveries)),
    finishedShare: mean(results.map((result) => (result.finished ? 1 : 0))),
    firedShare: mean(results.map((result) => (result.firings.length > 0 ? 1 : 0))),
    gear: gearName(cell.gear),
    hitShare: touchedShare(
      countsOf((entry) => inCategory("obstacle")(entry) && !isPullObstacle(data, entry.kind)),
    ),
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
    meanZones: mean(results.map((result) => result.zones.length)),
    moneyShare:
      choices.length === 0
        ? null
        : choices.filter((choice) => choice.cost > 0).length / choices.length,
    moverHitShares: Object.fromEntries(
      [...new Set(results.flatMap((result) => Object.keys(result.movers) as WalkItemKind[]))]
        .filter((mover) => obstacleKinds(data).includes(mover))
        .sort()
        .map((mover) => [mover, touchedShare(countsOf((entry) => entry.mover === mover))]),
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
  return matrixCells(matrix).map((cell) => simulateCell(data, seed, runsPerCell, cell));
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

// A row's cells as text, in MATRIX_HEADERS order. Player is the skill preset; Hit, Bump and
// Lucky are measured.
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
    row.moneyShare === null ? "-" : percent(row.moneyShare),
    row.meanBadges.toFixed(2),
  ];
}

// A fixed-width text table: the first leftAligned columns left-aligned, the rest right-aligned.
function textTable(
  leftAligned: number,
  headers: readonly string[],
  rows: readonly (readonly string[])[],
): string {
  const lines = [headers, ...rows];
  const widths = headers.map((_, column) =>
    Math.max(...lines.map((line) => itemAt(line, column).length)),
  );
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
  return textTable(6, MATRIX_HEADERS, rows.map(rowCells));
}

// The measured hit rate of each obstacle kind, one column per kind, then of each mover.
export function formatKindTable(
  data: Pick<GameData, "encounters" | "minorObstacles">,
  rows: readonly MatrixRow[],
): string {
  const kinds = obstacleKinds(data);
  // Every kind any row met as a mover, after the kinds standing still.
  const movers = [
    ...new Set(rows.flatMap((row) => Object.keys(row.moverHitShares) as WalkItemKind[])),
  ].sort();
  return textTable(
    6,
    [
      "Policy",
      "Route",
      "Player",
      "Gear",
      "Pack",
      "Walker",
      ...kinds,
      ...movers.map((kind) => `moving ${kind}`),
    ],
    rows.map((row) => [
      row.policy,
      row.route,
      row.player,
      row.gear,
      row.pack,
      row.walker,
      ...kinds.map((kind) => measured(row.kindHitShares[kind] ?? null)),
      ...movers.map((mover) => measured(row.moverHitShares[mover] ?? null)),
    ]),
  );
}

const DELIVERY_HEADERS: Readonly<Record<(typeof DELIVERY_GROUPS)[number], string>> = {
  card: "Card",
  lucky: "Lucky",
  minorDart: "Dart",
  minorOther: "Hop/stalk",
  minorRider: "Rider",
  minorStatic: "Static",
  noCard: "No card",
  tips: "Tips",
  treats: "Treats",
};

// Placed and planned per zone plan, to two decimals, as "placed/planned".
function perPlan(plans: number, count: Delivered): string {
  return `${(count.placed / plans).toFixed(2)}/${(count.planned / plans).toFixed(2)}`;
}

// What the zone plans delivered, summed over every row by walk position and zone: one line per
// zone at a walk position, and for each group the mean placed and planned per plan.
export function formatDeliveryTable(rows: readonly MatrixRow[]): string {
  const sums = sumDeliveries(rows.flatMap((row) => row.delivery));
  return textTable(
    2,
    ["Pos", "Zone", "Plans", ...DELIVERY_GROUPS.map((group) => DELIVERY_HEADERS[group])],
    sums.map((sum) => [
      String(sum.position),
      sum.zone,
      String(sum.plans),
      ...DELIVERY_GROUPS.map((group) => perPlan(sum.plans, sum.groups[group])),
    ]),
  );
}

// The delivery table by kind: one line per kind planned or placed in a zone at a walk position,
// moving or not, with the mean placed and planned per plan.
export function formatDeliveryKindTable(rows: readonly MatrixRow[]): string {
  const sums = sumDeliveries(rows.flatMap((row) => row.delivery));
  return textTable(
    3,
    ["Pos", "Zone", "Kind", "Plans", "Placed/planned"],
    sums.flatMap((sum) =>
      (Object.entries(sum.kinds) as [WalkItemKind, Delivered][])
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([kind, count]) => [
          String(sum.position),
          sum.zone,
          kind,
          String(sum.plans),
          perPlan(sum.plans, count),
        ]),
    ),
  );
}
