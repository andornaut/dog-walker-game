import type { Rect } from "@andornaut/game-kit/rect";

import { BUTTON_SIZE } from "../ui/buttonGeometry";

// The smallest tap target each way, in game pixels: 48 CSS pixels on a 390px-wide phone.
export const MIN_TAP_SIZE = BUTTON_SIZE.icon.target;

// An overlay's full-width button, centred on the screen.
export const WIDE_BUTTON = { ...BUTTON_SIZE.wide, x: 32 } as const;

// How far the walker's feet stand above the bottom of the road.
const WALKER_FEET_ABOVE_ROAD_BOTTOM = 4;

export interface ScreenConfig {
  backdropHeight: number;
  dogCardHeight: number;
  dogRowHeight: number;
  dogSlotCount: number;
  height: number;
  junctionRows: number;
  roadIntoBand: number;
  roadWidth: number;
  topBarHeight: number;
  width: number;
  zoneProgressHeight: number;
}

// The whole screen (screen), and top to bottom, each across the full width: the walk bar (topBar),
// the backdrop band, the road, the row of dog cards and the neighbourhood's progress line
// (zoneProgress) on the screen's last zoneProgressHeight rows. dogSlots are the cards,
// dogCardHeight tall on the row's bottom rows. roadView is the road as drawn, verges included; road
// is its lanes, centred in it, which the walk, the lanes and the projection use. approach is the
// band's bottom rows, where the backdrop paints the road's approach to its cross street: the moving
// road surface is drawn over them, beside the backdrop's own verges. junction is the rows over the
// approach up to the cross street, where the road passes between the near corners: the moving road
// surface is drawn over them, and the corners stay the backdrop's. rasterView is the junction, the
// approach and roadView together, which the road raster draws. walkView is the backdrop band and
// roadView together, everything between the walk bar and the dog cards, which a card or the pause
// menu dims.
export interface ScreenLayout {
  approach: Rect;
  backdrop: Rect;
  dogRow: Rect;
  dogSlots: Rect[];
  junction: Rect;
  rasterView: Rect;
  road: Rect;
  roadView: Rect;
  screen: Rect;
  topBar: Rect;
  walkView: Rect;
  zoneProgress: Rect;
}

// The card row has a fixed number of equal slots, so the cards keep their place however many
// dogs are left.
export function screenLayout(config: ScreenConfig): ScreenLayout {
  const { backdropHeight, dogRowHeight, dogSlotCount, height, roadWidth, width } = config;
  const roadY = config.topBarHeight + backdropHeight;
  const zoneProgressY = height - config.zoneProgressHeight;
  const dogRowY = zoneProgressY - dogRowHeight;
  const roadView = { height: dogRowY - roadY, width, x: 0, y: roadY };
  const slotWidth = width / dogSlotCount;
  const backdrop = { height: backdropHeight, width, x: 0, y: config.topBarHeight };
  const approach = { height: config.roadIntoBand, width, x: 0, y: roadY - config.roadIntoBand };
  const junction = {
    ...approach,
    height: config.junctionRows,
    y: approach.y - config.junctionRows,
  };
  return {
    approach,
    backdrop,
    dogRow: { height: dogRowHeight, width, x: 0, y: dogRowY },
    dogSlots: Array.from({ length: dogSlotCount }, (_, i) => ({
      height: config.dogCardHeight,
      width: slotWidth,
      x: i * slotWidth,
      y: zoneProgressY - config.dogCardHeight,
    })),
    junction,
    rasterView: { ...roadView, height: roadY + roadView.height - junction.y, y: junction.y },
    road: { ...roadView, width: roadWidth, x: (width - roadWidth) / 2 },
    roadView,
    screen: { height, width, x: 0, y: 0 },
    topBar: { height: config.topBarHeight, width, x: 0, y: 0 },
    walkView: { ...roadView, height: dogRowY - backdrop.y, y: backdrop.y },
    zoneProgress: { height: config.zoneProgressHeight, width, x: 0, y: zoneProgressY },
  };
}

// The screen row the walker's feet stand on.
export function walkerFootY(road: Rect): number {
  return road.y + road.height - WALKER_FEET_ABOVE_ROAD_BOTTOM;
}
