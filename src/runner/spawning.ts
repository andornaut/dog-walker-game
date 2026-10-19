import { itemAt } from "../arrays";
import { type Random, randomPick } from "./random";

// What a spawn covers: lanes across, and rows along the road of footprint.cellLength each.
export interface Footprint {
  lanes: number;
  rows: number;
}

export const SINGLE_CELL: Footprint = { lanes: 1, rows: 1 };

// blocksLane marks kinds the pack must steer around, such as obstacles. Spawns without a
// footprint take one cell.
export interface SpawnQuota<Kind extends string> {
  blocksLane: boolean;
  count: number;
  footprint?: Footprint;
  kind: Kind;
}

// Distances are scroll distances in pixels from the start of the zone. A spawn's footprint
// is cellLength per row, and its hit box is the footprint less cellInset at each end; it
// overlaps the pack over its hit box's length plus packLength. scrollSpeed (pixels per
// second) and laneMoveSeconds set how far the pack can steer between rows. sightLength is the
// road in view above the pack, so the next row shows before the pack has to steer for it.
export interface SpawnPlan<Kind extends string> {
  cellInset: number;
  cellLength: number;
  laneCount: number;
  laneMoveSeconds: number;
  minOpenLanes: number;
  minSpacing: number;
  packLength: number;
  quotas: readonly SpawnQuota<Kind>[];
  scrollSpeed: number;
  sightLength: number;
  zoneLength: number;
}

// lane is the footprint's leftmost lane.
export interface SpawnEvent<Kind extends string> {
  distance: number;
  kind: Kind;
  lane: number;
}

export interface DueSpawns<Kind extends string> {
  due: SpawnEvent<Kind>[];
  pending: SpawnEvent<Kind>[];
}

// entry is the reach into the first row from anywhere: the zone starts minSpacing clear,
// and the previous zone ends at least minSpacing clear, so the gap is twice minSpacing.
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

// Whole lane moves that fit in a stretch of clear road.
function lanesWithin(plan: SpawnPlan<string>, clearDistance: number): number {
  const { laneCount, laneMoveSeconds, scrollSpeed } = plan;
  const maxReach = laneCount - 1;
  if (laneMoveSeconds <= 0) {
    return maxReach;
  }
  const moves = Math.floor(clearDistance / (scrollSpeed * laneMoveSeconds));
  return Math.min(maxReach, moves);
}

// Every row has a window, the distance over which a one-row spawn on it overlaps the pack,
// and a gap of clear road before the next row's window, where the pack changes lanes.
export function laneReach(plan: SpawnPlan<string>): LaneReach {
  const { minSpacing, sightLength } = plan;
  const window = blockingLength(plan, 1);
  if (window > minSpacing) {
    throw new Error("minSpacing must be at least a row's blocking length, or rows overlap");
  }
  if (minSpacing > window + sightLength) {
    throw new Error("minSpacing must keep the next row in sight before the pack steers for it");
  }
  return {
    betweenRows: lanesWithin(plan, minSpacing - window),
    entry: lanesWithin(plan, 2 * minSpacing - window),
  };
}

// True when every lane in from has a lane in to no more than reach lanes away, with every
// lane on the way, both ends included, clear.
export function everyLaneReaches(
  reach: number,
  from: readonly number[],
  to: readonly number[],
  clear: (lane: number) => boolean = () => true,
): boolean {
  const pathClear = (a: number, b: number) => {
    for (let lane = Math.min(a, b); lane <= Math.max(a, b); lane++) {
      if (!clear(lane)) {
        return false;
      }
    }
    return true;
  };
  return from.every((lane) =>
    to.some((target) => Math.abs(target - lane) <= reach && pathClear(lane, target)),
  );
}

const allLanes = (laneCount: number) => Array.from({ length: laneCount }, (_, lane) => lane);

interface Cell {
  lane: number;
  row: number;
}

// Which rows' windows and gaps a lane-blocking spawn rows long, placed on row, overlaps.
// Rows are minSpacing apart, so the indexes are counted from distances.
function blockingSpan(plan: SpawnPlan<string>, row: number, rows: number) {
  const window = blockingLength(plan, 1);
  const reach = blockingLength(plan, rows);
  // Window k (k >= row) starts (k - row) * minSpacing after this row and is overlapped while
  // that is less than reach; gap k starts window after window k.
  const lastRow = row + Math.ceil(reach / plan.minSpacing) - 1;
  const lastGap = row + Math.ceil((reach - window) / plan.minSpacing) - 1;
  return { lastGap, lastRow };
}

