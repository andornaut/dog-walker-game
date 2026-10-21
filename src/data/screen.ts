import { roadCameraFor } from "../layout/projection";
import { type ScreenConfig, screenLayout, walkerFootY } from "../layout/screenLayout";
import { TUNING } from "./tuning";

// The backdrop band's heights: "short" ends it 110 rows under the walk bar; "tall" grows it by 48
// rows, which tilts the camera so the road's rows shrink 15%. The band's bottom rows,
// roadIntoBand, are the approach the backdrop paints. BAND picks one; the camera derives
// from it.
const BANDS = {
  short: { backdropHeight: 110, roadIntoBand: 24 },
  tall: { backdropHeight: 158, roadIntoBand: 19 },
} as const;
const BAND: keyof typeof BANDS = "tall";

// Internal render resolution: portrait, scaled to the window without smoothing.
export const SCREEN_CONFIG: ScreenConfig = {
  ...BANDS[BAND],
  dogCardHeight: 74,
  dogRowHeight: 78,
  dogSlotCount: 3,
  height: 560,
  roadWidth: 320,
  topBarHeight: 48,
  width: 360,
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
