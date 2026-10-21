import { describe, expect, it } from "vitest";

import { ROAD_HIT_SIZE, ROAD_SPRITE_SIZE } from "../assets/spriteKeys";
import { gameData } from "../data";
import { ROAD_CAMERA, ROAD_FAR_SCALE, SCREEN_CONFIG } from "../data/screen";
import { TUNING } from "../data/tuning";
import {
  COLLAR_HEIGHTS,
  DOG_SILHOUETTES,
  laneHalfWidth,
  PACK_FEET,
  PACK_SLOTS,
  PART_INSET,
  WALKER_HANDS,
  WALKER_SILHOUETTES,
} from "../layout/packFormation";
import { screenLayout } from "../layout/screenLayout";
import { walkerFootY, walkProjection } from "../runner/walkGeometry";
import { layoutExport } from "./layoutExport";

const layout = layoutExport(gameData);
const { road } = screenLayout(SCREEN_CONFIG);
const footY = walkerFootY(road);
const projection = walkProjection(ROAD_CAMERA, road);
const lookAhead = TUNING.seconds.lookAheadSeconds * TUNING.pixels.roadScrollSpeed;

describe("layoutExport", () => {
  it("exports the camera, the pack and the road sprites' sizes as the game draws them", () => {
    const camera: [string, number, number][] = [
      ["camera.farScale", layout.camera.farScale, ROAD_FAR_SCALE],
      ["camera.farY", layout.camera.farY, road.y],
      ["camera.focal", layout.camera.focal, projection.focal],
      ["camera.footY", layout.camera.footY, footY],
      ["camera.horizonY", layout.camera.horizonY, ROAD_CAMERA.horizonY],
      ["camera.secondsInView", layout.camera.secondsInView, TUNING.seconds.lookAheadSeconds],
      ["camera.visibleDistance", layout.camera.visibleDistance, lookAhead],
    ];
    for (const [field, actual, expected] of camera) {
      expect(actual, field).toBeCloseTo(expected, 6);
    }
    const drawn: [string, unknown, unknown][] = [
      ["pack.collarHeights", layout.pack.collarHeights, COLLAR_HEIGHTS],
      ["pack.feet", layout.pack.feet, PACK_FEET],
      ["pack.laneHalfWidth", layout.pack.laneHalfWidth, laneHalfWidth()],
      [
        "pack.silhouettes",
        layout.pack.silhouettes,
        { dogs: DOG_SILHOUETTES, walkers: WALKER_SILHOUETTES },
      ],
      ["pack.partInset", layout.pack.partInset, PART_INSET],
      ["pack.slots", layout.pack.slots, PACK_SLOTS],
      ["pack.walkerFootY", layout.pack.walkerFootY, footY],
      ["pack.walkerHands", layout.pack.walkerHands, WALKER_HANDS],
      ["roadSprites", layout.roadSprites, { drawSize: ROAD_SPRITE_SIZE, hitSize: ROAD_HIT_SIZE }],
    ];
    for (const [field, actual, expected] of drawn) {
      expect(actual, field).toEqual(expected);
    }
  });
});
