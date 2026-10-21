import { ROAD_HIT_SIZE } from "../assets/spriteKeys";
import { packBand, tallestPackBand } from "../layout/packFormation";
import { type RoadCamera, type RoadProjection, roadProjection } from "../layout/projection";
import type { Rect } from "../layout/rect";
import type { RoadGeometry } from "./walk";

// How far the walker's feet stand above the bottom of the road.
const WALKER_FEET_ABOVE_ROAD_BOTTOM = 6;

// An obstacle's hit box is its footprint less the inset at each end, a cell's spare length
// beside ROAD_HIT_SIZE, so an n-lane, m-row obstacle is hit 64n-24 by 64m-24 on 64px lanes,
// whatever size it is drawn.
function footprintInset(cellLength: number): number {
  return (cellLength - ROAD_HIT_SIZE) / 2;
}

// Collision heights in screen pixels of what is not an obstacle: the part of each sprite that
// bumps into the pack, at the hit size, whatever size it is drawn.
const ITEM_HEIGHTS: RoadGeometry["itemHeights"] = {
  forcedStop: 20,
  lucky: 25,
  needSpot: 25,
  tip: 15,
  treat: 15,
};

export function walkerFootY(road: Rect): number {
  return road.y + road.height - WALKER_FEET_ABOVE_ROAD_BOTTOM;
}

// The pseudo-3D projection of the road the walker stands on.
export function walkProjection(camera: RoadCamera, road: Rect): RoadProjection {
  return roadProjection(camera, walkerFootY(road), road);
}

// A footprint row is a lane-width of road, so a cell is square. The road runs from the
// walker's feet to the far edge of the projected road in view, where spawns come into view.
export function walkGeometry(
  laneCount: number,
  dogCount: number,
  view: Pick<RoadProjection, "visibleDistance">,
  road: Rect,
): RoadGeometry {
  const footY = walkerFootY(road);
  const tallest = tallestPackBand(footY);
  const bandBottom = packBand(1, footY).bottom;
  const roadTop = footY - view.visibleDistance;
  return {
    cell: { inset: footprintInset(road.width / laneCount), length: road.width / laneCount },
    itemHeights: ITEM_HEIGHTS,
    laneCount,
    packBand: packBand(dogCount, footY),
    roadBottom: road.y + road.height,
    roadTop,
    sightLength: bandBottom - tallest - roadTop,
    tallestPackBand: tallest,
  };
}
