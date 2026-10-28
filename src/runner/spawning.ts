import { laneMask } from "../layout/lanes";
import { itemAt, partitionPoint } from "../lib/arrays";
import { randomPick, weightedPick } from "../lib/random";
import { approachOutcomes } from "./approach";
import {
  crossingScroll,
  hasLeftRoad,
  laneAt,
  laneBalanceWeight,
  type LaneSpan,
  type MoverBody,
  type MoverCaps,
  type MoverPath,
  moverPlace,
  type MoverSpec,
  type MoverStand,
  type MoverStep,
  type OnScreen,
  placeMovers,
  type PlannerStreams,
  stopsOnVerge,
} from "./movers";
import { shyOutcomes } from "./shy";
import { nthStretch, rowsWithin, WHOLE_ZONE } from "./stretches";

// What a spawn covers: lanes across, and rows along the road of footprint.cellLength each.
export interface Footprint {
  lanes: number;
  rows: number;
}

export const SINGLE_CELL: Footprint = { lanes: 1, rows: 1 };

// blocksLane marks kinds the pack must steer around, such as obstacles. first marks kinds placed
// before every other, such as the obstacles that open a card, so they are the last skipped. Spawns
// without a footprint take one cell. A lane-blocking mover's spawns block the lanes it sweeps
// instead; one with no room to move waits for the next row with room, or is dropped, unless it is
// marked first, when it stands still in its footprint instead. A mover that blocks no lane, a
// moving prize, only keeps clear the cells it passes through, and stands still in its footprint
// when it has no room to move. moversPassOver marks standing kinds that block no lane and that a
// mover may pass over, such as tips: they keep off the cells standing spawns and moving prizes hold
// and every spot a mover may stand on, not off every cell a mover passes through. moversRestOn
// marks such kinds that may also lie where a mover may end a move and stand, such as tips.
// hitLength is a lane-blocking kind's drawn hit length, which the pack-fit gap measures it by;
// without it, its planned hit length. within is the share of the zone's rows a standing kind's
// spawns are spread over, from and to, each 0 to 1, such as a gear drop held to a third of the
// zone; without it, the whole zone.
export interface SpawnQuota<Kind extends string> {
  blocksLane: boolean;
  count: number;
  first?: boolean;
  footprint?: Footprint;
  hitLength?: number;
  kind: Kind;
  mover?: MoverSpec;
  moversPassOver?: boolean;
  moversRestOn?: boolean;
  within?: readonly [number, number];
}

// The cells a quota's spawns cover: its footprint, or one cell without one.
function quotaFootprint(quota: Pick<SpawnQuota<string>, "footprint">): Footprint {
  return quota.footprint ?? SINGLE_CELL;
}

// Distances are scroll distances in pixels from the start of the zone. A spawn's footprint is
// cellLength per row, and its hit box is planned as the footprint less cellInset at each end, which
// is negative where obstacles are drawn longer than a row; it overlaps the pack over its hit box's
// length plus packLength. A lane is cellLength wide, and a mover's hit box is laneInset inside its
// lane at each side. scrollSpeed (pixels per second), laneMoveSeconds and stepSeconds, the walk's
// step, set how far the pack can steer between rows; pathLaneMoveSeconds, the slowest lane move the
// pack may make in the zone, such as a Muddy pack's, spaces the path's lane changes (packGap).
// sightLength is the road in view above the pack, so the next row shows before the pack has to
// steer for it, and roadLength the whole road in view. reactionSeconds is the time the pack is
// given to react on top of the lane moves it makes between two spawns. maxEmptyRows is the most
// rows in a row that may come on screen with no lane-blocking spawn in view in them. packHitLength
// is the length of the pack's hit boxes, which the pack-fit gap keeps clear. With
// firstContactSeconds, the rows reach back up the road, on the same grid, to the last that meets
// the pack no sooner than that long after the zone starts: rows at negative distances are on the
// road in view as the zone starts. pathStart is the lane the zone's guaranteed path starts in
// (planSpawns). fixedKinds are the zone's fixed obstacles, which a lane-blocking standing spawn of
// one of them with no room is swapped among (planSpawns).
export interface SpawnPlan<Kind extends string> {
  cellInset: number;
  cellLength: number;
  firstContactSeconds?: number;
  fixedKinds: readonly FixedKind<Kind>[];
  laneCount: number;
  laneInset: number;
  laneMoveSeconds: number;
  maxEmptyRows: number;
  minOpenLanes: number;
  minSpacing: number;
  moverCaps: MoverCaps;
  packHitLength: number;
  packLength: number;
  pathLaneMoveSeconds: number;
  pathStart: number;
  quotas: readonly SpawnQuota<Kind>[];
  reactionSeconds: number;
  roadLength: number;
  scrollSpeed: number;
  sightLength: number;
  stepSeconds: number;
  zoneLength: number;
}

// A kind of fixed obstacle in the zone: its footprint, its drawn hit length (SpawnQuota) and its
// weight in the zone's draw.
export interface FixedKind<Kind extends string> {
  footprint: Footprint;
  hitLength?: number;
  kind: Kind;
  weight: number;
}

// lane is the footprint's leftmost lane. A mover's distance is where its cue appears.
export interface SpawnEvent<Kind extends string> {
  distance: number;
  kind: Kind;
  lane: number;
  mover?: MoverPath;
}

// A row of a zone's guaranteed path: the row's distance and the lane the path holds on it.
export interface PathRow {
  distance: number;
  lane: number;
}

// A zone's spawns, sorted by distance, and its guaranteed path, a row for each of its rows.
export interface PlannedSpawns<Kind extends string> {
  events: SpawnEvent<Kind>[];
  path: PathRow[];
}

interface DueSpawns<Kind extends string> {
  due: SpawnEvent<Kind>[];
  pending: readonly SpawnEvent<Kind>[];
}

// Rows minSpacing apart, leaving at least minSpacing clear at both ends of the zone.
export function spawnRowDistances(minSpacing: number, zoneLength: number): number[] {
  if (minSpacing <= 0) {
    throw new Error("minSpacing must be positive");
  }
  // A zone shorter than minSpacing gives a negative length, which Array.from reads as 0.
  const count = Math.floor(zoneLength / minSpacing) - 1;
  return Array.from({ length: count }, (_, i) => (i + 1) * minSpacing);
}

// The rows a zone's spawns stand on: spawnRowDistances, or with firstContactSeconds, the same grid
// reaching back up the road to the last row that meets the pack, at sightLength, no sooner than
// firstContactSeconds after the zone starts, so the zone's end is as before.
export function zoneRows(
  plan: Pick<
    SpawnPlan<string>,
    "firstContactSeconds" | "scrollSpeed" | "sightLength" | "zoneLength"
  >,
  spacing: number,
): number[] {
  const rows = spawnRowDistances(spacing, plan.zoneLength);
  if (plan.firstContactSeconds === undefined) {
    return rows;
  }
  const earliest = plan.firstContactSeconds * plan.scrollSpeed - plan.sightLength;
  const before = Math.floor((spacing - earliest) / spacing + ROUNDING);
  return [...Array.from({ length: before }, (_, i) => spacing * (i + 1 - before)), ...rows];
}

type Geometry = Pick<SpawnPlan<string>, "cellInset" | "cellLength" | "packLength">;

// The length of a hit box rows long.
export function hitLength(geometry: Pick<Geometry, "cellInset" | "cellLength">, rows: number) {
  return rows * geometry.cellLength - 2 * geometry.cellInset;
}

// The scroll distance over which a spawn rows long overlaps the pack.
export function blockingLength(geometry: Geometry, rows: number): number {
  return hitLength(geometry, rows) + geometry.packLength;
}

// How many road lengths of scroll after its cue a mover's contact with the pack is looked for in:
// enough for the slowest rider to reach the pack.
const SCAN_ROADS = 4;

// A rounding error in counting steps and moves.
const ROUNDING = 1e-9;

// The scroll a walk step covers.
function stepLength(plan: SpawnPlan<string>): number {
  return plan.scrollSpeed * plan.stepSeconds;
}

// The scroll a lane move seconds long covers: it lasts whole walk steps.
function laneMoveLength(plan: SpawnPlan<string>, seconds: number): number {
  return Math.ceil(seconds / plan.stepSeconds - ROUNDING) * stepLength(plan);
}

// The scroll the reaction margin covers.
function reactionLength(plan: SpawnPlan<string>): number {
  return plan.reactionSeconds * plan.scrollSpeed;
}

