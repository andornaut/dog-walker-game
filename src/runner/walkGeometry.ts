import { packBand, tallestPackBand } from "../layout/packFormation";
import type { Rect } from "../layout/rect";
import type { RoadGeometry } from "./walk";

// How far the walker's feet stand above the bottom of the road.
const WALKER_FEET_ABOVE_ROAD_BOTTOM = 6;

// Collision heights in screen pixels: the part of each sprite that bumps into the pack.
const ITEM_HEIGHTS: RoadGeometry["itemHeights"] = {
  forcedStop: 16,
  lucky: 20,
  obstacle: 20,
  tip: 12,
  treat: 12,
};

export function walkerFootY(road: Rect): number {
  return road.y + road.height - WALKER_FEET_ABOVE_ROAD_BOTTOM;
}

export function walkGeometry(laneCount: number, dogCount: number, road: Rect): RoadGeometry {
  const footY = walkerFootY(road);
  return {
    itemHeights: ITEM_HEIGHTS,
    laneCount,
    packBand: packBand(dogCount, footY),
    roadBottom: road.y + road.height,
    roadTop: road.y,
    tallestPackBand: tallestPackBand(footY),
  };
}
