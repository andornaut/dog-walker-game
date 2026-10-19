import type { Rect } from "./rect";

export interface CardRowSpec {
  cardHeight: number;
  cardWidth: number;
  gap: number;
  maxCount: number;
}

// Cards of a fixed size, gap apart, centred in the area on whole pixels: an odd pixel left
// over goes to the right margin. Throws a RangeError for a count outside 1 to maxCount.
export function cardRowRects(spec: CardRowSpec, count: number, area: Rect): Rect[] {
  const { cardHeight, cardWidth, gap, maxCount } = spec;
  if (!Number.isInteger(count) || count < 1 || count > maxCount) {
    throw new RangeError(`A card row holds 1 to ${maxCount} cards, not ${count}`);
  }
  const rowWidth = count * cardWidth + (count - 1) * gap;
  const left = area.x + Math.floor((area.width - rowWidth) / 2);
  const y = area.y + Math.floor((area.height - cardHeight) / 2);
  return Array.from({ length: count }, (_, i) => ({
    height: cardHeight,
    width: cardWidth,
    x: left + i * (cardWidth + gap),
    y,
  }));
}