// Rows are minSpacing apart, or, on a road too fast for a lane move between one row's window
// and the next, the fewest whole pixels apart that fit one with its step to spare.
export function rowSpacing(plan: SpawnPlan<string>): number {
  if (plan.laneMoveSeconds <= 0) {
    return plan.minSpacing;
  }
  const oneMove =
    blockingLength(plan, 1) + stepLength(plan) + laneMoveLength(plan, plan.laneMoveSeconds);
  return Math.max(plan.minSpacing, Math.ceil(oneMove - ROUNDING));
}

// The guaranteed path holds each lane for at least PATH_HOLD_ROWS rows, then changes lane with
// PATH_CHANGE_CHANCE at each row, by PATH_MOST_LANES or fewer.
export const PATH_HOLD_ROWS = 2;
const PATH_CHANGE_CHANCE = 0.5;
const PATH_MOST_LANES = 2;

// The most lanes the path changes by at once: as many as the pack fits past (packGap) on the road
// between one-row spawns two rows apart, with the row between them clear, at least one and no
// more than PATH_MOST_LANES. Every row has a window, the distance over which a one-row spawn on it
// overlaps the pack, which must fit between rows, and the next row must be in sight before the
// pack steers for it.
export function pathReach(plan: SpawnPlan<string>): number {
  const spacing = rowSpacing(plan);
  const window = blockingLength(plan, 1);
  if (window > spacing) {
    throw new Error("Rows must be at least a row's blocking length apart, or they overlap");
  }
  if (spacing > window + plan.sightLength) {
    throw new Error("Rows must keep the next row in sight before the pack steers for it");
  }
  const road = 2 * spacing - hitLength(plan, 1);
  const most = Math.min(PATH_MOST_LANES, plan.laneCount - 1);
  let reach = 1;
  while (reach < most && packGap(plan, reach + 1) <= road + ROUNDING) {
    reach += 1;
  }
  return reach;
}

// A lane-blocking spawn as the pack meets it: the distance at which its hit box's near edge
// reaches the pack, its leftmost lane, how many lanes it covers, and the length of road it
// keeps the pack from stepping in behind it: a standing spawn's hit box, or a mover's contact
// with the pack less the pack's length, which is shorter for one faster than the road.
interface BlockingPlace {
  distance: number;
  lane: number;
  lanes: number;
  length: number;
}

// The least clear road, from the far edge of the nearer obstacle's hit box to the near edge of
// the farther one's, across which the path makes changes lane changes between them: the
// pack's hit boxes, the lane moves at the slowest the pack may make them (pathLaneMoveSeconds) and
// the reaction margin, so the pack visibly fits between them.
export function packGap(plan: SpawnPlan<string>, changes: number): number {
  return (
    plan.packHitLength +
    changes * laneMoveLength(plan, plan.pathLaneMoveSeconds) +
    reactionLength(plan)
  );
}

// A change of lane on the path, from the lane it holds on one row to the next row's lane: at is
// halfway between the two rows. The row before a change keeps every lane the change crosses clear
// in its window and gap, so a lane-blocking spawn in those lanes meets the pack before at or after.
export interface PathChange {
  at: number;
  from: number;
  to: number;
}

// The lane moves the pack makes between two lane-blocking spawns as it follows a change of the
// path met between them: as the nearer one passes, the pack is still short of the first lane on
// the way that it blocks, past the lane the path leaves; as the farther one meets it, the pack is
// past the last lane on the way that it blocks, short of the lane the path takes. 0 when either
// blocks no such lane, or the pack can wait between them.
function pathMovesBetween(change: PathChange, near: BlockingPlace, far: BlockingPlace): number {
  const side = Math.sign(change.to - change.from);
  const steps = Math.abs(change.to - change.from);
  const nearMask = laneMask(near.lane, near.lanes);
  const farMask = laneMask(far.lane, far.lanes);
  let nearest = Infinity;
  let farthest = -Infinity;
  for (let step = 0; step <= steps; step++) {
    const bit = 1 << (change.from + side * step);
    if (step > 0 && (nearMask & bit) !== 0) {
      nearest = Math.min(nearest, step);
    }
    if (step < steps && (farMask & bit) !== 0) {
      farthest = Math.max(farthest, step);
    }
  }
  return Math.max(0, farthest - nearest + 2);
}

// True when the pack fits between two lane-blocking spawns along the path: at each change of
// lane the path makes between them, changes sorted by at, the road from the nearer one's hit box
// to the farther one's is at least the packGap for the lane moves made between them
// (pathMovesBetween), never more than PATH_MOST_LANES. Spawns met at once have no change between
// them.
export function packFitsOnPath(
  plan: SpawnPlan<string>,
  changes: readonly PathChange[],
  a: BlockingPlace,
  b: BlockingPlace,
): boolean {
  const [near, far] = a.distance <= b.distance ? [a, b] : [b, a];
  const gap = far.distance - near.distance - near.length;
  if (gap >= packGap(plan, PATH_MOST_LANES) - ROUNDING) {
    return true;
  }
  // The first change past the nearer one.
  const first = partitionPoint((change) => change.at <= near.distance, changes);
  for (let i = first; i < changes.length && itemAt(changes, i).at <= far.distance; i++) {
    const moves = pathMovesBetween(itemAt(changes, i), near, far);
    if (moves > 0 && gap < packGap(plan, moves) - ROUNDING) {
      return false;
    }
  }
  return true;
}

// Adds the lanes of mask to masks' entry at row.
function addLanes(row: number, mask: number, masks: Int32Array): void {
  masks[row] = (masks[row] ?? 0) | mask;
}

function laneTotal(mask: number): number {
  let count = 0;
  for (let rest = mask; rest !== 0; rest &= rest - 1) {
    count += 1;
  }
  return count;
}

interface Cell {
  lane: number;
  row: number;
}

// Lane-blocking spawns this many lanes wide or wider never stand on neighbouring rows: a row is
// left between the rows their hit boxes are on.
export const WIDE_LANES = 3;

// Which rows' windows and gaps a lane-blocking spawn rows long, placed on row, overlaps.
// Rows are spacing apart, so the indexes are counted from distances.
function blockingSpan(plan: SpawnPlan<string>, spacing: number, row: number, rows: number) {
  const window = blockingLength(plan, 1);
  const reach = blockingLength(plan, rows);
  // Window k (k >= row) starts (k - row) * spacing after this row and is overlapped while
  // that is less than reach; gap k starts window after window k.
  const lastRow = row + Math.ceil(reach / spacing) - 1;
  const lastGap = row + Math.ceil((reach - window) / spacing) - 1;
  return { lastGap, lastRow };
}

// Whether every stretch of road between walls, the lanes walls blocks, keeps a lane that darts,
// the lanes the darts sweep, leaves open: a pack anywhere in the stretch can dodge them there.
export function openStretches(laneCount: number, walls: number, darts: number): boolean {
  let stretch = 0;
  for (let lane = 0; lane <= laneCount; lane++) {
    const bit = 1 << lane;
    if (lane === laneCount || (walls & bit) !== 0) {
      if (stretch !== 0 && (stretch & ~darts) === 0) {
        return false;
      }
      stretch = 0;
    } else {
      stretch |= bit;
    }
  }
  return true;
}

// Whether a mover of a motion may take a cell, held by darts or by other spawns or by none: a
// dart one no dart holds, as it may set off over or past cells other spawns hold; a rider one only
// darts hold, as it may pass where a dart crosses; any other mover one nothing holds.
export function moverMayTake(
  motion: MoverPath["motion"],
  heldByDarts: boolean,
  heldByOthers: boolean,
): boolean {
  switch (motion) {
    case "cross":
      return !heldByDarts;
    case "ride":
      return !heldByOthers;
    default:
      return !heldByDarts && !heldByOthers;
  }
}

// A spot where a mover may end a move and stand: the distance a spawn level with it has, and its
// leftmost lane.
interface MoverRest {
  distance: number;
  lane: number;
}

// Every spot a mover whose cue is at cue may end a move and stand: a dart that stops short at its
// stop, and a stepper, hopper or stalker at its last spot, whichever way a stalker or shy hopper
// chooses its moves. A standing mover's travel past the road's scroll is its steps', so its spot
// is its cue less their travel. A rider, a dart that crosses and one that stops on the verge,
// off the road, never stand.
export function moverRests(laneCount: number, cue: number, path: MoverPath): MoverRest[] {
  const last = (lane: number, steps: readonly MoverStep[]): MoverRest => ({
    distance: cue - steps.reduce((sum, step) => sum + step.travel, 0),
    lane: lane + steps.reduce((sum, step) => sum + step.lanes, 0),
  });
  switch (path.motion) {
    case "approach":
      return approachOutcomes(path).map(({ lane, steps }) => last(lane, steps));
    case "cross": {
      if (path.stopAfter === null || stopsOnVerge(laneCount, path)) {
        return [];
      }
      const since = path.warning + crossingScroll(path);
      const place = moverPlace(laneCount, path, since);
      return [{ distance: cue + since - place.travel, lane: laneAt(place.lanePosition) }];
    }
    case "ride":
      return [];
    case "shy":
      return shyOutcomes(path).map(({ lane, steps }) => last(lane, steps));
    default:
      return [last(path.lane, path.steps)];
  }
}

