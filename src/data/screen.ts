import { roadCameraFor } from "../layout/projection";
import { type ScreenConfig, screenLayout } from "../layout/screenLayout";
import { walkerFootY } from "../runner/walkGeometry";
import { TUNING } from "./tuning";

// Internal render resolution: portrait, scaled to the window without smoothing.
export const SCREEN_CONFIG: ScreenConfig = {
  backdropHeight: 110,
  dogRowHeight: 90,
  dogSlotCount: 3,
  height: 560,
  roadIntoBand: 24,
  roadWidth: 280,
  topBarHeight: 40,
  width: 360,
};

export const LANE_COUNT = 5;

// The pseudo-3D road's camera: the screen row the road's vanishing point sits on, and the
// ground's screen speed at the walker's feet relative to sprite scale there. The road's far
// edge, on the backdrop band's bottom edge, is at scale 0.5 whatever the speed, so the
// backdrops, drawn to continue the road at their bottom row, keep their join.
const { road } = screenLayout(SCREEN_CONFIG);
export const ROAD_CAMERA = roadCameraFor({
  farScale: 0.5,
  farY: road.y,
  footY: walkerFootY(road),
  visibleDistance: TUNING.seconds.lookAheadSeconds * TUNING.pixels.roadScrollSpeed,
});
