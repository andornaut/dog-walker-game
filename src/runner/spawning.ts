import { itemAt } from "../arrays";
import { type LaneSpan, type MoverPath, type MoverSpec, placeMovers } from "./movers";
import { type Random, randomPick } from "./random";

// What a spawn covers: lanes across, and rows along the road of footprint.cellLength each.
export interface Footprint {
  lanes: number;
  rows: number;
}

export const SINGLE_CELL: Footprint = { lanes: 1, rows: 1 };

// blocksLane marks kinds the pack must steer around, such as obstacles. Spawns without a
// footprint take one cell. A mover's spawns block the lanes it sweeps instead.
export interface SpawnQuota<Kind extends string> {
  blocksLane: boolean;
  count: number;
  footprint?: Footprint;
  kind: Kind;
  mover?: MoverSpec;
}

// Distances are scroll distances in pixels from the start of the zone. A spawn's footprint
// is cellLength per row, and its hit box is the footprint less cellInset at each end; it
// overlaps the pack over its hit box's length plus packLength. scrollSpeed (pixels per
// second), laneMoveSeconds and stepSeconds, the walk's step, set how far the pack can steer
// between rows. sightLength is the road in view above the pack, so the next row shows before
// the pack has to steer for it, and roadLength the whole road in view.
export interface SpawnPlan<Kind extends string> {
  cellInset: number;
  cellLength: number;
  laneCount: number;
  laneMoveSeconds: number;
  minOpenLanes: number;
  minSpacing: number;
  packLength: number;
  quotas: readonly SpawnQuota<Kind>[];
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

export interface DueSpawns<Kind extends string> {
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
  if (window > plan.minSpacing) {
    throw new Error("minSpacing must be at least a row's blocking length, or rows overlap");
  }
  if (spacing > window + plan.sightLength) {
    throw new Error("Rows must keep the next row in sight before the pack steers for it");
  }
  return {
    betweenRows: lanesWithin(plan, spacing - window),
    entry: lanesWithin(plan, spacing),
  };
}

// A set of lanes as a bit mask: bit n set means lane n is in it.
export function laneMask(lanes: readonly number[]): number {
  return lanes.reduce((mask, lane) => mask | (1 << lane), 0);
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

// Every spawn takes free cells of a lane-by-row grid, its rows rowSpacing apart. Each kind's
// spawns are spread over equal stretches of the zone, one per stretch, so no kind bunches up;
// kinds with bigger footprints are placed first. Lane-blocking spawns only take cells that
// keep every hit avoidable: each row's window and the gap after it keep minOpenLanes open, and
// from any lane at the zone's start, and from every open lane of each row, an open lane of the
// next row is within reach without crossing a lane blocked in the gap between them. A spawn more
// than one row long blocks every window and gap it overlaps, and must end within the zone's
// last row. Movers are placed first, by placeMovers; a crosser keeps the row before its own
// clear as a lead-in, so the pack steers into its row from two rows back. A mover, or an
// obstacle bigger than one cell, that the earlier draws left no room for is skipped, which
// uses no random draw; so is one that would leave fewer free cells than there are one-cell
// spawns. A plan that cannot fit its one-cell spawns that way is a data error and throws.
export function planSpawns<Kind extends string>(
  random: Random,
  plan: SpawnPlan<Kind>,
): SpawnEvent<Kind>[] {
  const { laneCount, minOpenLanes } = plan;
  const reach = laneReach(plan);
  const spacing = rowSpacing(plan);
  const rows = spawnRowDistances(spacing, plan.zoneLength);
  // Lane masks per row: lanes taken by a spawn, lanes blocked in the row's window, and lanes
  // blocked in the gap after it.
  const taken = new Int32Array(rows.length);
  const blocked = new Int32Array(rows.length);
  const gapBlocked = new Int32Array(rows.length);
  const events: SpawnEvent<Kind>[] = [];
  const lanes = laneRun(0, laneCount);

  const openLanes = (row: number) => lanes & ~(blocked[row] ?? 0);

  const area = (quota: SpawnQuota<Kind>) => {
    const { lanes: across, rows: length } = quota.footprint ?? SINGLE_CELL;
    return across * length;
  };
  const statics = plan.quotas.filter((quota) => quota.mover === undefined);
  // One-cell spawns are never skipped, so the others keep a free cell for each of them.
  const reserved = statics.reduce((sum, quota) => sum + (area(quota) === 1 ? quota.count : 0), 0);
  let cellsLeft = rows.length * laneCount;
  const leavesRoom = (cells: number) => cellsLeft - cells >= reserved;
  const takeCells = (row: number, mask: number) => {
    cellsLeft -= laneTotal(mask & ~(taken[row] ?? 0));
    taken[row] = (taken[row] ?? 0) | mask;
  };

  // Rows a mover keeps clear before its own, so the pack steers from the row before them.
  const leadIns = new Set<number>();
  const leadInReach = lanesWithin(plan, 2 * spacing - blockingLength(plan, 1));

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
    return everyLaneReaches(
      reach.betweenRows,
      openLanes(row),
      openLanes(row + 1),
      ~(gapBlocked[row] ?? 0),
    );
  };

  // Blocks the footprint's lanes, checks every transition it touches, and undoes the block
  // unless keep is set and the checks pass.
  const tryBlock = (cell: Cell, footprint: Footprint, keep: boolean): boolean => {
    const { lastGap, lastRow } = blockingSpan(plan, spacing, cell.row, footprint.rows);
    if (lastRow >= rows.length || lastGap >= rows.length - 1) {
      return false;
    }
    const covered = laneRun(cell.lane, footprint.lanes);
    const blockedBefore = blocked.slice(cell.row, lastRow + 1);
    const gapBefore = gapBlocked.slice(cell.row, Math.max(cell.row, lastGap + 1));
    for (let row = cell.row; row <= lastRow; row++) {
      blocked[row] = (blocked[row] ?? 0) | covered;
    }
    for (let row = cell.row; row <= lastGap; row++) {
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
    if (!ok || !keep) {
      blocked.set(blockedBefore, cell.row);
      gapBlocked.set(gapBefore, cell.row);
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
      if (((taken[row] ?? 0) & covered) !== 0) {
        return false;
      }
    }
    const cells = footprint.lanes * (last - cell.row + 1);
    if (footprint.lanes * footprint.rows > 1 && !leavesRoom(cells)) {
      return false;
    }
    return !blocksLane || tryBlock(cell, footprint, false);
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

  const movers = plan.quotas.flatMap(({ count, kind, mover }) =>
    mover === undefined ? [] : [{ count, kind, spec: mover }],
  );
  const moverGrid = {
    block: (row: number, span: LaneSpan, leadIn: boolean, keep: boolean) => {
      // A lead-in needs a row before it to steer from.
      if (leadIn && row < 2) {
        return false;
      }
      if (leadIn) {
        leadIns.add(row - 1);
      }
      const ok = tryBlock({ lane: span.first, row }, { lanes: span.count, rows: 1 }, keep);
      if (leadIn && !(ok && keep)) {
        leadIns.delete(row - 1);
      }
      return ok;
    },
    isFree: (lane: number, row: number) => ((taken[row] ?? 0) & laneRun(lane, 1)) === 0,
    leavesRoom: (cells: readonly Cell[]) =>
      leavesRoom(cells.filter(({ row }) => row >= 0 && row < rows.length).length),
    take: (lane: number, row: number) => {
      if (row >= 0 && row < rows.length) {
        takeCells(row, laneRun(lane, 1));
      }
    },
  };
  const moverRoad = {
    cellLength: plan.cellLength,
    laneCount,
    roadLength: plan.roadLength,
    rowSpacing: spacing,
    scrollSpeed: plan.scrollSpeed,
    sightLength: plan.sightLength,
    window: blockingLength(plan, 1),
    zoneLength: plan.zoneLength,
  };
  events.push(...placeMovers(random, moverRoad, moverGrid, rows, movers));

  // Sorting a copy leaves the plan alone; sort is stable, so equal areas keep their order.
  const ordered = [...statics].sort((a, b) => area(b) - area(a));
  for (const quota of ordered) {
    const footprint = quota.footprint ?? SINGLE_CELL;
    for (let i = 0; i < quota.count; i++) {
      const stretch = freeCells(
        quota,
        footprint,
        Math.floor((i * rows.length) / quota.count),
        Math.floor(((i + 1) * rows.length) / quota.count),
      );
      const cells = stretch.length > 0 ? stretch : freeCells(quota, footprint, 0, rows.length);
      if (cells.length === 0 && area(quota) > 1) {
        continue;
      }
      if (cells.length === 0) {
        throw new Error(`No room left in the zone to spawn ${quota.kind}`);
      }
      const cell = randomPick(random, cells);
      const covered = laneRun(cell.lane, footprint.lanes);
      for (let row = cell.row; row <= lastRowTaken(cell, footprint, quota.blocksLane); row++) {
        takeCells(row, covered);
      }
      if (quota.blocksLane) {
        tryBlock(cell, footprint, true);
      }
      events.push({ distance: itemAt(rows, cell.row), kind: quota.kind, lane: cell.lane });
    }
  }
  return events.sort((a, b) => a.distance - b.distance || a.lane - b.lane);
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