// The guaranteed path, a lane for each row: from pathStart, it holds each lane for at least
// PATH_HOLD_ROWS rows, and on each row after that it changes lane with PATH_CHANGE_CHANCE, to a
// lane drawn evenly among those on the road up to pathReach lanes either way. Every row draws
// twice from the movers stream, whatever the path does there.
function drawPath(streams: PlannerStreams, plan: SpawnPlan<string>, rowCount: number): number[] {
  const most = pathReach(plan);
  const path: number[] = [];
  let lane = plan.pathStart;
  let held = 0;
  for (let row = 0; row < rowCount; row++) {
    const change = streams.movers();
    const pick = streams.movers();
    if (held >= PATH_HOLD_ROWS && change < PATH_CHANGE_CHANCE) {
      const options: number[] = [];
      for (let step = -most; step <= most; step++) {
        if (step !== 0 && lane + step >= 0 && lane + step < plan.laneCount) {
          options.push(lane + step);
        }
      }
      lane = options[Math.floor(pick * options.length)] ?? lane;
      held = 0;
    }
    path.push(lane);
    held += 1;
  }
  return path;
}

// The lanes the path keeps clear in each row's window and the gap after it: its own and, on the
// row before a change, every lane the change crosses.
function pathHeldLanes(path: readonly number[]): Int32Array {
  return Int32Array.from(path, (lane, row) => {
    const next = path[row + 1] ?? lane;
    return laneMask(Math.min(lane, next), Math.abs(next - lane) + 1);
  });
}

// The path's changes of lane, each halfway between the rows it changes between.
function pathChanges(rows: readonly number[], path: readonly number[]): PathChange[] {
  return path.flatMap((from, row) => {
    const to = path[row + 1] ?? from;
    return to === from ? [] : [{ at: (itemAt(rows, row) + itemAt(rows, row + 1)) / 2, from, to }];
  });
}

// The cells a quota's spawns cover.
function quotaArea(quota: Pick<SpawnQuota<string>, "footprint">): number {
  const { lanes: across, rows: length } = quotaFootprint(quota);
  return across * length;
}

// The last row a spawn's hit box is on: its rows' hit length reaches a row's distance.
function lastHitRow(
  plan: SpawnPlan<string>,
  spacing: number,
  cell: Cell,
  footprint: Footprint,
): number {
  return (
    cell.row + Math.max(0, Math.ceil(hitLength(plan, footprint.rows) / spacing - ROUNDING) - 1)
  );
}

// The last row a spawn's cells take: a lane-blocking spawn takes every row whose window it
// overlaps.
function lastRowTaken(
  plan: SpawnPlan<string>,
  spacing: number,
  cell: Cell,
  footprint: Footprint,
  blocksLane: boolean,
): number {
  return blocksLane ? blockingSpan(plan, spacing, cell.row, footprint.rows).lastRow : cell.row;
}

// A lane-blocking standing spawn as the pack meets it, its length in the pack-fit gap its kind's
// drawn hit length.
function blockingPlace(
  plan: SpawnPlan<string>,
  rows: readonly number[],
  quota: Pick<SpawnQuota<string>, "hitLength">,
  cell: Cell,
  footprint: Footprint,
): BlockingPlace {
  return {
    distance: itemAt(rows, cell.row),
    lane: cell.lane,
    lanes: footprint.lanes,
    length: quota.hitLength ?? hitLength(plan, footprint.rows),
  };
}

// A mover quota as placeMovers takes it, with its kind's drawn hit length standing, which one
// stilled for want of room stands at.
interface PlacedMoverQuota<Kind extends string> {
  count: number;
  first: boolean;
  kind: Kind;
  spec: MoverSpec;
  standingLength: number | undefined;
  within?: readonly [number, number];
}

// The quotas of movers that block lanes, or of moving prizes, as placeMovers takes them.
function moverQuotas<Kind extends string>(
  blocking: boolean,
  quotas: readonly SpawnQuota<Kind>[],
): PlacedMoverQuota<Kind>[] {
  return quotas.flatMap(
    ({ blocksLane, count, first, hitLength: standingLength, kind, mover, within }) =>
      mover === undefined || blocksLane !== blocking
        ? []
        : [
            {
              count,
              first: first ?? false,
              kind,
              spec: mover,
              standingLength,
              ...(within === undefined ? {} : { within }),
            },
          ],
  );
}

// The road as placeMovers measures it.
function moverRoadOf(plan: SpawnPlan<string>, spacing: number) {
  return {
    cellLength: plan.cellLength,
    laneCount: plan.laneCount,
    laneInset: plan.laneInset,
    packHitLength: plan.packHitLength,
    packLength: plan.packLength,
    roadLength: plan.roadLength,
    rowSpacing: spacing,
    scrollSpeed: plan.scrollSpeed,
    sightLength: plan.sightLength,
    // The distance over which a one-row spawn on a row overlaps the pack.
    window: blockingLength(plan, 1),
    zoneLength: plan.zoneLength,
  };
}

// The rows that come on screen with a lane-blocking mover in view: of the rows whose windows the
// mover meets the pack in, on its path or any its stalking may take, those that come on screen
// once its body shows, at or below the road's top and not off its side: a cue, or a dart waiting
// at the road's edge, blocks nothing yet. A row comes on screen at its distance, as a standing
// spawn on it does, and a mover meets the pack at its distance from its cue less sightLength, as
// the pixel of scroll it first overlaps it.
function moverRowsInView(
  plan: SpawnPlan<string>,
  rows: readonly number[],
  cue: number,
  path: MoverPath,
  footprint: Footprint,
): number[] {
  const { laneCount } = plan;
  const rowWindow = blockingLength(plan, 1);
  const reach = blockingLength(plan, footprint.rows);
  const inset = plan.laneInset / plan.cellLength;
  const onRoad = (lanePosition: number) =>
    Math.ceil(lanePosition + footprint.lanes - inset) - 1 >= 0 &&
    Math.floor(lanePosition - 1 + inset) + 1 <= laneCount - 1;
  let shows = -1;
  let [start, end] = [Infinity, -Infinity];
  const paths = path.motion === "approach" ? approachOutcomes(path) : [path];
  for (const way of paths) {
    for (let since = 0; since < SCAN_ROADS * plan.roadLength; since++) {
      const place = moverPlace(laneCount, way, since);
      if (shows < 0 && place.solid && place.travel >= 0 && !hasLeftRoad(laneCount, place)) {
        shows = since;
      }
      const meets =
        place.solid &&
        place.travel >= plan.sightLength &&
        place.travel < plan.sightLength + reach &&
        onRoad(place.lanePosition);
      if (meets) {
        start = Math.min(start, cue + since - plan.sightLength);
        end = Math.max(end, cue + since + 1 - plan.sightLength);
      }
    }
  }
  return rows.flatMap((distance, row) =>
    shows >= 0 && distance >= cue + shows && start < distance + rowWindow && end > distance
      ? [row]
      : [],
  );
}

interface Run {
  first: number;
  last: number;
}

// The most quiet rows a run from first to last of rowCount rows may have: maxEmptyRows; half that,
// rounded down, for a run from the zone's first row or to its last, so a run across the road where
// two zones meet keeps near the cap; and none from the first row of a zone whose rows start on the
// road in view, so something meets the pack soon after it starts.
function quietAllowed(
  plan: Pick<SpawnPlan<string>, "firstContactSeconds" | "maxEmptyRows">,
  rowCount: number,
  first: number,
  last: number,
): number {
  if (first === 0 && plan.firstContactSeconds !== undefined) {
    return 0;
  }
  return first === 0 || last === rowCount - 1
    ? Math.floor(plan.maxEmptyRows / 2)
    : plan.maxEmptyRows;
}

// The runs of more quiet rows than they may have, rows that come on screen with nothing
// lane-blocking in view (0 in filled), and how many rows they run over it in all.
function quietRuns(
  plan: Pick<SpawnPlan<string>, "firstContactSeconds" | "maxEmptyRows">,
  filled: Uint8Array,
): { over: number; runs: Run[] } {
  const runs: Run[] = [];
  let over = 0;
  let first = 0;
  for (let row = 0; row <= filled.length; row++) {
    if (row < filled.length && filled[row] === 0) {
      continue;
    }
    const allowed = quietAllowed(plan, filled.length, first, row - 1);
    if (row - first > allowed) {
      runs.push({ first, last: row - 1 });
      over += row - first - allowed;
    }
    first = row + 1;
  }
  return { over, runs };
}

