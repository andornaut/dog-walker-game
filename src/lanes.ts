import type { Rect } from "./layout";

// The x coordinate of each lane's centre, for lanes that split the road evenly.
export function laneCenters(laneCount: number, road: Rect): number[] {
  const laneWidth = road.width / laneCount;
  return Array.from({ length: laneCount }, (_, i) => road.x + laneWidth * (i + 0.5));
}

// The lane one step in a direction from the current one, held at the edges.
export function moveLane(laneCount: number, direction: -1 | 1, lane: number): number {
  return Math.min(laneCount - 1, Math.max(0, lane + direction));
}
