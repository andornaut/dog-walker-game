import type { Rect } from "./rect";

export interface CardRowSpec {
  cardHeight: number;
  gap: number;
  maxCount: number;
}

// Cards are sized so that maxCount of them fill the area's width with the same gap
// at both edges and between cards. A shorter row keeps that size and is centred.
export function cardRowRects(spec: CardRowSpec, count: number, area: Rect): Rect[] {
  const { cardHeight, gap, maxCount } = spec;
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