// The standing spawns of quotas in the order they are placed, each the ith of its quota's: the
// kinds take turns, in the order of their spawns' stretches along the zone, so a kind placed later
// still gets cells in every stretch and each keeps its share of what is placed. Within a turn the
// widest kinds go first, then the biggest. Sorting copies leaves the quotas alone; sort is stable,
// so equal kinds keep their order.
function standingTurns<Kind extends string>(
  quotas: readonly SpawnQuota<Kind>[],
): { i: number; quota: SpawnQuota<Kind> }[] {
  const across = (quota: SpawnQuota<Kind>) => quotaFootprint(quota).lanes;
  return [...quotas]
    .sort((a, b) => across(b) - across(a) || quotaArea(b) - quotaArea(a))
    .flatMap((quota, order) => {
      const [from, to] = quota.within ?? WHOLE_ZONE;
      return Array.from({ length: quota.count }, (_, i) => ({
        i,
        middle: from + ((i + 0.5) / quota.count) * (to - from),
        order,
        quota,
      }));
    })
    .sort((a, b) => a.middle - b.middle || a.order - b.order)
    .map(({ i, quota }) => ({ i, quota }));
}

// Every block kept: its first row, the last row whose window and the last whose gap it
// overlaps, and its lanes.
interface Block {
  covered: number;
  lastGap: number;
  lastRow: number;
  row: number;
}

function without<Item>(items: Item[], item: Item): void {
  items.splice(items.indexOf(item), 1);
}

// The lanes the lane-blocking spawns block in each row's window and in the gap after it, the
// blocks kept, and the rows wide ones' hit boxes are on. pathHeld is the lanes the path keeps
// clear in each row's window and gap, a row for each of the zone's rows.
class LaneBlocks {
  private readonly blocks: Block[] = [];
  private readonly blocked: Int32Array;
  private readonly gapBlocked: Int32Array;
  // The lanes darts block in each row's window, and the lanes every other lane-blocking spawn does.
  private readonly dartBlocked: Int32Array;
  private readonly wallBlocked: Int32Array;
  // What a trial block overwrote, by row, to undo it.
  private readonly blockedBefore: Int32Array;
  private readonly gapBefore: Int32Array;
  private readonly dartBefore: Int32Array;
  private readonly wallBefore: Int32Array;
  private readonly pathHeld: Int32Array;
  private readonly plan: SpawnPlan<string>;
  private readonly spacing: number;
  // Rows a wide lane-blocking spawn's hit box is on.
  private readonly wideRows: Uint8Array;

  constructor(plan: SpawnPlan<string>, spacing: number, pathHeld: Int32Array) {
    const rowCount = pathHeld.length;
    this.blocked = new Int32Array(rowCount);
    this.gapBlocked = new Int32Array(rowCount);
    this.dartBlocked = new Int32Array(rowCount);
    this.wallBlocked = new Int32Array(rowCount);
    this.blockedBefore = new Int32Array(rowCount);
    this.gapBefore = new Int32Array(rowCount);
    this.dartBefore = new Int32Array(rowCount);
    this.wallBefore = new Int32Array(rowCount);
    this.pathHeld = pathHeld;
    this.plan = plan;
    this.spacing = spacing;
    this.wideRows = new Uint8Array(rowCount);
  }

  // Blocks the footprint's lanes where they keep clear of the path, leave minOpenLanes open in
  // every window and gap they block and leave each stretch of road open in every window they
  // block (openStretches), counting them as a dart's sweep where dart is set and as a wall
  // otherwise, and undoes the block unless keep is set and they do.
  tryBlock(cell: Cell, footprint: Footprint, keep: boolean, dart = false): boolean {
    const { blocked, gapBlocked, pathHeld, plan } = this;
    const { laneCount, minOpenLanes } = plan;
    const rowCount = pathHeld.length;
    const { lastGap, lastRow } = blockingSpan(plan, this.spacing, cell.row, footprint.rows);
    if (lastRow >= rowCount || lastGap >= rowCount - 1) {
      return false;
    }
    const covered = laneMask(cell.lane, footprint.lanes);
    for (let row = cell.row; row <= Math.max(lastRow, lastGap); row++) {
      if (((pathHeld[row] ?? 0) & covered) !== 0) {
        return false;
      }
    }
    const swept = dart ? this.dartBlocked : this.wallBlocked;
    const sweptBefore = dart ? this.dartBefore : this.wallBefore;
    for (let row = cell.row; row <= lastRow; row++) {
      this.blockedBefore[row] = blocked[row] ?? 0;
      addLanes(row, covered, blocked);
      sweptBefore[row] = swept[row] ?? 0;
      addLanes(row, covered, swept);
    }
    for (let row = cell.row; row <= lastGap; row++) {
      this.gapBefore[row] = gapBlocked[row] ?? 0;
      addLanes(row, covered, gapBlocked);
    }
    let ok = true;
    for (let row = cell.row; ok && row <= lastRow; row++) {
      ok =
        laneCount - laneTotal(blocked[row] ?? 0) >= minOpenLanes &&
        openStretches(laneCount, this.wallBlocked[row] ?? 0, this.dartBlocked[row] ?? 0);
    }
    for (let row = cell.row; ok && row <= lastGap; row++) {
      ok = laneCount - laneTotal(gapBlocked[row] ?? 0) >= minOpenLanes;
    }
    if (ok && keep) {
      this.blocks.push({ covered, lastGap, lastRow, row: cell.row });
    }
    if (!ok || !keep) {
      for (let row = cell.row; row <= lastRow; row++) {
        blocked[row] = this.blockedBefore[row] ?? 0;
        swept[row] = sweptBefore[row] ?? 0;
      }
      for (let row = cell.row; row <= lastGap; row++) {
        gapBlocked[row] = this.gapBefore[row] ?? 0;
      }
    }
    return ok;
  }

  // The block kept last.
  latest(): Block {
    return itemAt(this.blocks, this.blocks.length - 1);
  }

  // Drops a block kept, and recomputes the lanes blocked in the windows and gaps it overlapped
  // from the blocks still kept. The lanes darts and walls sweep stay as they are.
  remove(block: Block): void {
    without(this.blocks, block);
    const first = block.row;
    const last = Math.max(block.lastRow, block.lastGap);
    this.blocked.fill(0, first, last + 1);
    this.gapBlocked.fill(0, first, last + 1);
    for (const kept of this.blocks) {
      for (let row = Math.max(first, kept.row); row <= Math.min(last, kept.lastRow); row++) {
        addLanes(row, kept.covered, this.blocked);
      }
      for (let row = Math.max(first, kept.row); row <= Math.min(last, kept.lastGap); row++) {
        addLanes(row, kept.covered, this.gapBlocked);
      }
    }
  }

  // The longest run of rows through row whose windows leave any one of span's lanes unblocked.
  clearRun(span: LaneSpan, row: number): number {
    const { blocked } = this;
    let best = 0;
    for (let lane = span.first; lane < span.first + span.count; lane++) {
      const bit = 1 << lane;
      let run = 1;
      for (let r = row - 1; r >= 0 && ((blocked[r] ?? 0) & bit) === 0; r--) {
        run += 1;
      }
      for (let r = row + 1; r < blocked.length && ((blocked[r] ?? 0) & bit) === 0; r++) {
        run += 1;
      }
      best = Math.max(best, run);
    }
    return best;
  }

  // Whether no wide spawn's hit box is on rows first to last or a row either side of them.
  clearOfWide(first: number, last: number): boolean {
    return !this.wideRows.subarray(Math.max(0, first - 1), last + 2).includes(1);
  }

  // Marks rows first to last as a wide spawn's (1) or as no longer one's (0).
  markWide(value: 0 | 1, first: number, last: number): void {
    this.wideRows.fill(value, first, last + 1);
  }

  // Saves the blocks kept, the lanes they block and the wide rows, and returns what puts them
  // back. The lanes darts and walls sweep are not saved.
  save(): () => void {
    const blocks = [...this.blocks];
    const arrays = [this.blocked, this.gapBlocked, this.wideRows];
    const copies = arrays.map((array) => array.slice());
    return () => {
      arrays.forEach((array, i) => {
        array.set(itemAt(copies, i));
      });
      this.blocks.splice(0, this.blocks.length, ...blocks);
    };
  }
}

