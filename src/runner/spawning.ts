import { laneMask } from "../layout/lanes";
import { itemAt, partitionPoint } from "../lib/arrays";
import { approachOutcomes } from "./approach";
import { type MoverCaps, type MoverSpec, type PlannerStreams, stopsOnVerge } from "./moverPlanning";
import { crossingScroll, laneAt, type MoverPath, moverPlace, type MoverStep } from "./movers";
import { shyOutcomes } from "./shy";

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
export function quotaFootprint(quota: Pick<SpawnQuota<string>, "footprint">): Footprint {
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
interface FixedKind<Kind extends string> {
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
export const PATH_MOST_LANES = 2;

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
export interface BlockingPlace {
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
export function addLanes(row: number, mask: number, masks: Int32Array): void {
  masks[row] = (masks[row] ?? 0) | mask;
}

export function laneTotal(mask: number): number {
  let count = 0;
  for (let rest = mask; rest !== 0; rest &= rest - 1) {
    count += 1;
  }
  return count;
}

export interface Cell {
  lane: number;
  row: number;
}

// Lane-blocking spawns this many lanes wide or wider never stand on neighbouring rows: a row is
// left between the rows their hit boxes are on.
export const WIDE_LANES = 3;

// Which rows' windows and gaps a lane-blocking spawn rows long, placed on row, overlaps.
// Rows are spacing apart, so the indexes are counted from distances.
export function blockingSpan(plan: SpawnPlan<string>, spacing: number, row: number, rows: number) {
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
export function drawPath(
  streams: PlannerStreams,
  plan: SpawnPlan<string>,
  rowCount: number,
): number[] {
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
export function pathHeldLanes(path: readonly number[]): Int32Array {
  return Int32Array.from(path, (lane, row) => {
    const next = path[row + 1] ?? lane;
    return laneMask(Math.min(lane, next), Math.abs(next - lane) + 1);
  });
}

// The path's changes of lane, each halfway between the rows it changes between.
export function pathChanges(rows: readonly number[], path: readonly number[]): PathChange[] {
  return path.flatMap((from, row) => {
    const to = path[row + 1] ?? from;
    return to === from ? [] : [{ at: (itemAt(rows, row) + itemAt(rows, row + 1)) / 2, from, to }];
  });
}

// The cells a quota's spawns cover.
export function quotaArea(quota: Pick<SpawnQuota<string>, "footprint">): number {
  const { lanes: across, rows: length } = quotaFootprint(quota);
  return across * length;
}

// The last row a spawn's hit box is on: its rows' hit length reaches a row's distance.
export function lastHitRow(
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
export function lastRowTaken(
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
export function blockingPlace(
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
