import { itemAt } from "../arrays";
import { type Random, randomPick } from "./random";

// blocksLane marks kinds the pack must steer around, such as obstacles.
export interface SpawnQuota<Kind extends string> {
  blocksLane: boolean;
  count: number;
  kind: Kind;
}

// Distances are scroll distances in pixels from the start of the zone.
export interface SpawnPlan<Kind extends string> {
  laneCount: number;
  minSpacing: number;
  quotas: readonly SpawnQuota<Kind>[];
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

interface Cell {
  lane: number;
  row: number;
}

// Rows minSpacing apart, leaving at least minSpacing clear at both ends of the zone.
export function spawnRowDistances(minSpacing: number, zoneLength: number): number[] {
  if (minSpacing <= 0) {
    throw new Error("minSpacing must be positive");
  }
  const count = Math.max(0, Math.floor(zoneLength / minSpacing) - 1);
  return Array.from({ length: count }, (_, i) => (i + 1) * minSpacing);
}

// Every spawn takes one free cell of a lane-by-row grid. Each kind's spawns are spread
// over equal stretches of the zone, one per stretch, so no kind bunches up. A row never
// takes as many lane-blocking spawns as there are lanes, so one lane always stays open.
export function planSpawns<Kind extends string>(
  random: Random,
  plan: SpawnPlan<Kind>,
): SpawnEvent<Kind>[] {
  const { laneCount, quotas } = plan;
  const rows = spawnRowDistances(plan.minSpacing, plan.zoneLength);
  const taken = rows.map(() => new Set<number>());
  const blockedCounts = rows.map(() => 0);
  const events: SpawnEvent<Kind>[] = [];

  const freeCells = (blocksLane: boolean, firstRow: number, endRow: number): Cell[] => {
    const cells: Cell[] = [];
    for (let row = firstRow; row < endRow; row++) {
      if (blocksLane && itemAt(blockedCounts, row) >= laneCount - 1) {
        continue;
      }
      for (let lane = 0; lane < laneCount; lane++) {
        if (!itemAt(taken, row).has(lane)) {
          cells.push({ lane, row });
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
        blockedCounts[row] = itemAt(blockedCounts, row) + 1;
      }
      events.push({ distance: itemAt(rows, row), kind, lane });
    }
  }
  return events.sort((a, b) => a.distance - b.distance || a.lane - b.lane);
}

// Spawns become due once the zone's distance travelled reaches them.
export function takeDueSpawns<Kind extends string>(
  zoneDistance: number,
  events: readonly SpawnEvent<Kind>[],
): DueSpawns<Kind> {
  return {
    due: events.filter((event) => event.distance <= zoneDistance),
    pending: events.filter((event) => event.distance > zoneDistance),
  };
}