// The lane-blocking spawns placed so far, and every place each mover stands, by distance, which
// the pack must fit between along the path (packFitsOnPath). Two places with more road between
// them than the widest pack gap always fit the pack, so a place is checked only against those
// within longest, the longest length placed, and that gap.
class PlacedPlaces {
  private readonly changes: readonly PathChange[];
  private longest = 0;
  private readonly places: BlockingPlace[] = [];
  private readonly plan: SpawnPlan<string>;
  private readonly widestGap: number;

  constructor(plan: SpawnPlan<string>, changes: readonly PathChange[]) {
    this.changes = changes;
    this.plan = plan;
    this.widestGap = packGap(plan, PATH_MOST_LANES);
  }

  add(place: BlockingPlace): void {
    const { places } = this;
    places.splice(
      partitionPoint((other) => other.distance < place.distance, places),
      0,
      place,
    );
    this.longest = Math.max(this.longest, place.length);
  }

  // True when the pack fits between a place and every place placed.
  fits(place: BlockingPlace): boolean {
    const { places } = this;
    const from = place.distance - this.longest - this.widestGap;
    const to = place.distance + Math.max(0, place.length) + this.widestGap;
    for (let i = partitionPoint((other) => other.distance < from, places); i < places.length; i++) {
      const other = itemAt(places, i);
      if (other.distance > to) {
        return true;
      }
      if (!packFitsOnPath(this.plan, this.changes, place, other)) {
        return false;
      }
    }
    return true;
  }

  // True when the pack fits between each of stands and every place placed, and between each two
  // of stands.
  fitsAll(stands: readonly BlockingPlace[]): boolean {
    return stands.every(
      (stand, i) =>
        this.fits(stand) &&
        stands.slice(i + 1).every((other) => packFitsOnPath(this.plan, this.changes, stand, other)),
    );
  }

  remove(place: BlockingPlace): void {
    without(this.places, place);
  }

  // Saves the places, and returns what puts them back. longest is kept: it only bounds the
  // places checked.
  save(): () => void {
    const places = [...this.places];
    return () => {
      this.places.splice(0, this.places.length, ...places);
    };
  }
}

// Which lanes of each row the zone's spawns take or hold, as lane masks, and how many free cells
// are left. reserved is how many of them are kept for the one-cell spawns and moving prizes still
// to place, which are never skipped.
class SpawnCells {
  reserved: number;
  // Lanes a dart holds.
  private readonly dartHeld: Int32Array;
  // Lanes taken by a standing spawn: a lane-blocking standing spawn may take a cell a mover
  // holds where no mover's body comes (ZonePlanner's clearOfMovers), and a dart then sets off
  // over or past it.
  private readonly heldByStanding: Int32Array;
  private left: number;
  // Lanes a mover holds, a dart or any other: lifting a standing spawn never frees them.
  private readonly moverHeld: Int32Array;
  // Lanes a mover other than a dart holds, which no rider takes.
  private readonly otherMoverHeld: Int32Array;
  // Lanes a moving prize holds, which a spawn a mover may pass over still keeps off.
  private readonly prizeHeld: Int32Array;
  // Lanes where a mover may end a move and stand, which no spawn that blocks no lane takes but
  // one marked moversRestOn.
  private readonly restHeld: Int32Array;
  // Lanes taken by any spawn.
  private readonly taken: Int32Array;

  constructor(rowCount: number, laneCount: number, reserved: number) {
    this.reserved = reserved;
    this.dartHeld = new Int32Array(rowCount);
    this.heldByStanding = new Int32Array(rowCount);
    this.left = rowCount * laneCount;
    this.moverHeld = new Int32Array(rowCount);
    this.otherMoverHeld = new Int32Array(rowCount);
    this.prizeHeld = new Int32Array(rowCount);
    this.restHeld = new Int32Array(rowCount);
    this.taken = new Int32Array(rowCount);
  }

  // Whether taking cells more free cells still leaves those reserved.
  leavesRoom(cells: number): boolean {
    return this.left - cells >= this.reserved;
  }

  // How many of cells are on the zone's rows and not yet taken.
  untaken(cells: readonly Cell[]): number {
    const { taken } = this;
    return cells.filter(
      ({ lane, row }) =>
        row >= 0 && row < taken.length && ((taken[row] ?? 0) & laneMask(lane, 1)) === 0,
    ).length;
  }

  // The lanes of a row a standing spawn of a quota may not take: a lane-blocking one, those
  // another standing spawn holds; one a mover may pass over, those and a moving prize's; any
  // other, every lane taken. One that blocks no lane also may not take a mover's resting spots,
  // unless a mover may rest on it.
  heldFor(row: number, quota: SpawnQuota<string>): number {
    if (quota.blocksLane) {
      return this.heldByStanding[row] ?? 0;
    }
    const held =
      quota.moversPassOver === true
        ? (this.heldByStanding[row] ?? 0) | (this.prizeHeld[row] ?? 0)
        : (this.taken[row] ?? 0);
    return quota.moversRestOn === true ? held : held | (this.restHeld[row] ?? 0);
  }

  // Whether a mover of a motion may take the cell (moverMayTake).
  isFree(motion: MoverPath["motion"], lane: number, row: number): boolean {
    const cell = laneMask(lane, 1);
    return moverMayTake(
      motion,
      ((this.dartHeld[row] ?? 0) & cell) !== 0,
      (((this.heldByStanding[row] ?? 0) | (this.otherMoverHeld[row] ?? 0)) & cell) !== 0,
    );
  }

  // A mover, a dart or any other, takes the cell, when it is on the zone's rows.
  takeMover(dart: boolean, lane: number, row: number): void {
    if (row >= 0 && row < this.taken.length) {
      const cell = laneMask(lane, 1);
      this.take(row, cell);
      addLanes(row, cell, this.moverHeld);
      addLanes(row, cell, dart ? this.dartHeld : this.otherMoverHeld);
    }
  }

  // A moving prize takes the cell as a mover does, and holds it as a prize.
  takePrize(dart: boolean, lane: number, row: number): void {
    this.takeMover(dart, lane, row);
    if (row >= 0 && row < this.taken.length) {
      addLanes(row, laneMask(lane, 1), this.prizeHeld);
    }
  }

  // A standing spawn takes the lanes of mask in row.
  standOn(row: number, mask: number): void {
    this.take(row, mask);
    addLanes(row, mask, this.heldByStanding);
  }

  // A standing spawn leaves the lanes of mask in row, freeing those no mover holds.
  lift(row: number, mask: number): void {
    const { heldByStanding, moverHeld, taken } = this;
    heldByStanding[row] = (heldByStanding[row] ?? 0) & ~mask;
    const freed = mask & (taken[row] ?? 0) & ~(moverHeld[row] ?? 0);
    taken[row] = (taken[row] ?? 0) & ~freed;
    this.left += laneTotal(freed);
  }

  // Holds the lanes of mask in row as a spot where a mover may end a move and stand.
  holdRest(row: number, mask: number): void {
    addLanes(row, mask, this.restHeld);
  }

  // Saves the lanes taken, those standing spawns hold and the count of free and reserved cells,
  // and returns what puts them back.
  save(): () => void {
    const arrays = [this.taken, this.heldByStanding];
    const copies = arrays.map((array) => array.slice());
    const { left, reserved } = this;
    return () => {
      arrays.forEach((array, i) => {
        array.set(itemAt(copies, i));
      });
      this.left = left;
      this.reserved = reserved;
    };
  }

  private take(row: number, mask: number): void {
    this.left -= laneTotal(mask & ~(this.taken[row] ?? 0));
    addLanes(row, mask, this.taken);
  }
}

// A lane-blocking standing spawn placed, with its block, cell, spawn and place for the pack-fit
// gap.
interface Standing<Kind extends string> {
  block: Block;
  cell: Cell;
  event: SpawnEvent<Kind>;
  place: BlockingPlace;
  quota: SpawnQuota<Kind>;
}

// Places a zone's spawns by planSpawns' rules, on the zone's rows and around its drawn path.
class ZonePlanner<Kind extends string> {
  private readonly cells: SpawnCells;
  private readonly events: SpawnEvent<Kind>[] = [];
  private readonly lanes: LaneBlocks;
  // The lane-blocking movers' bodies, as lane masks and distances along the zone.
  private readonly moverBodies: { from: number; lanes: number; to: number }[] = [];
  // The rows that come on screen with a lane-blocking mover in view (moverRowsInView).
  private readonly moverInView: Uint8Array;
  // What is on screen as the lane-blocking movers are placed.
  private readonly onScreen: OnScreen[] = [];
  private readonly places: PlacedPlaces;
  private readonly plan: SpawnPlan<Kind>;
  private readonly rows: readonly number[];
  private readonly spacing: number;
  private readonly standing: Standing<Kind>[] = [];
  private readonly statics: SpawnQuota<Kind>[];
  private readonly streams: PlannerStreams;
  // The plain lane-blocking standing spawns that found no room.
  private readonly unplaced: SpawnQuota<Kind>[] = [];

