import { itemAt } from "../lib/arrays";
import { randomPick } from "../lib/random";
import {
  type LaneSpan,
  type MoverCaps,
  type MoverPath,
  type MoverSpec,
  type MoverStand,
  type OnScreen,
  placeMovers,
  type PlannerStreams,
} from "./movers";

// What a spawn covers: lanes across, and rows along the road of footprint.cellLength each.
export interface Footprint {
  lanes: number;
  rows: number;
}

export const SINGLE_CELL: Footprint = { lanes: 1, rows: 1 };

// blocksLane marks kinds the pack must steer around, such as obstacles. first marks kinds
// placed before every other, such as the obstacles that open a card, so they are the last
// skipped. Spawns without a footprint take one cell. A lane-blocking mover's spawns block the
// lanes it sweeps instead; one with no room to move waits for the next row with room, or is
// dropped, unless it is marked first, when it stands still in its footprint instead. A mover
// that blocks no lane, a moving prize, only keeps clear the cells it passes through, and stands
// still in its footprint when it has no room to move.
export interface SpawnQuota<Kind extends string> {
  blocksLane: boolean;
  count: number;
  first?: boolean;
  footprint?: Footprint;
  kind: Kind;
  mover?: MoverSpec;
}

// Distances are scroll distances in pixels from the start of the zone. A spawn's footprint is
// cellLength per row, and its hit box is planned as the footprint less cellInset at each end, which
// is negative where obstacles are drawn longer than a row; it overlaps the pack over its hit box's
// length plus packLength. A lane is cellLength wide, and a mover's hit box is laneInset inside its
// lane at each side. scrollSpeed (pixels per second), laneMoveSeconds and stepSeconds, the
// walk's step, set how far the pack can steer between rows. sightLength is the road in view above
// the pack, so the next row shows before the pack has to steer for it, and roadLength the whole
// road in view. reactionSeconds is the time the pack is given to react on top of the lane moves it
// makes between two spawns.
export interface SpawnPlan<Kind extends string> {
  cellInset: number;
  cellLength: number;
  laneCount: number;
  laneInset: number;
  laneMoveSeconds: number;
  minOpenLanes: number;
  minSpacing: number;
  moverCaps: MoverCaps;
  packLength: number;
  quotas: readonly SpawnQuota<Kind>[];
  reactionSeconds: number;
  roadLength: number;
  scrollSpeed: number;
  sightLength: number;
  stepSeconds: number;
  zoneLength: number;
}

// lane is the footprint's leftmost lane. A mover's distance is where its cue appears.
export interface SpawnEvent<Kind extends string> {
  distance: number;
  kind: Kind;
  lane: number;
  mover?: MoverPath;
}

interface DueSpawns<Kind extends string> {
  due: SpawnEvent<Kind>[];
  pending: readonly SpawnEvent<Kind>[];
}

