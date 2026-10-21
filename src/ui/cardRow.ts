import type { Rect } from "../lib/rect";

export interface CardRowSpec {
  cardHeight: number;
  cardWidth: number;
  gap: number;
  maxCount: number;
}

// The header over a card row, by the tops of its capitals: the 2x title titleRise above the
// cards, then a dark band (ui-strip-well) across the row behind the 1x subtitle and, once a
// number key has been pressed, each card's 1x key number centred over it. The band's ink well
// runs from its second row to 6 rows above its bottom, and the band ends a row above the
// cards.
export const CARD_HEADER = {
  bandRise: 25,
  keyRise: 13,
  keysHeight: 24,
  plainHeight: 16,
  subtitleRise: 22,
  titleRise: 38,
} as const;

interface CardHeader {
  band: Rect;
  keyTop: number;
  subtitleTop: number;
  titleTop: number;
}

// The header over cards, a row's rects, its band taller while key numbers show.
export function cardHeader(withKeys: boolean, cards: readonly Rect[]): CardHeader {
  const first = cards[0];
  const last = cards.at(-1);
  if (first === undefined || last === undefined) {
    throw new RangeError("A card header needs a card");
  }
  const { bandRise, keyRise, keysHeight, plainHeight, subtitleRise, titleRise } = CARD_HEADER;
  const top = first.y;
  return {
    band: {
      height: withKeys ? keysHeight : plainHeight,
      width: last.x + last.width - first.x,
      x: first.x,
      y: top - bandRise,
    },
    keyTop: top - keyRise,
    subtitleTop: top - subtitleRise,
    titleTop: top - titleRise,
  };
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
