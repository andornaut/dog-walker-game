import { insetRect, type Rect } from "./rect";

export interface ScreenConfig {
  dogColumnWidth: number;
  dogSlotCount: number;
  dogSlotPadding: number;
  height: number;
  topBarHeight: number;
  width: number;
}

export interface ScreenLayout {
  dogColumn: Rect;
  dogSlots: Rect[];
  road: Rect;
  topBar: Rect;
}

// The dog column has a fixed number of equal slots, so the road keeps its width
// however many dogs are left.
export function screenLayout(config: ScreenConfig): ScreenLayout {
  const { dogColumnWidth, dogSlotCount, dogSlotPadding, height, topBarHeight, width } = config;
  const bodyHeight = height - topBarHeight;
  const slotHeight = bodyHeight / dogSlotCount;
  const dogSlots = Array.from({ length: dogSlotCount }, (_, i) =>
    insetRect(dogSlotPadding, {
      height: slotHeight,
      width: dogColumnWidth,
      x: 0,
      y: topBarHeight + i * slotHeight,
    }),
  );
  return {
    dogColumn: { height: bodyHeight, width: dogColumnWidth, x: 0, y: topBarHeight },
    dogSlots,
    road: { height: bodyHeight, width: width - dogColumnWidth, x: dogColumnWidth, y: topBarHeight },
    topBar: { height: topBarHeight, width, x: 0, y: 0 },
  };
}
