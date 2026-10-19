import { itemAt } from "../arrays";
import { type Random, randomPick } from "./random";

// blocksLane marks kinds the pack must steer around, such as obstacles.
export interface SpawnQuota<Kind extends string> {
  blocksLane: boolean;
  count: number;
  kind: Kind;
}

// Distances are scroll distances in pixels from the start of the zone. blockingLength is
// the scroll distance over which a lane-blocking spawn overlaps the pack: its own height
// plus the pack's. scrollSpeed (pixels per second) and laneMoveSeconds set how far the
// pack can steer between one row and the next.
export interface SpawnPlan<Kind extends string> {
  blockingLength: number;
  laneCount: number;
  laneMoveSeconds: number;
  minSpacing: number;
  quotas: readonly SpawnQuota<Kind>[];
  scrollSpeed: number;
  zoneLength: number;
}

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

interface Cell {
  lane: number;
  row: number;
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

// Whole lane moves that fit in the clear scroll distance between two blocking windows.
// The pack only changes lane in that gap, so the lanes it crosses never matter.
function lanesWithin(plan: SpawnPlan<string>, clearDistance: number): number {
  const { laneCount, laneMoveSeconds, scrollSpeed } = plan;
  const maxReach = laneCount - 1;
  if (laneMoveSeconds <= 0) {
    return maxReach;
  }
  const moves = Math.floor(clearDistance / (scrollSpeed * laneMoveSeconds));
  return Math.min(maxReach, moves);
}

export function laneReach(plan: SpawnPlan<string>): LaneReach {
  const { blockingLength, minSpacing } = plan;
  if (blockingLength > minSpacing) {
    throw new Error("minSpacing must be at least blockingLength, or rows overlap the pack");
  }
  return {
    betweenRows: lanesWithin(plan, minSpacing - blockingLength),
    entry: lanesWithin(plan, 2 * minSpacing - blockingLength),
  };
}

// True when every lane in from has a lane in to no more than reach lanes away.
export function everyLaneReaches(
  reach: number,
  from: readonly number[],
  to: readonly number[],
): boolean {
  return from.every((lane) => to.some((target) => Math.abs(target - lane) <= reach));
}

const allLanes = (laneCount: number) => Array.from({ length: laneCount }, (_, lane) => lane);

// Every spawn takes one free cell of a lane-by-row grid. Each kind's spawns are spread
// over equal stretches of the zone, one per stretch, so no kind bunches up. Lane-blocking
// spawns only take cells that keep every hit avoidable: from any lane of the previous
// zone, and from every open lane of each row, an open lane of the next row is within
// reach. A plan that cannot fit its quotas that way is a data error and throws.
export function planSpawns<Kind extends string>(
  random: Random,
  plan: SpawnPlan<Kind>,
): SpawnEvent<Kind>[] {
  const { laneCount, quotas } = plan;
  const reach = laneReach(plan);
  const rows = spawnRowDistances(plan.minSpacing, plan.zoneLength);
  const taken = rows.map(() => new Set<number>());
  const blocked = rows.map(() => new Set<number>());
  const events: SpawnEvent<Kind>[] = [];

  const openLanes = (row: number, extraBlocked?: number) =>
    allLanes(laneCount).filter((lane) => !itemAt(blocked, row).has(lane) && lane !== extraBlocked);

  const keepsReachable = ({ lane, row }: Cell): boolean => {
    const open = openLanes(row, lane);
    const into =
      row === 0
        ? everyLaneReaches(reach.entry, allLanes(laneCount), open)
        : everyLaneReaches(reach.betweenRows, openLanes(row - 1), open);
    const onward =
      row === rows.length - 1 || everyLaneReaches(reach.betweenRows, open, openLanes(row + 1));
    return into && onward;
  };

  const freeCells = (blocksLane: boolean, firstRow: number, endRow: number): Cell[] => {
    const cells: Cell[] = [];
    for (let row = firstRow; row < endRow; row++) {
      for (let lane = 0; lane < laneCount; lane++) {
        const cell = { lane, row };
        if (!itemAt(taken, row).has(lane) && (!blocksLane || keepsReachable(cell))) {
          cells.push(cell);
        }
      }
    }
    return cells;
  };

  for (const { blocksLane, count, kind } of quotas) {
    for (let i = 0; i < count; i++) {
      const stretch = freeCells(
        blocksLane,
        Math.floor((i * rows.length) / count),
        Math.floor(((i + 1) * rows.length) / count),
      );
      const cells = stretch.length > 0 ? stretch : freeCells(blocksLane, 0, rows.length);
      if (cells.length === 0) {
        throw new Error(`No room left in the zone to spawn ${kind}`);
      }
      const { lane, row } = randomPick(random, cells);
      itemAt(taken, row).add(lane);
      if (blocksLane) {
        itemAt(blocked, row).add(lane);
      }
      events.push({ distance: itemAt(rows, row), kind, lane });
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
