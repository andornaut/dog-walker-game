import type { Rect } from "./layout";

// The x coordinate of each lane's centre, for lanes that split the road evenly.
export function laneCenters(laneCount: number, road: Rect): number[] {
  const laneWidth = road.width / laneCount;
  return Array.from({ length: laneCount }, (_, i) => road.x + laneWidth * (i + 0.5));
}
