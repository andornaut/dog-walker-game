import type { ScreenConfig } from "../layout/screenLayout";

// Internal render resolution: portrait 9:16, scaled to the window without smoothing.
export const SCREEN_CONFIG: ScreenConfig = {
  backdropHeight: 150,
  dogColumnWidth: 80,
  dogSlotCount: 3,
  dogSlotPadding: 4,
  height: 640,
  topBarHeight: 40,
  width: 360,
};

export const LANE_COUNT = 5;

// The pseudo-3D road's camera: the screen row the road's vanishing point sits on, and the
// ground's screen speed at the walker's feet relative to sprite scale there. The backdrops
// are drawn to continue this road at their bottom row.
export const ROAD_CAMERA = { horizonY: -260, ratio: 1.4 } as const;
