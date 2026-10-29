import { clampIndex } from "@andornaut/game-kit/arrays";
import type { Rect } from "@andornaut/game-kit/rect";

export type LaneDirection = -1 | 1;

// Lanes split the road into equal widths.
export function laneCentreXs(laneCount: number, road: Rect): number[] {
  const laneWidth = road.width / laneCount;
  return Array.from({ length: laneCount }, (_, i) => road.x + laneWidth * (i + 0.5));
}

// The boundaries between adjacent lanes, excluding the road's outer edges.
export function laneDividerXs(laneCount: number, road: Rect): number[] {
  const laneWidth = road.width / laneCount;
  return Array.from({ length: laneCount - 1 }, (_, i) => road.x + laneWidth * (i + 1));
}

// The lane mask of count lanes from first on: bit i set for lane i.
export function laneMask(first: number, count: number): number {
  return ((1 << count) - 1) << first;
}

// Held at the edge lanes rather than leaving the road.
export function moveLane(laneCount: number, direction: LaneDirection, lane: number): number {
  return clampIndex(laneCount, lane + direction);
}
