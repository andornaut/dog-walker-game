import type { Rect } from "./rect";

export interface ScreenConfig {
  backdropHeight: number;
  dogRowHeight: number;
  dogSlotCount: number;
  height: number;
  roadIntoBand: number;
  roadWidth: number;
  topBarHeight: number;
  width: number;
}

// Top to bottom, each across the full width: the top bar, the backdrop band, the road and
// the row of doghouses. roadView is the road as drawn, verges included; road is its lanes,
// centred in it, which the walk, the lanes and the projection use. approach is the band's
// bottom rows, where the backdrop paints the road's approach to its cross street: the moving
// road surface is drawn over them, beside the backdrop's own verges. rasterView is the
// approach and roadView together, which the road raster draws.
export interface ScreenLayout {
  approach: Rect;
  backdrop: Rect;
  dogRow: Rect;
  dogSlots: Rect[];
  rasterView: Rect;
  road: Rect;
  roadView: Rect;
  topBar: Rect;
}

// The doghouse row has a fixed number of equal slots, so the slots keep their place however
// many dogs are left.
export function screenLayout(config: ScreenConfig): ScreenLayout {
  const { backdropHeight, dogRowHeight, dogSlotCount, height, roadWidth, width } = config;
  const roadY = config.topBarHeight + backdropHeight;
  const dogRowY = height - dogRowHeight;
  const roadView = { height: dogRowY - roadY, width, x: 0, y: roadY };
  const slotWidth = width / dogSlotCount;
  const approach = { height: config.roadIntoBand, width, x: 0, y: roadY - config.roadIntoBand };
  return {
    approach,
    backdrop: { height: backdropHeight, width, x: 0, y: config.topBarHeight },
    dogRow: { height: dogRowHeight, width, x: 0, y: dogRowY },
    dogSlots: Array.from({ length: dogSlotCount }, (_, i) => ({
      height: dogRowHeight,
      width: slotWidth,
      x: i * slotWidth,
      y: dogRowY,
    })),
    rasterView: { ...roadView, height: roadView.height + approach.height, y: approach.y },
    road: { ...roadView, width: roadWidth, x: (width - roadWidth) / 2 },
    roadView,
    topBar: { height: config.topBarHeight, width, x: 0, y: 0 },
  };
}
