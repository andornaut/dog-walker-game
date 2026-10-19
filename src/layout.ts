export interface Rect {
  height: number;
  width: number;
  x: number;
  y: number;
}

export interface ScreenConfig {
  dogColumnWidth: number;
  dogSlotCount: number;
  dogSlotPadding: number;
  height: number;
  topBarHeight: number;
  width: number;
}

export interface Layout {
  dogColumn: Rect;
  dogSlots: Rect[];
  road: Rect;
  topBar: Rect;
}

// Splits the screen into a top bar, a dog column on the left below it, and the
// road filling the rest. The column has a fixed number of equal slots, so the
// road keeps its width however many dogs are left.
export function screenLayout(config: ScreenConfig): Layout {
  const { dogColumnWidth, dogSlotCount, dogSlotPadding, height, topBarHeight, width } = config;
  const bodyHeight = height - topBarHeight;
  const slotHeight = bodyHeight / dogSlotCount;
  const dogSlots = Array.from({ length: dogSlotCount }, (_, i) => ({
    height: slotHeight - 2 * dogSlotPadding,
    width: dogColumnWidth - 2 * dogSlotPadding,
    x: dogSlotPadding,
    y: topBarHeight + i * slotHeight + dogSlotPadding,
  }));
  return {
    dogColumn: { height: bodyHeight, width: dogColumnWidth, x: 0, y: topBarHeight },
    dogSlots,
    road: { height: bodyHeight, width: width - dogColumnWidth, x: dogColumnWidth, y: topBarHeight },
    topBar: { height: topBarHeight, width, x: 0, y: 0 },
  };
}

// Lays out a row of cards centred in an area. Cards are sized so that maxCount of
// them fill the width with the same gap at both edges and between cards, and a
// shorter row keeps that size rather than stretching.
export function cardRects(
  maxCount: number,
  gap: number,
  cardHeight: number,
  count: number,
  area: Rect,
): Rect[] {
  const cardWidth = (area.width - (maxCount + 1) * gap) / maxCount;
  const rowWidth = count * cardWidth + (count - 1) * gap;
  const left = area.x + (area.width - rowWidth) / 2;
  const y = area.y + (area.height - cardHeight) / 2;
  return Array.from({ length: count }, (_, i) => ({
    height: cardHeight,
    width: cardWidth,
    x: left + i * (cardWidth + gap),
    y,
  }));
}
