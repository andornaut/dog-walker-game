import { roadCameraFor } from "../layout/projection";
import { type ScreenConfig, screenLayout, walkerFootY } from "../layout/screenLayout";
import { TUNING } from "./tuning";

// Internal render resolution: portrait, scaled to the window without smoothing.
// The backdrop band ends backdropHeight rows under the walk bar, and its bottom rows,
// roadIntoBand, are the approach the backdrop paints; the camera derives from the band. The
// neighbourhood's progress line takes the screen's last zoneProgressHeight rows: its borders
// and a row per fill colour (ZONE_PROGRESS in src/hud/walkHud.ts).
export const SCREEN_CONFIG: ScreenConfig = {
  backdropHeight: 158,
  dogCardHeight: 70,
  dogRowHeight: 74,
  dogSlotCount: 3,
  height: 560,
  roadIntoBand: 19,
  roadWidth: 320,
  topBarHeight: 48,
  width: 360,
  zoneProgressHeight: 4,
};

export const LANE_COUNT = 5;

// The pseudo-3D road's camera: the screen row the road's vanishing point sits on, and the
// ground's screen speed at the walker's feet relative to sprite scale there. The road's far
// edge, on the backdrop band's bottom edge, is at scale 0.5 whatever the speed, so the
// backdrops, drawn to continue the road at their bottom row, keep their join. The rest of the
// camera derives from the band's bottom edge and the walker's feet.
export const ROAD_FAR_SCALE = 0.5;
const { road } = screenLayout(SCREEN_CONFIG);
export const ROAD_CAMERA = roadCameraFor({
  farScale: ROAD_FAR_SCALE,
  farY: road.y,
  footY: walkerFootY(road),
  visibleDistance: TUNING.seconds.lookAheadSeconds * TUNING.pixels.roadScrollSpeed,
});
