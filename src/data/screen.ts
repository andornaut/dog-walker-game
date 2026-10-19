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