// entry is the reach into the first row from any lane: the zone starts a row spacing clear.
export interface LaneReach {
  betweenRows: number;
  entry: number;
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

// The scroll a lane move covers: it lasts whole walk steps.
function laneMoveLength(plan: SpawnPlan<string>): number {
  return Math.ceil(plan.laneMoveSeconds / plan.stepSeconds - ROUNDING) * stepLength(plan);
}

// The scroll the reaction margin covers.
function reactionLength(plan: SpawnPlan<string>): number {
  return plan.reactionSeconds * plan.scrollSpeed;
}

// Whole lane moves that fit in a stretch of clear road. The pack starts a move only on a walk
// step, which can come up to a step into the stretch, so the moves need a step to spare.
function lanesWithin(plan: SpawnPlan<string>, clearDistance: number): number {
  const maxReach = plan.laneCount - 1;
  if (plan.laneMoveSeconds <= 0) {
    return maxReach;
  }
  const moves = Math.floor((clearDistance - stepLength(plan)) / laneMoveLength(plan) + ROUNDING);
  return Math.max(0, Math.min(maxReach, moves));
}

// Rows are minSpacing apart, or, on a road too fast for a lane move between one row's window
// and the next, the fewest whole pixels apart that fit one with its step to spare.
export function rowSpacing(plan: SpawnPlan<string>): number {
  if (plan.laneMoveSeconds <= 0) {
    return plan.minSpacing;
  }
  const oneMove = blockingLength(plan, 1) + stepLength(plan) + laneMoveLength(plan);
  return Math.max(plan.minSpacing, Math.ceil(oneMove - ROUNDING));
}

// Every row has a window, the distance over which a one-row spawn on it overlaps the pack,
// and a gap of clear road before the next row's window, where the pack changes lanes.
export function laneReach(plan: SpawnPlan<string>): LaneReach {
  const spacing = rowSpacing(plan);
  const window = blockingLength(plan, 1);
  if (window > spacing) {
    throw new Error("Rows must be at least a row's blocking length apart, or they overlap");
  }
  if (spacing > window + plan.sightLength) {
    throw new Error("Rows must keep the next row in sight before the pack steers for it");
  }
  return {
    betweenRows: lanesWithin(plan, spacing - window),
    entry: lanesWithin(plan, spacing),
  };
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
// tallest pack's height, the lane moves and the reaction margin, so the pack visibly fits
// between them.
export function packGap(plan: SpawnPlan<string>, changes: number): number {
  return plan.packLength + changes * laneMoveLength(plan) + reactionLength(plan);
}

// The most lane changes a pack passing the nearer spawn, in a lane the farther one blocks, makes
// between them on a way out of that lane that steps in behind the nearer one: from the first
// lane the nearer one blocks to the nearest lane the farther one leaves open, on either side.
// The moves before that first lane can be made beside the nearer one. 0 when no way steps in
// behind it.
function laneChangesBetween(laneCount: number, near: BlockingPlace, far: BlockingPlace): number {
  const nearMask = laneRun(near.lane, near.lanes);
  const farMask = laneRun(far.lane, far.lanes);
  let most = 0;
  for (let lane = 0; lane < laneCount; lane++) {
    if ((farMask & ~nearMask & (1 << lane)) === 0) {
      continue;
    }
    for (const side of [-1, 1]) {
      let behind = -1;
      for (let next = lane + side; next >= 0 && next < laneCount; next += side) {
        if (behind === -1 && (nearMask & (1 << next)) !== 0) {
          behind = next;
        }
        if ((farMask & (1 << next)) === 0) {
          if (behind !== -1) {
            most = Math.max(most, Math.abs(next - behind) + 1);
          }
          break;
        }
      }
    }
  }
  return most;
}

// True when the pack fits between two lane-blocking spawns: where the path changes lanes
// between them and road shows between them, that road is at least the packGap for those lane
// changes. Spawns side by side, with no road between them, leave no gap to change lanes through.
export function packFitsBetween(
  plan: SpawnPlan<string>,
  a: BlockingPlace,
  b: BlockingPlace,
): boolean {
  const fitsBehind = (near: BlockingPlace, far: BlockingPlace) => {
    const gap = far.distance - near.distance - near.length;
    const changes = laneChangesBetween(plan.laneCount, near, far);
    return gap <= 0 || changes === 0 || gap >= packGap(plan, changes) - ROUNDING;
  };
  // Met at once, either may be the nearer one.
  if (a.distance === b.distance) {
    return fitsBehind(a, b) && fitsBehind(b, a);
  }
  return a.distance < b.distance ? fitsBehind(a, b) : fitsBehind(b, a);
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

// True when every lane in from has a lane in to no more than reach lanes away, with every
// lane on the way, both ends included, in clear. All are lane masks.
export function everyLaneReaches(reach: number, from: number, to: number, clear = -1): boolean {
  for (let lane = 0; from >>> lane !== 0; lane++) {
    if ((from & (1 << lane)) === 0) {
      continue;
    }
    let reached = false;
    for (let target = Math.max(0, lane - reach); target <= lane + reach && !reached; target++) {
      if ((to & (1 << target)) !== 0) {
        const path = laneRun(Math.min(lane, target), Math.abs(target - lane) + 1);
        reached = (clear & path) === path;
      }
    }
    if (!reached) {
      return false;
    }
  }
  return true;
}

interface Cell {
  lane: number;
  row: number;
}

// Lane-blocking spawns this many lanes wide or wider never take neighbouring rows: a row is left
// between them.
const WIDE_LANES = 2;

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

// Every spawn takes free cells of a lane-by-row grid, its rows rowSpacing apart. Each kind's spawns
// are spread over equal stretches of the zone, one per stretch, so no kind bunches up. The standing
// kinds take turns along the zone, the widest first in each turn, so each keeps its share of what
// is placed. Lane-blocking spawns only take cells that keep every hit avoidable: each row's window
// and the gap after it keep minOpenLanes open, and from any lane at the zone's start, and from
// every open lane of each row, an open lane of the next row is within reach without crossing a
// lane blocked in the gap between them, or else, after rows with no
// lane-blocking spawn, which the pack steers across, from an earlier row with the lane moves that
// fit in all the road between less the reaction margin; those rows then stay clear of lane-blocking
// spawns. A spawn more than one row long blocks every window and gap it overlaps, and must end
// within the zone's last row. Where the path changes lanes between two lane-blocking spawns,
// packFitsBetween holds, for a mover wherever it stands. Two lane-blocking spawns WIDE_LANES wide
// or wider have a row between the rows they take. The quotas marked first are placed first, their
// movers then the rest; then the other lane-blocking movers; then the other lane-blocking spawns;
// then the moving prizes; then the other spawns. Movers are placed by placeMovers; a crosser keeps
// the row before its own clear as a lead-in, so the pack steers into its row from two rows back. A
// dart may set off over cells the spawns placed before it hold, crossing over or past them, but
// not with a lane-blocking spawn in its lead-in row. Nothing placed after it takes its cells,
// another dart included, but a lane-blocking standing spawn outside its lead-in row, which it then
// crosses over or past the same way. A mover with no room in its stretch, such as one over a cap
// on screen, waits for the next row with room; only one marked first stands still in its footprint
// when no row has room for it to move. A moving prize is placed as a mover that blocks nothing:
// the cells it passes through are kept clear of other spawns, so it never walks into one, but no
// lane is blocked, it stands nowhere for the pack-fit gap and it counts toward no cap on screen,
// since the pack never has to steer around it.
// It keeps a free cell for every moving prize, its own included, and with no room to move it stands
// still in one cell among the other spawns, so a prize is never skipped for want of room to move.
// A lane-blocking mover, or an obstacle bigger than one cell, that the earlier
// draws left no room for is skipped, which uses no random draw; so is one that would leave fewer
// free cells than there are one-cell spawns. A free cell can still be one no lane-blocking spawn
// may take, where the path rule or the pack-fit gap around the movers rules it out, so a one-cell
// spawn with no room left is skipped too, the same way: a zone never fails to plan for want of
// room.
export function planSpawns<Kind extends string>(
  streams: PlannerStreams,
  plan: SpawnPlan<Kind>,
): SpawnEvent<Kind>[] {
  const { laneCount, minOpenLanes } = plan;
  const reach = laneReach(plan);
  const spacing = rowSpacing(plan);
  const rows = spawnRowDistances(spacing, plan.zoneLength);
  // Lane masks per row: lanes taken by a spawn, those of them a dart holds, lanes blocked in the
  // row's window, and lanes blocked in the gap after it.
  const taken = new Int32Array(rows.length);
  const dartHeld = new Int32Array(rows.length);
  // Lanes taken by a spawn other than a dart: a lane-blocking spawn may take a cell only darts
  // hold, as the dart then sets off over or past it.
  const heldByOther = new Int32Array(rows.length);
  const blocked = new Int32Array(rows.length);
  const gapBlocked = new Int32Array(rows.length);
  // What a trial block overwrote, by row, to undo it.
  const blockedBefore = new Int32Array(rows.length);
  const gapBefore = new Int32Array(rows.length);
  const events: SpawnEvent<Kind>[] = [];
  const lanes = laneRun(0, laneCount);
  // The lane-blocking spawns placed so far, and every place each mover stands.
  const placed: BlockingPlace[] = [];
  // Rows taken by a wide lane-blocking spawn.
  const wideRows = new Uint8Array(rows.length);
  const clearOfWide = (first: number, last: number): boolean =>
    !wideRows.subarray(Math.max(0, first - 1), last + 2).includes(1);

  const openLanes = (row: number) => lanes & ~(blocked[row] ?? 0);

  const area = (quota: SpawnQuota<Kind>) => {
    const { lanes: across, rows: length } = quota.footprint ?? SINGLE_CELL;
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
    taken[row] = (taken[row] ?? 0) | mask;
  };

  // Rows a mover keeps clear before its own, so the pack steers from the row before them.
  const leadIns = new Set<number>();
  const leadInReach = lanesWithin(plan, 2 * spacing - blockingLength(plan, 1));

  const isEmpty = (row: number) => (blocked[row] ?? 0) === 0 && (gapBlocked[row] ?? 0) === 0;
  // Empty rows the pack steers across to reach a row it could not reach from the row before:
  // they stay free of lane-blocking spawns. relied holds those a trial block needs. Only a spawn
  // bigger than one cell, which may be skipped, keeps new rows clear, so the one-cell spawns
  // always have the rows they had.
  const steerRows = new Uint8Array(rows.length);
  let relied: number[] = [];
  // From an empty row, the reach from the nearest row before it that reaches the next row:
  // over all the road from that row's window to the next row's, less the reaction margin, since
  // the pack steers for a row further ahead than the next; or from any lane at the zone's start.
  // The rows between are empty, and the pack may be in any lane of an empty one. The steering
  // stops at the last row before it with a lane-blocking spawn.
  const crossesEmpty = (row: number): boolean => {
    const next = itemAt(rows, row + 1);
    for (let from = row - 1; from >= -1; from -= 1) {
      const road =
        from === -1
          ? next
          : next - itemAt(rows, from) - blockingLength(plan, 1) - reactionLength(plan);
      const start = from === -1 ? lanes : openLanes(from);
      const clear = from === -1 ? -1 : ~(gapBlocked[from] ?? 0);
      if (everyLaneReaches(lanesWithin(plan, road), start, openLanes(row + 1), clear)) {
        relied.push(...Array.from({ length: row - from }, (_, i) => from + 1 + i));
        return true;
      }
      if (from >= 0 && !isEmpty(from)) {
        return false;
      }
    }
    return false;
  };

  const crossesFrom = (row: number): boolean => {
    if (row === -1) {
      return everyLaneReaches(reach.entry, lanes, openLanes(0));
    }
    if (row === rows.length - 1) {
      return true;
    }
    if (leadIns.has(row)) {
      return everyLaneReaches(
        leadInReach,
        openLanes(row - 1),
        openLanes(row + 1),
        ~(gapBlocked[row - 1] ?? 0),
      );
    }
    const crosses = everyLaneReaches(
      reach.betweenRows,
      openLanes(row),
      openLanes(row + 1),
      ~(gapBlocked[row] ?? 0),
    );
    return crosses || (isEmpty(row) && crossesEmpty(row));
  };

  // Blocks the footprint's lanes, checks every transition it touches, and undoes the block
  // unless keep is set and the checks pass.
  const tryBlock = (cell: Cell, footprint: Footprint, keep: boolean): boolean => {
    const { lastGap, lastRow } = blockingSpan(plan, spacing, cell.row, footprint.rows);
    if (lastRow >= rows.length || lastGap >= rows.length - 1) {
      return false;
    }
    if (steerRows.subarray(cell.row, lastRow + 1).includes(1)) {
      return false;
    }
    relied = [];
    const covered = laneRun(cell.lane, footprint.lanes);
    for (let row = cell.row; row <= lastRow; row++) {
      blockedBefore[row] = blocked[row] ?? 0;
      blocked[row] = (blocked[row] ?? 0) | covered;
    }
    for (let row = cell.row; row <= lastGap; row++) {
      gapBefore[row] = gapBlocked[row] ?? 0;
      gapBlocked[row] = (gapBlocked[row] ?? 0) | covered;
    }
    let ok = true;
    for (let row = cell.row; ok && row <= lastRow; row++) {
      ok = laneCount - laneTotal(blocked[row] ?? 0) >= minOpenLanes;
    }
    for (let row = cell.row; ok && row <= lastGap; row++) {
      ok = laneCount - laneTotal(gapBlocked[row] ?? 0) >= minOpenLanes;
    }
    const lastCrossing = leadIns.has(lastRow + 1) ? lastRow + 1 : lastRow;
    for (let row = cell.row - 1; ok && row <= lastCrossing; row++) {
      ok = crossesFrom(row);
    }
    // The empty rows after it now steer from it.
    for (let row = lastCrossing + 1; ok && row < rows.length - 1 && isEmpty(row); row++) {
      ok = crossesFrom(row);
    }
    if (ok && footprint.lanes * footprint.rows === 1) {
      ok = relied.every((row) => steerRows[row] === 1);
    }
    if (ok && keep) {
      relied.forEach((row) => {
        steerRows[row] = 1;
      });
    }
    if (!ok || !keep) {
      for (let row = cell.row; row <= lastRow; row++) {
        blocked[row] = blockedBefore[row] ?? 0;
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

  const fits = (cell: Cell, footprint: Footprint, blocksLane: boolean): boolean => {
    if (cell.lane + footprint.lanes > laneCount) {
      return false;
    }
    const last = lastRowTaken(cell, footprint, blocksLane);
    if (last >= rows.length) {
      return false;
    }
    const covered = laneRun(cell.lane, footprint.lanes);
    for (let row = cell.row; row <= last; row++) {
      const held = blocksLane ? (heldByOther[row] ?? 0) : (taken[row] ?? 0);
      if ((held & covered) !== 0 || (blocksLane && leadIns.has(row))) {
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
    if (footprint.lanes >= WIDE_LANES && !clearOfWide(cell.row, last)) {
      return false;
    }
    const place = {
      distance: itemAt(rows, cell.row),
      lane: cell.lane,
      lanes: footprint.lanes,
      length: hitLength(plan, footprint.rows),
    };
    return (
      placed.every((other) => packFitsBetween(plan, place, other)) &&
      tryBlock(cell, footprint, false)
    );
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
        if (fits({ lane, row }, footprint, quota.blocksLane)) {
          cells.push({ lane, row });
        }
      }
    }
    return cells;
  };

  // The movers that block lanes, or the moving prizes, as placeMovers takes them.
  const moverQuotas = (blocking: boolean) =>
    plan.quotas.flatMap(({ blocksLane, count, first, kind, mover }) =>
      mover === undefined || blocksLane !== blocking
        ? []
        : [{ count, first: first ?? false, kind, spec: mover }],
    );
  const movers = moverQuotas(true);
  const moverGrid = {
    block: (row: number, span: LaneSpan, rowsBlocked: number, leadIn: boolean, keep: boolean) => {
      // A lead-in needs a row before it to steer from, and no lane-blocking spawn in it, as the
      // pack steers across it.
      if (leadIn && (row < 2 || !isEmpty(row - 1))) {
        return false;
      }
      if (leadIn) {
        leadIns.add(row - 1);
      }
      const ok = tryBlock(
        { lane: span.first, row },
        { lanes: span.count, rows: rowsBlocked },
        keep,
      );
      if (leadIn && !(ok && keep)) {
        leadIns.delete(row - 1);
      }
      return ok;
    },
    isFree: (dart: boolean, lane: number, row: number) =>
      (((dart ? dartHeld : taken)[row] ?? 0) & laneRun(lane, 1)) === 0,
    // Only the cells not yet taken use up room: a dart may set off over taken ones.
    leavesRoom: (cells: readonly Cell[]) =>
      leavesRoom(
        cells.filter(
          ({ lane, row }) =>
            row >= 0 && row < rows.length && ((taken[row] ?? 0) & laneRun(lane, 1)) === 0,
        ).length,
      ),
    packFits: (stands: readonly MoverStand[]) =>
      stands.every((stand) => placed.every((other) => packFitsBetween(plan, stand, other))),
    stand: (stands: readonly MoverStand[]) => {
      placed.push(...stands);
    },
    take: (dart: boolean, lane: number, row: number) => {
      if (row >= 0 && row < rows.length) {
        takeCells(row, laneRun(lane, 1));
        if (dart) {
          dartHeld[row] = (dartHeld[row] ?? 0) | laneRun(lane, 1);
        } else {
          heldByOther[row] = (heldByOther[row] ?? 0) | laneRun(lane, 1);
        }
      }
    },
  };
  const moverRoad = {
    cellLength: plan.cellLength,
    laneCount,
    laneInset: plan.laneInset,
    packLength: plan.packLength,
    roadLength: plan.roadLength,
    rowSpacing: spacing,
    scrollSpeed: plan.scrollSpeed,
    sightLength: plan.sightLength,
    window: blockingLength(plan, 1),
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
    return first ? stilledQuotas(true, quotas, dropped) : [];
  };
  // A moving prize keeps its cells clear of other spawns, and nothing else: it blocks no lane,
  // stands nowhere for the pack-fit gap, and counts toward no cap on screen. One with no room to
  // move stands still instead, in its footprint, among the other spawns that block no lane.
  const prizeGrid = { ...moverGrid, block: () => true, packFits: () => true, stand: () => {} };
  const placePrizes = (): SpawnQuota<Kind>[] => {
    const quotas = moverQuotas(false);
    const { dropped, spawns } = placeMovers(
      streams,
      moverRoad,
      plan.moverCaps,
      prizeGrid,
      [],
      rows,
      quotas,
    );
    events.push(...spawns);
    return stilledQuotas(false, quotas, dropped);
  };
  // The kinds take turns, in the order of their spawns' stretches along the zone, so a kind
  // placed later still gets cells in every stretch and each keeps its share of what is placed.
  // Within a turn the widest kinds go first, then the biggest. Sorting copies leaves the plan
  // alone; sort is stable, so equal kinds keep their order.
  const placeStanding = (
    keep: (quota: SpawnQuota<Kind>) => boolean,
    stilled: readonly SpawnQuota<Kind>[],
  ) => {
    const across = (quota: SpawnQuota<Kind>) => (quota.footprint ?? SINGLE_CELL).lanes;
    const ordered = [...statics, ...stilled]
      .filter(keep)
      .sort((a, b) => across(b) - across(a) || area(b) - area(a));
    ordered
      .flatMap((quota, order) =>
        Array.from({ length: quota.count }, (_, i) => ({
          i,
          middle: (i + 0.5) / quota.count,
          order,
          quota,
        })),
      )
      .sort((a, b) => a.middle - b.middle || a.order - b.order)
      .forEach(({ i, quota }) => placeOne(quota, i));
  };
  // The ith of a quota's spawns, in the ith of its count's equal stretches of the zone.
  const placeOne = (quota: SpawnQuota<Kind>, i: number) => {
    const footprint = quota.footprint ?? SINGLE_CELL;
    const stretch = freeCells(
      quota,
      footprint,
      Math.floor((i * rows.length) / quota.count),
      Math.floor(((i + 1) * rows.length) / quota.count),
    );
    const cells = stretch.length > 0 ? stretch : freeCells(quota, footprint, 0, rows.length);
    if (cells.length === 0) {
      return;
    }
    const cell = randomPick(streams.spawns, cells);
    const covered = laneRun(cell.lane, footprint.lanes);
    for (let row = cell.row; row <= lastRowTaken(cell, footprint, quota.blocksLane); row++) {
      takeCells(row, covered);
      heldByOther[row] = (heldByOther[row] ?? 0) | covered;
    }
    if (quota.blocksLane) {
      if (footprint.lanes >= WIDE_LANES) {
        wideRows.fill(1, cell.row, lastRowTaken(cell, footprint, true) + 1);
      }
      tryBlock(cell, footprint, true);
      placed.push({
        distance: itemAt(rows, cell.row),
        lane: cell.lane,
        lanes: footprint.lanes,
        length: hitLength(plan, footprint.rows),
      });
    }
    events.push({ distance: itemAt(rows, cell.row), kind: quota.kind, lane: cell.lane });
    // A one-cell spawn takes the cell kept for it.
    if (statics.includes(quota) && area(quota) === 1) {
      reserved -= 1;
    }
  };
  placeStanding((quota) => quota.first === true, placeMoving(true));
  placeMoving(false);
  placeStanding((quota) => quota.first !== true && quota.blocksLane, []);
  placeStanding((quota) => quota.first !== true && !quota.blocksLane, placePrizes());
  return events.sort((a, b) => a.distance - b.distance || a.lane - b.lane);
}

// The movers placeMovers dropped, as quotas that stand still in their footprints, one per kind:
// a kind may have several quotas, such as one per stepper.
function stilledQuotas<Kind extends string>(
  blocksLane: boolean,
  quotas: readonly { readonly first: boolean; readonly kind: Kind; readonly spec: MoverSpec }[],
  dropped: readonly Kind[],
): SpawnQuota<Kind>[] {
  const kinds = new Map(quotas.map((quota) => [quota.kind, quota]));
  return [...kinds.values()].flatMap(({ first, kind, spec }) => {
    const count = dropped.filter((other) => other === kind).length;
    return count === 0 ? [] : [{ blocksLane, count, first, footprint: spec.footprint, kind }];
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