// Every spawn takes free cells of a lane-by-row grid. Each kind's spawns are spread over
// equal stretches of the zone, one per stretch, so no kind bunches up; kinds with bigger
// footprints are placed first. Lane-blocking spawns only take cells that keep every hit
// avoidable: each row's window and the gap after it keep minOpenLanes open, and from any
// lane of the previous zone, and from every open lane of each row, an open lane of the next
// row is within reach without crossing a lane blocked in the gap between them. A spawn more
// than one row long blocks every window and gap it overlaps, and must end within the zone's
// last row. A plan that cannot fit its quotas that way is a data error and throws.
export function planSpawns<Kind extends string>(
  random: Random,
  plan: SpawnPlan<Kind>,
): SpawnEvent<Kind>[] {
  const { laneCount, minOpenLanes } = plan;
  const reach = laneReach(plan);
  const rows = spawnRowDistances(plan.minSpacing, plan.zoneLength);
  const taken = rows.map(() => new Set<number>());
  const blocked = rows.map(() => new Set<number>());
  const gapBlocked = rows.map(() => new Set<number>());
  const events: SpawnEvent<Kind>[] = [];
  const lanes = allLanes(laneCount);

  const openLanes = (row: number) => lanes.filter((lane) => !itemAt(blocked, row).has(lane));

  const crossesFrom = (row: number): boolean => {
    if (row === -1) {
      return everyLaneReaches(reach.entry, lanes, openLanes(0));
    }
    if (row === rows.length - 1) {
      return true;
    }
    const gap = itemAt(gapBlocked, row);
    return everyLaneReaches(
      reach.betweenRows,
      openLanes(row),
      openLanes(row + 1),
      (lane) => !gap.has(lane),
    );
  };

  // Blocks the footprint's lanes, checks every transition it touches, and undoes the block
  // unless keep is set and the checks pass.
  const tryBlock = (cell: Cell, footprint: Footprint, keep: boolean): boolean => {
    const { lastGap, lastRow } = blockingSpan(plan, cell.row, footprint.rows);
    if (lastRow >= rows.length || lastGap >= rows.length - 1) {
      return false;
    }
    const covered = Array.from({ length: footprint.lanes }, (_, i) => cell.lane + i);
    const added: [Set<number>, number][] = [];
    const block = (set: Set<number>) => {
      for (const lane of covered) {
        if (!set.has(lane)) {
          set.add(lane);
          added.push([set, lane]);
        }
      }
    };
    for (let row = cell.row; row <= lastRow; row++) {
      block(itemAt(blocked, row));
    }
    for (let row = cell.row; row <= lastGap; row++) {
      block(itemAt(gapBlocked, row));
    }
    let ok = true;
    for (let row = cell.row; ok && row <= lastRow; row++) {
      ok = laneCount - itemAt(blocked, row).size >= minOpenLanes;
    }
    for (let row = cell.row; ok && row <= lastGap; row++) {
      ok = laneCount - itemAt(gapBlocked, row).size >= minOpenLanes;
    }
    for (let row = cell.row - 1; ok && row <= lastRow; row++) {
      ok = crossesFrom(row);
    }
    if (!ok || !keep) {
      added.forEach(([set, lane]) => set.delete(lane));
    }
    return ok;
  };

  // The rows a spawn's cells take: a lane-blocking spawn every row whose window it overlaps.
  const rowsTaken = (cell: Cell, footprint: Footprint, blocksLane: boolean): number[] => {
    const last = blocksLane ? blockingSpan(plan, cell.row, footprint.rows).lastRow : cell.row;
    return Array.from({ length: last - cell.row + 1 }, (_, i) => cell.row + i);
  };

  const fits = (cell: Cell, footprint: Footprint, blocksLane: boolean): boolean => {
    if (cell.lane + footprint.lanes > laneCount) {
      return false;
    }
    for (const row of rowsTaken(cell, footprint, blocksLane)) {
      if (row >= rows.length) {
        return false;
      }
      for (let lane = cell.lane; lane < cell.lane + footprint.lanes; lane++) {
        if (itemAt(taken, row).has(lane)) {
          return false;
        }
      }
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

  const area = (quota: SpawnQuota<Kind>) => {
    const { lanes, rows: length } = quota.footprint ?? SINGLE_CELL;
    return lanes * length;
  };
  // Sorting a copy leaves the plan alone; sort is stable, so equal areas keep their order.
  const ordered = [...plan.quotas].sort((a, b) => area(b) - area(a));
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
      if (cells.length === 0) {
        throw new Error(`No room left in the zone to spawn ${quota.kind}`);
      }
      const cell = randomPick(random, cells);
      for (const row of rowsTaken(cell, footprint, quota.blocksLane)) {
        for (let lane = cell.lane; lane < cell.lane + footprint.lanes; lane++) {
          itemAt(taken, row).add(lane);
        }
      }
      if (quota.blocksLane) {
        tryBlock(cell, footprint, true);
      }
      events.push({ distance: itemAt(rows, cell.row), kind: quota.kind, lane: cell.lane });
    }
  }
  return events.sort((a, b) => a.distance - b.distance || a.lane - b.lane);
}

// Spawns become due once the distance travelled reaches them.
export function takeDueSpawns<Kind extends string>(
  distance: number,
  events: readonly SpawnEvent<Kind>[],
): DueSpawns<Kind> {
  return {
    due: events.filter((event) => event.distance <= distance),
    pending: events.filter((event) => event.distance > distance),
  };
}