  constructor(
    streams: PlannerStreams,
    plan: SpawnPlan<Kind>,
    spacing: number,
    rows: readonly number[],
    path: readonly number[],
  ) {
    this.lanes = new LaneBlocks(plan, spacing, pathHeldLanes(path));
    this.moverInView = new Uint8Array(rows.length);
    this.places = new PlacedPlaces(plan, pathChanges(rows, path));
    this.plan = plan;
    this.rows = rows;
    this.spacing = spacing;
    this.statics = plan.quotas.filter((quota) => quota.mover === undefined);
    this.streams = streams;
    const prizes = plan.quotas.filter((quota) => quota.mover !== undefined && !quota.blocksLane);
    const reserved = [...this.statics, ...prizes].reduce(
      (sum, quota) => sum + (quota.mover !== undefined || quotaArea(quota) === 1 ? quota.count : 0),
      0,
    );
    this.cells = new SpawnCells(rows.length, plan.laneCount, reserved);
  }

  // Places every spawn, in the order planSpawns gives, and returns them.
  place(): SpawnEvent<Kind>[] {
    this.placeStanding((quota) => quota.first === true, this.placeMoving(true));
    this.placeMoving(false);
    this.placeStanding((quota) => quota.first !== true && quota.blocksLane, []);
    this.fillQuietRuns();
    const stilledPrizes = this.placePrizes();
    this.holdRests();
    this.placeStanding((quota) => quota.first !== true && !quota.blocksLane, stilledPrizes);
    return this.events;
  }

  // True when a lane-blocking standing spawn's hit box, from its row up the road for its hit
  // length, shares no road with a mover's body in its lanes.
  private clearOfMovers(cell: Cell, footprint: Footprint): boolean {
    const covered = laneMask(cell.lane, footprint.lanes);
    const from = itemAt(this.rows, cell.row);
    const to = from + hitLength(this.plan, footprint.rows);
    return this.moverBodies.every(
      (body) => (body.lanes & covered) === 0 || body.to <= from || to <= body.from,
    );
  }

  private fits(cell: Cell, footprint: Footprint, quota: SpawnQuota<Kind>): boolean {
    const { plan, rows, spacing } = this;
    const { blocksLane } = quota;
    if (cell.lane + footprint.lanes > plan.laneCount) {
      return false;
    }
    const last = lastRowTaken(plan, spacing, cell, footprint, blocksLane);
    if (last >= rows.length) {
      return false;
    }
    const covered = laneMask(cell.lane, footprint.lanes);
    for (let row = cell.row; row <= last; row++) {
      if ((this.cells.heldFor(row, quota) & covered) !== 0) {
        return false;
      }
    }
    const cells = footprint.lanes * (last - cell.row + 1);
    if (footprint.lanes * footprint.rows > 1 && !this.cells.leavesRoom(cells)) {
      return false;
    }
    if (!blocksLane) {
      return true;
    }
    if (!this.clearOfMovers(cell, footprint)) {
      return false;
    }
    if (
      footprint.lanes >= WIDE_LANES &&
      !this.lanes.clearOfWide(cell.row, lastHitRow(plan, spacing, cell, footprint))
    ) {
      return false;
    }
    return (
      this.places.fits(blockingPlace(plan, rows, quota, cell, footprint)) &&
      this.lanes.tryBlock(cell, footprint, false)
    );
  }

  private freeCells(
    quota: SpawnQuota<Kind>,
    footprint: Footprint,
    firstRow: number,
    endRow: number,
  ): Cell[] {
    const cells: Cell[] = [];
    for (let row = firstRow; row < endRow; row++) {
      for (let lane = 0; lane < this.plan.laneCount; lane++) {
        if (this.fits({ lane, row }, footprint, quota)) {
          cells.push({ lane, row });
        }
      }
    }
    return cells;
  }

  // The grid placeMovers places the lane-blocking movers on.
  private moverGrid() {
    const { cells, lanes, places } = this;
    return {
      block: (row: number, span: LaneSpan, rowsBlocked: number, keep: boolean, dart = false) =>
        lanes.tryBlock(
          { lane: span.first, row },
          { lanes: span.count, rows: rowsBlocked },
          keep,
          dart,
        ),
      clearRun: (span: LaneSpan, row: number) => lanes.clearRun(span, row),
      isFree: (motion: MoverPath["motion"], lane: number, row: number) =>
        cells.isFree(motion, lane, row),
      // Only the cells not yet taken use up room: a dart may set off over taken ones.
      leavesRoom: (spots: readonly Cell[]) => cells.leavesRoom(cells.untaken(spots)),
      occupy: ({ from, lanes: span, to }: MoverBody) => {
        this.moverBodies.push({ from, lanes: laneMask(span.first, span.count), to });
      },
      packFits: (stands: readonly MoverStand[]) => places.fitsAll(stands),
      stand: (stands: readonly MoverStand[]) => {
        for (const stand of stands) {
          places.add(stand);
        }
      },
      take: (dart: boolean, lane: number, row: number) => {
        cells.takeMover(dart, lane, row);
      },
    };
  }

  // The grid placeMovers places the moving prizes on. A moving prize keeps its cells clear of
  // other spawns, and nothing else: it blocks no lane, stands nowhere for the pack-fit gap, and
  // counts toward no cap on screen beside the lane-blocking movers.
  private prizeGrid() {
    return {
      ...this.moverGrid(),
      block: () => true,
      occupy: () => {},
      packFits: () => true,
      stand: () => {},
      take: (dart: boolean, lane: number, row: number) => {
        this.cells.takePrize(dart, lane, row);
      },
    };
  }

  // The movers marked first or not; a first mover with no room to move stands still instead,
  // in its footprint, among the first spawns that stand.
  private placeMoving(first: boolean): SpawnQuota<Kind>[] {
    const { plan, rows } = this;
    const quotas = moverQuotas(true, plan.quotas).filter((quota) => quota.first === first);
    const { dropped, spawns } = placeMovers(
      this.streams,
      moverRoadOf(plan, this.spacing),
      plan.moverCaps,
      this.moverGrid(),
      this.onScreen,
      rows,
      quotas,
    );
    this.events.push(...spawns);
    for (const { distance, kind, mover } of spawns) {
      const quota = quotas.find((other) => other.kind === kind);
      const footprint = quota?.spec.footprint ?? SINGLE_CELL;
      for (const row of moverRowsInView(plan, rows, distance, mover, footprint)) {
        this.moverInView[row] = 1;
      }
    }
    return first ? stilledQuotas(true, quotas, dropped) : [];
  }

  // The moving prizes, one quota at a time, sharing what is on screen, so each stilled one keeps
  // its own within. One with no room to move stands still instead, in its footprint, among the
  // other spawns that block no lane.
  private placePrizes(): SpawnQuota<Kind>[] {
    const { plan } = this;
    const road = moverRoadOf(plan, this.spacing);
    const grid = this.prizeGrid();
    const onScreen: OnScreen[] = [];
    return moverQuotas(false, plan.quotas).flatMap((quota) => {
      const { dropped, spawns } = placeMovers(
        this.streams,
        road,
        plan.moverCaps,
        grid,
        onScreen,
        this.rows,
        [quota],
      );
      this.events.push(...spawns);
      return stilledQuotas(false, [quota], dropped);
    });
  }

  // Holds every cell a placed mover may end a move on and stand in: the rows a spawn on which
  // overlaps the mover there, each spawn's hit box planned as hitLength, in the lanes it covers.
  private holdRests(): void {
    const { plan } = this;
    const oneRowHit = hitLength(plan, 1);
    const roadLanes = laneMask(0, plan.laneCount);
    for (const { distance, kind, mover } of this.events) {
      if (mover === undefined) {
        continue;
      }
      const footprint =
        plan.quotas.find((quota) => quota.kind === kind)?.mover?.footprint ?? SINGLE_CELL;
      const length = hitLength(plan, footprint.rows);
      for (const rest of moverRests(plan.laneCount, distance, mover)) {
        const covered = laneMask(rest.lane, footprint.lanes) & roadLanes;
        this.rows.forEach((rowDistance, row) => {
          if (rowDistance > rest.distance - oneRowHit && rowDistance < rest.distance + length) {
            this.cells.holdRest(row, covered);
          }
        });
      }
    }
  }

