import { packBand, tallestPackBand } from "../layout/packFormation";
import type { Rect } from "../layout/rect";
import type { RoadGeometry } from "./walk";

// How far the walker's feet stand above the bottom of the road.
const WALKER_FEET_ABOVE_ROAD_BOTTOM = 6;

// An obstacle's hit box is its footprint less this much at each end, so an n-lane, m-row
// obstacle is drawn and hit 56n-24 by 56m-24 on 56px lanes.
const FOOTPRINT_INSET = 12;

// Collision heights in screen pixels of what is not an obstacle: the part of each sprite that
// bumps into the pack.
const ITEM_HEIGHTS: RoadGeometry["itemHeights"] = {
  forcedStop: 16,
  lucky: 20,
  tip: 12,
  treat: 12,
};

export function walkerFootY(road: Rect): number {
  return road.y + road.height - WALKER_FEET_ABOVE_ROAD_BOTTOM;
}

// A footprint row is a lane-width of road, so a cell is square.
export function walkGeometry(laneCount: number, dogCount: number, road: Rect): RoadGeometry {
  const footY = walkerFootY(road);
  const tallest = tallestPackBand(footY);
  const bandBottom = packBand(1, footY).bottom;
  return {
    cell: { inset: FOOTPRINT_INSET, length: road.width / laneCount },
    itemHeights: ITEM_HEIGHTS,
    laneCount,
    packBand: packBand(dogCount, footY),
    roadBottom: road.y + road.height,
    roadTop: road.y,
    sightLength: bandBottom - tallest - road.y,
    tallestPackBand: tallest,
  };
}
