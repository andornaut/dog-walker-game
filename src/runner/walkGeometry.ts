import { ROAD_HIT_SIZE } from "../assets/spriteKeys";
import {
  packOnRoad,
  packOutline,
  type PackSprites,
  PART_INSET,
  type PartBox,
  tallestPackLength,
} from "../layout/packFormation";
import { type RoadCamera, type RoadProjection, roadProjection } from "../layout/projection";
import { walkerFootY } from "../layout/screenLayout";
import type { Rect } from "../lib/rect";
import type { RoadGeometry } from "./walk";

// A pickup's or lucky find's hit box is its lanes less the inset at each side, a cell's spare
// width beside ROAD_HIT_SIZE, so one lane hits 40px wide on 64px lanes, whatever size it is
// drawn.
function footprintInset(cellLength: number): number {
  return (cellLength - ROAD_HIT_SIZE) / 2;
}

// Collision heights in screen pixels of what is not an obstacle: the part of each sprite that
// bumps into the pack, at the hit size, whatever size it is drawn.
const ITEM_HEIGHTS: RoadGeometry["itemHeights"] = {
  lucky: 25,
  tip: 15,
  treat: 15,
};

// The pseudo-3D projection of the road the walker stands on.
export function walkProjection(camera: RoadCamera, road: Rect): RoadProjection {
  return roadProjection(camera, walkerFootY(road), road);
}

// A footprint row is a lane-width of road, so a cell is square. The road runs from the
// walker's feet to the far edge of the projected road in view, where spawns come into view. The
// pack's hit rectangles, outline and band are those of this walker and these dogs.
export function walkGeometry(
  laneCount: number,
  pack: PackSprites,
  projection: Pick<RoadProjection, "focal" | "footY" | "horizonY" | "visibleDistance">,
  road: Rect,
): RoadGeometry {
  const footY = walkerFootY(road);
  const tallest = tallestPackLength(projection);
  const parts = packOnRoad(projection, PART_INSET, pack);
  const along = <Part extends PartBox>(part: Part): Part => ({
    ...part,
    bottom: footY + part.bottom,
    top: footY + part.top,
  });
  const outline = along(packOutline(packOnRoad(projection, 0, pack)));
  const roadTop = footY - projection.visibleDistance;
  return {
    cell: { inset: footprintInset(road.width / laneCount), length: road.width / laneCount },
    itemHeights: ITEM_HEIGHTS,
    laneCount,
    lens: {
      centerX: road.width / 2,
      focal: projection.focal,
      footY: projection.footY,
      horizonY: projection.horizonY,
    },
    packBand: { bottom: outline.bottom, top: outline.top },
    packParts: { dogs: parts.dogs.map(along), outline, walker: along(parts.walker) },
    roadBottom: road.y + road.height,
    roadTop,
    sightLength: outline.bottom - tallest - roadTop,
    tallestPackBand: tallest,
  };
}