  // Places the standing spawns of the quotas keep picks, and of stilled, in turns (standingTurns).
  private placeStanding(
    keep: (quota: SpawnQuota<Kind>) => boolean,
    stilled: readonly SpawnQuota<Kind>[],
  ): void {
    for (const { i, quota } of standingTurns([...this.statics, ...stilled].filter(keep))) {
      this.placeOne(quota, i);
    }
  }

  // The cells for the ith of a quota's spawns: those in the ith of its count's equal stretches of
  // the rows it is spread over (within), or else anywhere in those rows. In a zone whose rows
  // start on the road in view, a lane-blocking one first in its stretch takes the zone's first
  // row while that row comes on screen quiet and it fits there, before a spawn placed later on
  // steers across it.
  private cellsFor(quota: SpawnQuota<Kind>, i: number): Cell[] {
    const footprint = quotaFootprint(quota);
    const within = rowsWithin(this.rows.length, quota.within ?? WHOLE_ZONE);
    const opening =
      this.plan.firstContactSeconds !== undefined &&
      quota.blocksLane &&
      i === 0 &&
      this.inView()[0] === 0
        ? this.freeCells(quota, footprint, 0, 1)
        : [];
    const stretch =
      opening.length > 0
        ? opening
        : this.freeCells(quota, footprint, ...nthStretch(quota.count, i, within));
    return stretch.length > 0 ? stretch : this.freeCells(quota, footprint, ...within);
  }

  // One of cells for a spawn: a lane-blocking one toward the lanes left unblocked longest.
  private pickCell(quota: SpawnQuota<Kind>, cells: readonly Cell[]): Cell {
    const across = quotaFootprint(quota).lanes;
    return quota.blocksLane
      ? weightedPick(
          this.streams.spawns,
          cells,
          cells.map((cell) =>
            laneBalanceWeight(this.lanes.clearRun({ count: across, first: cell.lane }, cell.row)),
          ),
        )
      : randomPick(this.streams.spawns, cells);
  }

  // The ith of a quota's spawns, on one of its cells (cellsFor). A fixed obstacle with no room
  // is swapped for a narrower one (placeNarrower); a plain lane-blocking one that still finds
  // none is kept for a quiet stretch.
  private placeOne(quota: SpawnQuota<Kind>, i: number): void {
    const cells = this.cellsFor(quota, i);
    if (cells.length > 0) {
      this.placeAt(quota, this.pickCell(quota, cells));
    } else if (!this.placeNarrower(quota, i) && quota.blocksLane && quota.first !== true) {
      this.unplaced.push(quota);
    }
  }

  // Swaps the ith spawn of a standing quota of a fixed kind, which has no room, for one of the
  // zone's narrower fixed kinds, a lane narrower at a time down to one: at each width, a kind
  // drawn by its weight among those with cells for the spawn (cellsFor), so the road keeps its
  // count of obstacles. No cell is kept for the narrower one, so it also leaves room for the
  // one-cell spawns still to place. True when one is placed.
  private placeNarrower(quota: SpawnQuota<Kind>, i: number): boolean {
    const { plan, spacing } = this;
    if (quota.mover !== undefined || !plan.fixedKinds.some(({ kind }) => kind === quota.kind)) {
      return false;
    }
    for (let across = quotaFootprint(quota).lanes - 1; across >= 1; across--) {
      const fitting = plan.fixedKinds.flatMap(({ footprint, hitLength: length, kind, weight }) => {
        if (footprint.lanes !== across) {
          return [];
        }
        const swapped: SpawnQuota<Kind> = {
          blocksLane: true,
          count: quota.count,
          footprint,
          kind,
          ...(length === undefined ? {} : { hitLength: length }),
        };
        const cells = this.cellsFor(swapped, i).filter((cell) =>
          this.cells.leavesRoom(
            across * (lastRowTaken(plan, spacing, cell, footprint, true) - cell.row + 1),
          ),
        );
        return cells.length > 0 ? [{ cells, swapped, weight }] : [];
      });
      if (fitting.length > 0) {
        const { cells, swapped } = weightedPick(
          this.streams.spawns,
          fitting,
          fitting.map(({ weight }) => weight),
        );
        this.placeAt(swapped, this.pickCell(swapped, cells));
        return true;
      }
    }
    return false;
  }

  // Places a spawn on a cell that fits it. A one-cell spawn of the plan's own takes the cell kept
  // for it.
  private placeAt(quota: SpawnQuota<Kind>, cell: Cell): void {
    const { plan, rows, spacing } = this;
    const footprint = quotaFootprint(quota);
    const lastRow = lastRowTaken(plan, spacing, cell, footprint, quota.blocksLane);
    const covered = laneMask(cell.lane, footprint.lanes);
    for (let row = cell.row; row <= lastRow; row++) {
      this.cells.standOn(row, covered);
    }
    const event = { distance: itemAt(rows, cell.row), kind: quota.kind, lane: cell.lane };
    if (quota.blocksLane) {
      if (footprint.lanes >= WIDE_LANES) {
        this.lanes.markWide(1, cell.row, lastHitRow(plan, spacing, cell, footprint));
      }
      this.lanes.tryBlock(cell, footprint, true);
      const place = blockingPlace(plan, rows, quota, cell, footprint);
      this.places.add(place);
      this.standing.push({ block: this.lanes.latest(), cell, event, place, quota });
    }
    this.events.push(event);
    if (this.statics.includes(quota) && quotaArea(quota) === 1) {
      this.cells.reserved -= 1;
    }
  }

  // A moved spawn takes a cell like any other, but its kept cell, if it had one, is already used.
  private placeMoved(quota: SpawnQuota<Kind>, cell: Cell): void {
    const kept = this.cells.reserved;
    this.placeAt(quota, cell);
    this.cells.reserved = kept;
  }

  // Whether each row comes on screen with a lane-blocking spawn in view: a mover marked in view,
  // or a standing spawn, in view from the moment its first row comes on.
  private inView(): Uint8Array {
    const filled = Uint8Array.from(this.moverInView);
    for (const { block } of this.standing) {
      filled.fill(1, block.row, block.lastRow + 1);
    }
    return filled;
  }

  // Takes a standing spawn off the road, freeing its cells but those a mover holds.
  private lift(lifted: Standing<Kind>): void {
    const { block, cell, event, place, quota } = lifted;
    const footprint = quotaFootprint(quota);
    const covered = laneMask(cell.lane, footprint.lanes);
    for (let row = cell.row; row <= block.lastRow; row++) {
      this.cells.lift(row, covered);
    }
    if (footprint.lanes >= WIDE_LANES) {
      this.lanes.markWide(0, cell.row, lastHitRow(this.plan, this.spacing, cell, footprint));
    }
    this.lanes.remove(block);
    this.places.remove(place);
    without(this.events, event);
    without(this.standing, lifted);
  }

  // Saves what a move changes, and returns what puts it back.
  private save(): () => void {
    const undo = [this.cells.save(), this.lanes.save(), this.places.save()];
    const events = [...this.events];
    const standing = [...this.standing];
    return () => {
      for (const restore of undo) {
        restore();
      }
      this.events.splice(0, this.events.length, ...events);
      this.standing.splice(0, this.standing.length, ...standing);
    };
  }

  // The cells of a quiet run a spawn fits, in the rows that leave no more quiet rows on either
  // side of it than they may have (quietAllowed), or else in any of its rows.
  private cellsIn(quota: SpawnQuota<Kind>, run: Run): Cell[] {
    const { plan, rows, spacing } = this;
    const footprint = quotaFootprint(quota);
    const cells = this.freeCells(quota, footprint, run.first, run.last + 1);
    const splits = cells.filter((cell) => {
      const after = lastRowTaken(plan, spacing, cell, footprint, true) + 1;
      return (
        cell.row - run.first <= quietAllowed(plan, rows.length, run.first, cell.row - 1) &&
        run.last + 1 - after <= quietAllowed(plan, rows.length, after, run.last)
      );
    });
    return splits.length > 0 ? splits : cells;
  }

  // How many rows within maxEmptyRows of a standing spawn come on screen with something else
  // lane-blocking in view.
  private busyness(from: Standing<Kind>): number {
    const { maxEmptyRows } = this.plan;
    const undo = this.save();
    this.lift(from);
    const filled = this.inView();
    undo();
    const first = Math.max(0, from.block.row - maxEmptyRows);
    const last = Math.min(this.rows.length - 1, from.block.lastRow + maxEmptyRows);
    return filled.subarray(first, last + 1).reduce((sum, row) => sum + row, 0);
  }

