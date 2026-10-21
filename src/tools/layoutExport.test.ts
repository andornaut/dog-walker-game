import { describe, expect, it } from "vitest";

import { ROAD_HIT_SIZE, ROAD_SPRITE_SIZE } from "../assets/spriteKeys";
import { gameData } from "../data";
import { ROAD_CAMERA, ROAD_FAR_SCALE, SCREEN_CONFIG } from "../data/screen";
import { TUNING } from "../data/tuning";
import {
  COLLAR_HEIGHT,
  drawnPackBand,
  PACK_DRAW_SCALE,
  packBand,
  packPlacements,
  WALKER_HANDS,
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
  it.each([
    ["camera.farScale", layout.camera.farScale, ROAD_FAR_SCALE],
    ["camera.farY", layout.camera.farY, road.y],
    ["camera.focal", layout.camera.focal, projection.focal],
    ["camera.footY", layout.camera.footY, footY],
    ["camera.horizonY", layout.camera.horizonY, ROAD_CAMERA.horizonY],
    ["camera.secondsInView", layout.camera.secondsInView, TUNING.seconds.lookAheadSeconds],
    ["camera.visibleDistance", layout.camera.visibleDistance, lookAhead],
  ])("exports %s from the camera", (_field, actual, expected) => {
    expect(actual).toBeCloseTo(expected, 6);
  });

  it.each([
    ["pack.collarHeight", layout.pack.collarHeight, COLLAR_HEIGHT],
    ["pack.drawScale", layout.pack.drawScale, PACK_DRAW_SCALE],
    ["pack.walkerHands", layout.pack.walkerHands, WALKER_HANDS],
    ["roadSprites", layout.roadSprites, { drawSize: ROAD_SPRITE_SIZE, hitSize: ROAD_HIT_SIZE }],
  ])("exports %s as the game draws it", (_field, actual, expected) => {
    expect(actual).toEqual(expected);
  });

  it.each(layout.pack.formations.map((formation, i) => [i + 1, formation] as const))(
    "exports a pack of %d's drawn formation and its drawn and hit bands",
    (count, formation) => {
      expect(formation).toEqual(packPlacements(count, layout.pack.clearance));
      expect(layout.pack.bands[count - 1]).toEqual({
        drawn: drawnPackBand(count, footY, layout.pack.clearance),
        hit: packBand(count, footY),
      });
    },
  );
});
