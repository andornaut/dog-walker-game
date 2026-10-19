import type { Rect } from "./rect";

export type LaneDirection = -1 | 1;

// Lanes split the road into equal widths.
export function laneCenterXs(laneCount: number, road: Rect): number[] {
  const laneWidth = road.width / laneCount;
  return Array.from({ length: laneCount }, (_, i) => road.x + laneWidth * (i + 0.5));
}

// The boundaries between adjacent lanes, excluding the road's outer edges.
export function laneDividerXs(laneCount: number, road: Rect): number[] {
  const laneWidth = road.width / laneCount;
  return Array.from({ length: laneCount - 1 }, (_, i) => road.x + laneWidth * (i + 1));
}

// Held at the edge lanes rather than leaving the road.
export function moveLane(laneCount: number, direction: LaneDirection, lane: number): number {
  return Math.min(laneCount - 1, Math.max(0, lane + direction));
}
