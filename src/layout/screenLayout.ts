import type { Rect } from "./rect";

export interface ScreenConfig {
  backdropHeight: number;
  dogColumnWidth: number;
  dogSlotCount: number;
  dogSlotPadding: number;
  height: number;
  topBarHeight: number;
  width: number;
}

// Top to bottom: the top bar, the backdrop band across the full width, then the dog column
// beside the road.
export interface ScreenLayout {
  backdrop: Rect;
  dogColumn: Rect;
  dogSlots: Rect[];
  road: Rect;
  topBar: Rect;
}

// The dog column has a fixed number of equal slots, so the road keeps its width however many
// dogs are left. Each slot is padded at the sides and top, so the last one meets the bottom.
export function screenLayout(config: ScreenConfig): ScreenLayout {
  const { backdropHeight, dogColumnWidth, dogSlotCount, dogSlotPadding, height, width } = config;
  const bodyY = config.topBarHeight + backdropHeight;
  const bodyHeight = height - bodyY;
  const slotHeight = bodyHeight / dogSlotCount;
  const dogSlots = Array.from({ length: dogSlotCount }, (_, i) => ({
    height: slotHeight - dogSlotPadding,
    width: dogColumnWidth - 2 * dogSlotPadding,
    x: dogSlotPadding,
    y: bodyY + dogSlotPadding + i * slotHeight,
  }));
  return {
    backdrop: { height: backdropHeight, width, x: 0, y: config.topBarHeight },
    dogColumn: { height: bodyHeight, width: dogColumnWidth, x: 0, y: bodyY },
    dogSlots,
    road: { height: bodyHeight, width: width - dogColumnWidth, x: dogColumnWidth, y: bodyY },
    topBar: { height: config.topBarHeight, width, x: 0, y: 0 },
  };
}