  // Fills a quiet run with one of the zone's plain standing spawns: one that found no room, or
  // else one moved from the busiest stretch, where the most rows near it come on screen with
  // something else in view; equally busy ones are tried in random order, each into the run as it
  // stands once that spawn is lifted. A move stands only if it leaves fewer rows quiet over the
  // cap in all, counting any it leaves where the spawn stood, which a later move may fill.
  private fillRun(run: Run, over: number): boolean {
    const { plan, streams } = this;
    for (const quota of this.unplaced) {
      const cells = this.cellsIn(quota, run);
      if (cells.length > 0) {
        without(this.unplaced, quota);
        this.placeAt(quota, randomPick(streams.spawns, cells));
        return true;
      }
    }
    const ranked = this.standing
      .filter(({ quota }) => quota.first !== true)
      .map((from) => ({ busy: this.busyness(from), from }));
    while (ranked.length > 0) {
      const busiest = Math.max(...ranked.map(({ busy }) => busy));
      const pick = randomPick(
        streams.spawns,
        ranked.filter(({ busy }) => busy === busiest),
      );
      without(ranked, pick);
      const undo = this.save();
      this.lift(pick.from);
      // The run as it stands with the spawn lifted, longer where the spawn stood beside it.
      const grown =
        quietRuns(plan, this.inView()).runs.find(
          ({ first, last }) => first <= run.first && run.last <= last,
        ) ?? run;
      const cells = this.cellsIn(pick.from.quota, grown);
      if (cells.length > 0) {
        this.placeMoved(pick.from.quota, randomPick(streams.spawns, cells));
        if (quietRuns(plan, this.inView()).over < over) {
          return true;
        }
      }
      undo();
    }
    return false;
  }

  // Fills the quiet runs over the cap, one spawn at a time, until none left can be filled.
  private fillQuietRuns(): void {
    for (;;) {
      const { over, runs } = quietRuns(this.plan, this.inView());
      if (!runs.some((run) => this.fillRun(run, over))) {
        return;
      }
    }
  }
}

// Every spawn takes free cells of a lane-by-row grid, its rows rowSpacing apart (zoneRows). Each
// kind's spawns are spread over equal stretches of the zone, or of the share of it a quota's within
// holds them to, one per stretch, so no kind bunches up. A lane-blocking spawn, standing or moving,
// is drawn among the places that fit toward the lanes left unblocked longest (laneBalanceWeight),
// so no lane stays clear for long. The standing kinds take turns along the zone, the widest first
// in each turn, so each keeps its share of what is placed. Before anything is placed, the zone
// draws its guaranteed path (drawPath), the lanes a pack can follow through it from pathStart.
// Lane-blocking spawns only take cells that keep that path clear: the path's lane stays open in
// every row's window and the gap after it, and on the row before the path changes lane every lane
// the change crosses does too. Each row's window and the gap after it also keep minOpenLanes open.
// In each row's window, no dart sweeps every lane of a stretch of road that the other lane-blocking
// spawns there wall off (openStretches), so a pack anywhere on the road has a lane to dodge a dart
// in without crossing another obstacle. A spawn more than one row long blocks every window and gap
// it overlaps, and must end within the zone's last row. Where the path changes lanes between two
// lane-blocking spawns, packFitsOnPath holds, for a mover wherever it stands, each spawn measured
// at its kind's drawn hit length (hitLength) and the pack at the tallest pack's hit boxes
// (packHitLength). Off the path, nothing else checks a way between spawns. Two lane-blocking spawns
// WIDE_LANES wide or wider have a row between the rows their hit boxes are on. The quotas marked
// first are placed first, their movers then the rest; then the other lane-blocking movers; then the
// other lane-blocking spawns; then the moving prizes; then the other spawns. Movers are placed by
// placeMovers. A dart may set off over cells the spawns placed before it hold, crossing over or
// past them, and a rider may pass over cells only darts hold (moverMayTake). Nothing else placed
// after a mover takes its cells, another dart included, but a lane-blocking standing spawn: one
// where a dart passes, which the dart then crosses over or past the same way, and one whose hit box
// shares no road with any other mover's body, the road that mover's hit box covers at some moment
// on screen, so the two never meet; a mover other than a dart holds every row its blocking and its
// path touch, which is more road than its body. A kind marked moversPassOver also takes a mover's
// cells, but not one where a mover may end a move and stand unless it is also marked moversRestOn.
// A mover with no room in its stretch, such as one over a cap on screen, waits for the next row
// with room; only one marked first stands still in its footprint when no row has room for it to
// move. A moving prize, such as a walking lucky find or a darting squirrel, is placed as a mover
// that blocks nothing: the cells it passes through are kept clear of other spawns placed after it,
// so it never walks into one, but no lane is blocked, it stands nowhere for the pack-fit gap and it
// counts toward no cap on screen beside the lane-blocking movers, since the pack never has to steer
// around it. A darting one may set off over the lane-blocking spawns' cells, as any dart may. It
// keeps a free cell for every moving prize, its own included, and with no room to move it stands
// still in one cell among the other spawns, so a prize is never skipped for want of room to move. A
// spawn that blocks no lane, such as a treat, also keeps off every spot where a mover placed may
// end a move and stand (moverRests), so no mover ever stops on one; a kind marked moversRestOn,
// such as a tip, may lie there. A lane-blocking mover, or an obstacle bigger than one cell, that
// the earlier draws left no room for is skipped, which uses no random draw; so is one that would
// leave fewer free cells than there are one-cell spawns. A free cell can still be one no
// lane-blocking spawn may take, where the path or the pack-fit gap along it rules it out, so a
// one-cell spawn with no room left is skipped too, the same way: a zone never fails to plan for
// want of room. A standing spawn of one of the zone's fixedKinds that finds no room in its stretch
// or anywhere else in the zone is first swapped for a narrower fixed kind, a lane narrower at a
// time, drawn by the kinds' weights among those that fit, and is skipped only when none of any
// narrower width fits. Once the lane-blocking spawns are placed, and before the moving prizes and
// the other spawns, a run of more than maxEmptyRows rows that come on screen with no lane-blocking
// spawn in view, half that, rounded down, from the zone's first row or to its last (none at all
// from the first row of a zone whose rows start on the road in view), gets one of the zone's own
// plain standing spawns: one skipped for want of room, or else one moved from the busiest stretch,
// placed under every rule above, so long as each move leaves fewer such rows in all. A run no spawn
// can take under them, such as one held clear for the path, stays.
export function planSpawns<Kind extends string>(
  streams: PlannerStreams,
  plan: SpawnPlan<Kind>,
): PlannedSpawns<Kind> {
  const spacing = rowSpacing(plan);
  const rows = zoneRows(plan, spacing);
  if (plan.pathStart < 0 || plan.pathStart >= plan.laneCount) {
    throw new Error("The path must start on the road");
  }
  const path = drawPath(streams, plan, rows.length);
  const events = new ZonePlanner(streams, plan, spacing, rows, path).place();
  return {
    events: events.sort((a, b) => a.distance - b.distance || a.lane - b.lane),
    path: path.map((lane, row) => ({ distance: itemAt(rows, row), lane })),
  };
}

// The movers placeMovers dropped, as quotas that stand still in their footprints, one per kind:
// a kind may have several quotas, such as one per stepper. Each keeps its kind's drawn hit length
// standing, which the pack-fit gap measures it by, and its within.
function stilledQuotas<Kind extends string>(
  blocksLane: boolean,
  quotas: readonly {
    readonly first: boolean;
    readonly kind: Kind;
    readonly spec: MoverSpec;
    readonly standingLength: number | undefined;
    readonly within?: readonly [number, number];
  }[],
  dropped: readonly Kind[],
): SpawnQuota<Kind>[] {
  const kinds = new Map(quotas.map((quota) => [quota.kind, quota]));
  return [...kinds.values()].flatMap(({ first, kind, spec, standingLength, within }) => {
    const count = dropped.filter((other) => other === kind).length;
    return count === 0
      ? []
      : [
          {
            blocksLane,
            count,
            first,
            footprint: spec.footprint,
            kind,
            ...(standingLength === undefined ? {} : { hitLength: standingLength }),
            ...(within === undefined ? {} : { within }),
          },
        ];
  });
}

// Spawns become due once the distance travelled reaches them. Most steps have none due, and
// keep the pending list as it is.
export function takeDueSpawns<Kind extends string>(
  distance: number,
  events: readonly SpawnEvent<Kind>[],
): DueSpawns<Kind> {
  if (!events.some((event) => event.distance <= distance)) {
    return { due: [], pending: events };
  }
  return {
    due: events.filter((event) => event.distance <= distance),
    pending: events.filter((event) => event.distance > distance),
  };
}
