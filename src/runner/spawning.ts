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
  const nearMask = laneRun(near.lane, near.lanes);
  const farMask = laneRun(far.lane, far.lanes);
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
function addLanes(masks: Int32Array, row: number, mask: number): void {
  masks[row] = (masks[row] ?? 0) | mask;
}

// The mask of count lanes from first on.
function laneRun(first: number, count: number): number {
  return ((1 << count) - 1) << first;
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
  const { laneCount, minOpenLanes } = plan;
  const spacing = rowSpacing(plan);
  const rows = zoneRows(plan, spacing);
  // The distance over which a one-row spawn on a row overlaps the pack.
  const rowWindow = blockingLength(plan, 1);
  if (plan.pathStart < 0 || plan.pathStart >= laneCount) {
    throw new Error("The path must start on the road");
  }
  const path = drawPath(streams, plan, rows.length);
  // The lanes the path keeps clear in each row's window and the gap after it: its own and, on the
  // row before a change, every lane the change crosses.
  const pathHeld = Int32Array.from(path, (lane, row) => {
    const next = path[row + 1] ?? lane;
    return laneRun(Math.min(lane, next), Math.abs(next - lane) + 1);
  });
  const changes: PathChange[] = path.flatMap((from, row) => {
    const to = path[row + 1] ?? from;
    return to === from ? [] : [{ at: (itemAt(rows, row) + itemAt(rows, row + 1)) / 2, from, to }];
  });
  // Lane masks per row: lanes taken by a spawn, those of them a dart holds, lanes blocked in the
  // row's window, and lanes blocked in the gap after it.
  const taken = new Int32Array(rows.length);
  const dartHeld = new Int32Array(rows.length);
  // Lanes a mover holds, a dart or any other: lifting a standing spawn never frees them.
  const moverHeld = new Int32Array(rows.length);
  // Lanes a mover other than a dart holds, which no rider takes.
  const otherMoverHeld = new Int32Array(rows.length);
  // Lanes taken by a standing spawn: a lane-blocking standing spawn may take a cell a mover
  // holds where no mover's body comes (clearOfMovers), and a dart then sets off over or past it.
  const heldByStanding = new Int32Array(rows.length);
  // The lane-blocking movers' bodies, as lane masks and distances along the zone.
  const moverBodies: { from: number; lanes: number; to: number }[] = [];
  // True when a lane-blocking standing spawn's hit box, from its row up the road for its hit
  // length, shares no road with a mover's body in its lanes.
  const clearOfMovers = (cell: Cell, footprint: Footprint): boolean => {
    const covered = laneRun(cell.lane, footprint.lanes);
    const from = itemAt(rows, cell.row);
    const to = from + hitLength(plan, footprint.rows);
    return moverBodies.every(
      (body) => (body.lanes & covered) === 0 || body.to <= from || to <= body.from,
    );
  };
  // Lanes where a mover may end a move and stand, which no spawn that blocks no lane takes but
  // one marked moversRestOn.
  const restHeld = new Int32Array(rows.length);
  // Lanes a moving prize holds, which a spawn a mover may pass over still keeps off.
  const prizeHeld = new Int32Array(rows.length);
  const blocked = new Int32Array(rows.length);
  // The lanes darts block in each row's window, and the lanes every other lane-blocking spawn does.
  const dartBlocked = new Int32Array(rows.length);
  const wallBlocked = new Int32Array(rows.length);
  const dartBefore = new Int32Array(rows.length);
  const wallBefore = new Int32Array(rows.length);
  const gapBlocked = new Int32Array(rows.length);
  // What a trial block overwrote, by row, to undo it.
  const blockedBefore = new Int32Array(rows.length);
  const gapBefore = new Int32Array(rows.length);
  const events: SpawnEvent<Kind>[] = [];
  const roadLanes = laneRun(0, laneCount);
  // The lane-blocking spawns placed so far, and every place each mover stands, by distance. Two
  // places with more road between them than the widest pack gap always fit the pack, so a place
  // is checked only against those within longestPlaced, the longest length placed, and that gap.
  const placed: BlockingPlace[] = [];
  let longestPlaced = 0;
  const widestGap = packGap(plan, PATH_MOST_LANES);
  const addPlaced = (place: BlockingPlace) => {
    placed.splice(
      partitionPoint((other) => other.distance < place.distance, placed),
      0,
      place,
    );
    longestPlaced = Math.max(longestPlaced, place.length);
  };
  // True when the pack fits between a place and every place placed along the path
  // (packFitsOnPath).
  const fitsPlaced = (place: BlockingPlace): boolean => {
    const from = place.distance - longestPlaced - widestGap;
    const to = place.distance + Math.max(0, place.length) + widestGap;
    for (let i = partitionPoint((other) => other.distance < from, placed); i < placed.length; i++) {
      const other = itemAt(placed, i);
      if (other.distance > to) {
        return true;
      }
      if (!packFitsOnPath(plan, changes, place, other)) {
        return false;
      }
    }
    return true;
  };
  // Rows a wide lane-blocking spawn's hit box is on.
  const wideRows = new Uint8Array(rows.length);
  // The last row a spawn's hit box is on: its rows' hit length reaches a row's distance.
  const lastHitRow = (cell: Cell, footprint: Footprint): number =>
    cell.row + Math.max(0, Math.ceil(hitLength(plan, footprint.rows) / spacing - ROUNDING) - 1);
  const clearOfWide = (first: number, last: number): boolean =>
    !wideRows.subarray(Math.max(0, first - 1), last + 2).includes(1);

  // The longest run of rows through row whose windows leave any one of span's lanes unblocked.
  const clearRun = (span: LaneSpan, row: number): number => {
    let best = 0;
    for (let lane = span.first; lane < span.first + span.count; lane++) {
      const bit = 1 << lane;
      let run = 1;
      for (let r = row - 1; r >= 0 && ((blocked[r] ?? 0) & bit) === 0; r--) {
        run += 1;
      }
      for (let r = row + 1; r < rows.length && ((blocked[r] ?? 0) & bit) === 0; r++) {
        run += 1;
      }
      best = Math.max(best, run);
    }
    return best;
  };

  const area = (quota: SpawnQuota<Kind>) => {
    const { lanes: across, rows: length } = quotaFootprint(quota);
    return across * length;
  };
  const statics = plan.quotas.filter((quota) => quota.mover === undefined);
  const prizes = plan.quotas.filter((quota) => quota.mover !== undefined && !quota.blocksLane);
  // One-cell spawns and moving prizes are never skipped, so the others keep a free cell for each
  // of them still to place.
  let reserved = [...statics, ...prizes].reduce(
    (sum, quota) => sum + (quota.mover !== undefined || area(quota) === 1 ? quota.count : 0),
    0,
  );
  let cellsLeft = rows.length * laneCount;
  const leavesRoom = (cells: number) => cellsLeft - cells >= reserved;
  const takeCells = (row: number, mask: number) => {
    cellsLeft -= laneTotal(mask & ~(taken[row] ?? 0));
    addLanes(taken, row, mask);
  };

  // Every block kept: its first row, the last row whose window and the last whose gap it
  // overlaps, and its lanes.
  interface Block {
    covered: number;
    lastGap: number;
    lastRow: number;
    row: number;
  }
  const blocks: Block[] = [];

  // Blocks the footprint's lanes where they keep clear of the path, leave minOpenLanes open in
  // every window and gap they block and leave each stretch of road open in every window they
  // block (openStretches), counting them as a dart's sweep where dart is set and as a wall
  // otherwise, and undoes the block unless keep is set and they do.
  const tryBlock = (cell: Cell, footprint: Footprint, keep: boolean, dart = false): boolean => {
    const { lastGap, lastRow } = blockingSpan(plan, spacing, cell.row, footprint.rows);
    if (lastRow >= rows.length || lastGap >= rows.length - 1) {
      return false;
    }
    const covered = laneRun(cell.lane, footprint.lanes);
    for (let row = cell.row; row <= Math.max(lastRow, lastGap); row++) {
      if (((pathHeld[row] ?? 0) & covered) !== 0) {
        return false;
      }
    }
    const swept = dart ? dartBlocked : wallBlocked;
    const sweptBefore = dart ? dartBefore : wallBefore;
    for (let row = cell.row; row <= lastRow; row++) {
      blockedBefore[row] = blocked[row] ?? 0;
      addLanes(blocked, row, covered);
      sweptBefore[row] = swept[row] ?? 0;
      addLanes(swept, row, covered);
    }
    for (let row = cell.row; row <= lastGap; row++) {
      gapBefore[row] = gapBlocked[row] ?? 0;
      addLanes(gapBlocked, row, covered);
    }
    let ok = true;
    for (let row = cell.row; ok && row <= lastRow; row++) {
      ok =
        laneCount - laneTotal(blocked[row] ?? 0) >= minOpenLanes &&
        openStretches(laneCount, wallBlocked[row] ?? 0, dartBlocked[row] ?? 0);
    }
    for (let row = cell.row; ok && row <= lastGap; row++) {
      ok = laneCount - laneTotal(gapBlocked[row] ?? 0) >= minOpenLanes;
    }
    if (ok && keep) {
      blocks.push({ covered, lastGap, lastRow, row: cell.row });
    }
    if (!ok || !keep) {
      for (let row = cell.row; row <= lastRow; row++) {
        blocked[row] = blockedBefore[row] ?? 0;
        swept[row] = sweptBefore[row] ?? 0;
      }
      for (let row = cell.row; row <= lastGap; row++) {
        gapBlocked[row] = gapBefore[row] ?? 0;
      }
    }
    return ok;
  };

  // The last row a spawn's cells take: a lane-blocking spawn takes every row whose window it
  // overlaps.
  const lastRowTaken = (cell: Cell, footprint: Footprint, blocksLane: boolean): number =>
    blocksLane ? blockingSpan(plan, spacing, cell.row, footprint.rows).lastRow : cell.row;

  // The lanes of a row a standing spawn of a quota may not take: a lane-blocking one, those
  // another standing spawn holds; one a mover may pass over, those and a moving prize's; any
  // other, every lane taken. One that blocks no lane also may not take a mover's resting spots,
  // unless a mover may rest on it.
  const heldFor = (row: number, quota: SpawnQuota<Kind>): number => {
    if (quota.blocksLane) {
      return heldByStanding[row] ?? 0;
    }
    const held =
      quota.moversPassOver === true
        ? (heldByStanding[row] ?? 0) | (prizeHeld[row] ?? 0)
        : (taken[row] ?? 0);
    return quota.moversRestOn === true ? held : held | (restHeld[row] ?? 0);
  };

  // A lane-blocking standing spawn as the pack meets it, its length in the pack-fit gap its
  // kind's drawn hit length.
  const blockingPlace = (quota: SpawnQuota<Kind>, cell: Cell, footprint: Footprint) => ({
    distance: itemAt(rows, cell.row),
    lane: cell.lane,
    lanes: footprint.lanes,
    length: quota.hitLength ?? hitLength(plan, footprint.rows),
  });
  const fits = (cell: Cell, footprint: Footprint, quota: SpawnQuota<Kind>): boolean => {
    const { blocksLane } = quota;
    if (cell.lane + footprint.lanes > laneCount) {
      return false;
    }
    const last = lastRowTaken(cell, footprint, blocksLane);
    if (last >= rows.length) {
      return false;
    }
    const covered = laneRun(cell.lane, footprint.lanes);
    for (let row = cell.row; row <= last; row++) {
      const held = heldFor(row, quota);
      if ((held & covered) !== 0) {
        return false;
      }
    }
    const cells = footprint.lanes * (last - cell.row + 1);
    if (footprint.lanes * footprint.rows > 1 && !leavesRoom(cells)) {
      return false;
    }
    if (!blocksLane) {
      return true;
    }
    if (!clearOfMovers(cell, footprint)) {
      return false;
    }
    if (footprint.lanes >= WIDE_LANES && !clearOfWide(cell.row, lastHitRow(cell, footprint))) {
      return false;
    }
    return fitsPlaced(blockingPlace(quota, cell, footprint)) && tryBlock(cell, footprint, false);
  };

  const freeCells = (
    quota: SpawnQuota<Kind>,
    footprint: Footprint,
    firstRow: number,
    endRow: number,
  ): Cell[] => {
    const cells: Cell[] = [];
    for (let row = firstRow; row < endRow; row++) {
      for (let lane = 0; lane < laneCount; lane++) {
        if (fits({ lane, row }, footprint, quota)) {
          cells.push({ lane, row });
        }
      }
    }
    return cells;
  };

  // The movers that block lanes, or the moving prizes, as placeMovers takes them, each with its
  // kind's drawn hit length standing, which one stilled for want of room stands at.
  const moverQuotas = (blocking: boolean) =>
    plan.quotas.flatMap(
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
  const movers = moverQuotas(true);
  const moverGrid = {
    block: (row: number, span: LaneSpan, rowsBlocked: number, keep: boolean, dart = false) =>
      tryBlock({ lane: span.first, row }, { lanes: span.count, rows: rowsBlocked }, keep, dart),
    clearRun,
    isFree: (motion: MoverPath["motion"], lane: number, row: number) => {
      const cell = laneRun(lane, 1);
      return moverMayTake(
        motion,
        ((dartHeld[row] ?? 0) & cell) !== 0,
        (((heldByStanding[row] ?? 0) | (otherMoverHeld[row] ?? 0)) & cell) !== 0,
      );
    },
    // Only the cells not yet taken use up room: a dart may set off over taken ones.
    leavesRoom: (cells: readonly Cell[]) =>
      leavesRoom(
        cells.filter(
          ({ lane, row }) =>
            row >= 0 && row < rows.length && ((taken[row] ?? 0) & laneRun(lane, 1)) === 0,
        ).length,
      ),
    occupy: ({ from, lanes: span, to }: MoverBody) => {
      moverBodies.push({ from, lanes: laneRun(span.first, span.count), to });
    },
    packFits: (stands: readonly MoverStand[]) =>
      stands.every(
        (stand, i) =>
          fitsPlaced(stand) &&
          stands.slice(i + 1).every((other) => packFitsOnPath(plan, changes, stand, other)),
      ),
    stand: (stands: readonly MoverStand[]) => {
      stands.forEach(addPlaced);
    },
    take: (dart: boolean, lane: number, row: number) => {
      if (row >= 0 && row < rows.length) {
        const cell = laneRun(lane, 1);
        takeCells(row, cell);
        addLanes(moverHeld, row, cell);
        addLanes(dart ? dartHeld : otherMoverHeld, row, cell);
      }
    },
  };
  const moverRoad = {
    cellLength: plan.cellLength,
    laneCount,
    laneInset: plan.laneInset,
    packHitLength: plan.packHitLength,
    packLength: plan.packLength,
    roadLength: plan.roadLength,
    rowSpacing: spacing,
    scrollSpeed: plan.scrollSpeed,
    sightLength: plan.sightLength,
    window: rowWindow,
    zoneLength: plan.zoneLength,
  };
  const onScreen: OnScreen[] = [];
  // The movers marked first or not; a first mover with no room to move stands still instead,
  // in its footprint, among the first spawns that stand.
  const placeMoving = (first: boolean): SpawnQuota<Kind>[] => {
    const quotas = movers.filter((quota) => quota.first === first);
    const { dropped, spawns } = placeMovers(
      streams,
      moverRoad,
      plan.moverCaps,
      moverGrid,
      onScreen,
      rows,
      quotas,
    );
    events.push(...spawns);
    for (const { distance, kind, mover } of spawns) {
      const quota = quotas.find((other) => other.kind === kind);
      markInView(distance, mover, quota?.spec.footprint ?? SINGLE_CELL);
    }
    return first ? stilledQuotas(true, quotas, dropped) : [];
  };
  // A moving prize keeps its cells clear of other spawns, and nothing else: it blocks no lane,
  // stands nowhere for the pack-fit gap, and counts toward no cap on screen beside the
  // lane-blocking movers. One with no room to move stands still instead, in its footprint, among
  // the other spawns that block no lane.
  const prizeGrid = {
    ...moverGrid,
    block: () => true,
    occupy: () => {},
    packFits: () => true,
    stand: () => {},
    take: (dart: boolean, lane: number, row: number) => {
      moverGrid.take(dart, lane, row);
      if (row >= 0 && row < rows.length) {
        addLanes(prizeHeld, row, laneRun(lane, 1));
      }
    },
  };
  // One quota at a time, sharing what is on screen, so each stilled one keeps its own within.
  const placePrizes = (): SpawnQuota<Kind>[] => {
    const onScreen: OnScreen[] = [];
    return moverQuotas(false).flatMap((quota) => {
      const { dropped, spawns } = placeMovers(
        streams,
        moverRoad,
        plan.moverCaps,
        prizeGrid,
        onScreen,
        rows,
        [quota],
      );
      events.push(...spawns);
      return stilledQuotas(false, [quota], dropped);
    });
  };
  // Holds every cell a placed mover may end a move on and stand in: the rows a spawn on which
  // overlaps the mover there, each spawn's hit box planned as hitLength, in the lanes it covers.
  const holdRests = () => {
    const oneRowHit = hitLength(plan, 1);
    for (const { distance, kind, mover } of events) {
      if (mover === undefined) {
        continue;
      }
      const footprint =
        plan.quotas.find((quota) => quota.kind === kind)?.mover?.footprint ?? SINGLE_CELL;
      const length = hitLength(plan, footprint.rows);
      for (const rest of moverRests(laneCount, distance, mover)) {
        const covered = laneRun(rest.lane, footprint.lanes) & roadLanes;
        rows.forEach((rowDistance, row) => {
          if (rowDistance > rest.distance - oneRowHit && rowDistance < rest.distance + length) {
            addLanes(restHeld, row, covered);
          }
        });
      }
    }
  };
  // The kinds take turns, in the order of their spawns' stretches along the zone, so a kind
  // placed later still gets cells in every stretch and each keeps its share of what is placed.
  // Within a turn the widest kinds go first, then the biggest. Sorting copies leaves the plan
  // alone; sort is stable, so equal kinds keep their order.
  const placeStanding = (
    keep: (quota: SpawnQuota<Kind>) => boolean,
    stilled: readonly SpawnQuota<Kind>[],
  ) => {
    const across = (quota: SpawnQuota<Kind>) => quotaFootprint(quota).lanes;
    const ordered = [...statics, ...stilled]
      .filter(keep)
      .sort((a, b) => across(b) - across(a) || area(b) - area(a));
    ordered
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
      .forEach(({ i, quota }) => placeOne(quota, i));
  };
  // The cells for the ith of a quota's spawns: those in the ith of its count's equal stretches of
  // the rows it is spread over (within), or else anywhere in those rows. In a zone whose rows
  // start on the road in view, a lane-blocking one first in its stretch takes the zone's first
  // row while that row comes on screen quiet and it fits there, before a spawn placed later on
  // steers across it.
  const cellsFor = (quota: SpawnQuota<Kind>, i: number): Cell[] => {
    const footprint = quotaFootprint(quota);
    const within = rowsWithin(rows.length, quota.within ?? WHOLE_ZONE);
    const opening =
      plan.firstContactSeconds !== undefined && quota.blocksLane && i === 0 && inView()[0] === 0
        ? freeCells(quota, footprint, 0, 1)
        : [];
    const stretch =
      opening.length > 0
        ? opening
        : freeCells(quota, footprint, ...nthStretch(quota.count, i, within));
    return stretch.length > 0 ? stretch : freeCells(quota, footprint, ...within);
  };
  // One of cells for a spawn: a lane-blocking one toward the lanes left unblocked longest.
  const pickCell = (quota: SpawnQuota<Kind>, cells: readonly Cell[]): Cell => {
    const across = quotaFootprint(quota).lanes;
    return quota.blocksLane
      ? weightedPick(
          streams.spawns,
          cells,
          cells.map((cell) =>
            laneBalanceWeight(clearRun({ count: across, first: cell.lane }, cell.row)),
          ),
        )
      : randomPick(streams.spawns, cells);
  };
  // The ith of a quota's spawns, on one of its cells (cellsFor). A fixed obstacle with no room
  // is swapped for a narrower one (placeNarrower); a plain lane-blocking one that still finds
  // none is kept for a quiet stretch.
  const placeOne = (quota: SpawnQuota<Kind>, i: number) => {
    const cells = cellsFor(quota, i);
    if (cells.length > 0) {
      placeAt(quota, pickCell(quota, cells));
    } else if (!placeNarrower(quota, i) && quota.blocksLane && quota.first !== true) {
      unplaced.push(quota);
    }
  };
  // Swaps the ith spawn of a standing quota of a fixed kind, which has no room, for one of the
  // zone's narrower fixed kinds, a lane narrower at a time down to one: at each width, a kind
  // drawn by its weight among those with cells for the spawn (cellsFor), so the road keeps its
  // count of obstacles. No cell is kept for the narrower one, so it also leaves room for the
  // one-cell spawns still to place. True when one is placed.
  const placeNarrower = (quota: SpawnQuota<Kind>, i: number): boolean => {
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
        const cells = cellsFor(swapped, i).filter((cell) =>
          leavesRoom(across * (lastRowTaken(cell, footprint, true) - cell.row + 1)),
        );
        return cells.length > 0 ? [{ cells, swapped, weight }] : [];
      });
      if (fitting.length > 0) {
        const { cells, swapped } = weightedPick(
          streams.spawns,
          fitting,
          fitting.map(({ weight }) => weight),
        );
        placeAt(swapped, pickCell(swapped, cells));
        return true;
      }
    }
    return false;
  };
  // Places a spawn on a cell that fits it. A one-cell spawn of the plan's own takes the cell kept
  // for it.
  const placeAt = (quota: SpawnQuota<Kind>, cell: Cell) => {
    const footprint = quotaFootprint(quota);
    const lastRow = lastRowTaken(cell, footprint, quota.blocksLane);
    const covered = laneRun(cell.lane, footprint.lanes);
    for (let row = cell.row; row <= lastRow; row++) {
      takeCells(row, covered);
      addLanes(heldByStanding, row, covered);
    }
    const event = { distance: itemAt(rows, cell.row), kind: quota.kind, lane: cell.lane };
    if (quota.blocksLane) {
      if (footprint.lanes >= WIDE_LANES) {
        wideRows.fill(1, cell.row, lastHitRow(cell, footprint) + 1);
      }
      tryBlock(cell, footprint, true);
      const place = blockingPlace(quota, cell, footprint);
      addPlaced(place);
      standing.push({ block: itemAt(blocks, blocks.length - 1), cell, event, place, quota });
    }
    events.push(event);
    if (statics.includes(quota) && area(quota) === 1) {
      reserved -= 1;
    }
  };

  // The lane-blocking standing spawns placed, each with its block, cell, spawn and place for the
  // pack-fit gap; and the plain ones that found no room.
  interface Standing {
    block: Block;
    cell: Cell;
    event: SpawnEvent<Kind>;
    place: BlockingPlace;
    quota: SpawnQuota<Kind>;
  }
  const standing: Standing[] = [];
  const unplaced: SpawnQuota<Kind>[] = [];
  // The rows that come on screen with a lane-blocking mover in view: of the rows whose windows the
  // mover meets the pack in, on its path or any its stalking may take, those that come on screen
  // once its body shows, at or below the road's top and not off its side: a cue, or a dart waiting
  // at the road's edge, blocks nothing yet. A row comes on screen at its distance, as a standing
  // spawn on it does, and a mover meets the pack at its distance from its cue less sightLength, as
  // the pixel of scroll it first overlaps it.
  const moverInView = new Uint8Array(rows.length);
  const markInView = (cue: number, path: MoverPath, footprint: Footprint) => {
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
    rows.forEach((distance, row) => {
      if (shows >= 0 && distance >= cue + shows && start < distance + rowWindow && end > distance) {
        moverInView[row] = 1;
      }
    });
  };
  // Whether each row comes on screen with a lane-blocking spawn in view: a mover marked in view,
  // or a standing spawn, in view from the moment its first row comes on.
  const inView = (): Uint8Array => {
    const filled = Uint8Array.from(moverInView);
    for (const { block } of standing) {
      filled.fill(1, block.row, block.lastRow + 1);
    }
    return filled;
  };
  interface Run {
    first: number;
    last: number;
  }
  // The most quiet rows a run from first to last may have: maxEmptyRows; half that, rounded down,
  // for a run from the zone's first row or to its last, so a run across the road where two zones
  // meet keeps near the cap; and none from the first row of a zone whose rows start on the road in
  // view, so something meets the pack soon after it starts.
  const quietAllowed = (first: number, last: number): number => {
    if (first === 0 && plan.firstContactSeconds !== undefined) {
      return 0;
    }
    return first === 0 || last === rows.length - 1
      ? Math.floor(plan.maxEmptyRows / 2)
      : plan.maxEmptyRows;
  };
  // The runs of more quiet rows than they may have, rows that come on screen with nothing
  // lane-blocking in view, and how many rows they run over it in all.
  const quietRuns = (): { over: number; runs: Run[] } => {
    const filled = inView();
    const runs: Run[] = [];
    let over = 0;
    let first = 0;
    for (let row = 0; row <= rows.length; row++) {
      if (row < rows.length && filled[row] === 0) {
        continue;
      }
      const allowed = quietAllowed(first, row - 1);
      if (row - first > allowed) {
        runs.push({ first, last: row - 1 });
        over += row - first - allowed;
      }
      first = row + 1;
    }
    return { over, runs };
  };

  // Recomputes the lanes blocked in the windows and gaps of rows first to last from the blocks
  // kept.
  const reblock = (first: number, last: number) => {
    blocked.fill(0, first, last + 1);
    gapBlocked.fill(0, first, last + 1);
    for (const block of blocks) {
      for (let row = Math.max(first, block.row); row <= Math.min(last, block.lastRow); row++) {
        addLanes(blocked, row, block.covered);
      }
      for (let row = Math.max(first, block.row); row <= Math.min(last, block.lastGap); row++) {
        addLanes(gapBlocked, row, block.covered);
      }
    }
  };
  const without = <Item>(items: Item[], item: Item) => {
    items.splice(items.indexOf(item), 1);
  };
  // Takes a standing spawn off the road, freeing its cells but those a mover holds.
  const lift = (lifted: Standing) => {
    const { block, cell, event, place, quota } = lifted;
    const footprint = quotaFootprint(quota);
    const covered = laneRun(cell.lane, footprint.lanes);
    for (let row = cell.row; row <= block.lastRow; row++) {
      heldByStanding[row] = (heldByStanding[row] ?? 0) & ~covered;
      const freed = covered & (taken[row] ?? 0) & ~(moverHeld[row] ?? 0);
      taken[row] = (taken[row] ?? 0) & ~freed;
      cellsLeft += laneTotal(freed);
    }
    if (footprint.lanes >= WIDE_LANES) {
      wideRows.fill(0, cell.row, lastHitRow(cell, footprint) + 1);
    }
    without(blocks, block);
    reblock(block.row, Math.max(block.lastRow, block.lastGap));
    without(placed, place);
    without(events, event);
    without(standing, lifted);
  };
  // Saves what a move changes, and returns what puts it back.
  const save = (): (() => void) => {
    const arrays = [taken, heldByStanding, blocked, gapBlocked, wideRows];
    const arrayCopies = arrays.map((array) => array.slice());
    const copies = { blocks: [...blocks], events: [...events], placed: [...placed] };
    const standingCopy = [...standing];
    const counts = { cellsLeft, reserved };
    return () => {
      arrays.forEach((array, i) => {
        array.set(itemAt(arrayCopies, i));
      });
      blocks.splice(0, blocks.length, ...copies.blocks);
      events.splice(0, events.length, ...copies.events);
      placed.splice(0, placed.length, ...copies.placed);
      standing.splice(0, standing.length, ...standingCopy);
      ({ cellsLeft, reserved } = counts);
    };
  };

  // The cells of a quiet run a spawn fits, in the rows that leave no more quiet rows on either
  // side of it than they may have (quietAllowed), or else in any of its rows.
  const cellsIn = (quota: SpawnQuota<Kind>, run: Run): Cell[] => {
    const footprint = quotaFootprint(quota);
    const cells = freeCells(quota, footprint, run.first, run.last + 1);
    const splits = cells.filter((cell) => {
      const after = lastRowTaken(cell, footprint, true) + 1;
      return (
        cell.row - run.first <= quietAllowed(run.first, cell.row - 1) &&
        run.last + 1 - after <= quietAllowed(after, run.last)
      );
    });
    return splits.length > 0 ? splits : cells;
  };
  // How many rows within maxEmptyRows of a standing spawn come on screen with something else
  // lane-blocking in view.
  const busyness = (from: Standing): number => {
    const undo = save();
    lift(from);
    const filled = inView();
    undo();
    const first = Math.max(0, from.block.row - plan.maxEmptyRows);
    const last = Math.min(rows.length - 1, from.block.lastRow + plan.maxEmptyRows);
    return filled.subarray(first, last + 1).reduce((sum, row) => sum + row, 0);
  };
  // Fills a quiet run with one of the zone's plain standing spawns: one that found no room, or
  // else one moved from the busiest stretch, where the most rows near it come on screen with
  // something else in view; equally busy ones are tried in random order, each into the run as it
  // stands once that spawn is lifted. A move stands only if it leaves fewer rows quiet over the
  // cap in all, counting any it leaves where the spawn stood, which a later move may fill.
  const fillRun = (run: Run, over: number): boolean => {
    for (const quota of unplaced) {
      const cells = cellsIn(quota, run);
      if (cells.length > 0) {
        without(unplaced, quota);
        placeAt(quota, randomPick(streams.spawns, cells));
        return true;
      }
    }
    const ranked = standing
      .filter(({ quota }) => quota.first !== true)
      .map((from) => ({ busy: busyness(from), from }));
    while (ranked.length > 0) {
      const busiest = Math.max(...ranked.map(({ busy }) => busy));
      const pick = randomPick(
        streams.spawns,
        ranked.filter(({ busy }) => busy === busiest),
      );
      without(ranked, pick);
      const undo = save();
      lift(pick.from);
      // The run as it stands with the spawn lifted, longer where the spawn stood beside it.
      const grown =
        quietRuns().runs.find(({ first, last }) => first <= run.first && run.last <= last) ?? run;
      const cells = cellsIn(pick.from.quota, grown);
      if (cells.length > 0) {
        placeMoved(pick.from.quota, randomPick(streams.spawns, cells));
        if (quietRuns().over < over) {
          return true;
        }
      }
      undo();
    }
    return false;
  };
  // A moved spawn takes a cell like any other, but its kept cell, if it had one, is already used.
  const placeMoved = (quota: SpawnQuota<Kind>, cell: Cell) => {
    const kept = reserved;
    placeAt(quota, cell);
    reserved = kept;
  };
  // Fills the quiet runs over the cap, one spawn at a time, until none left can be filled.
  const fillQuietRuns = () => {
    for (;;) {
      const { over, runs } = quietRuns();
      if (!runs.some((run) => fillRun(run, over))) {
        return;
      }
    }
  };

  placeStanding((quota) => quota.first === true, placeMoving(true));
  placeMoving(false);
  placeStanding((quota) => quota.first !== true && quota.blocksLane, []);
  fillQuietRuns();
  const stilledPrizes = placePrizes();
  holdRests();
  placeStanding((quota) => quota.first !== true && !quota.blocksLane, stilledPrizes);
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
