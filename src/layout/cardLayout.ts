import { cardRowRects, type CardRowSpec } from "./cardRow";
import type { Rect } from "./rect";

// The choice cards: the card-frame sprite's parts in card pixels, the row of cards centred
// on the road, and the enlarged card a hold opens, card-frame-large, centred in the dimmed band
// and road.
export const CARD_LAYOUT = {
  art: { height: 56, width: 75, x: 5, y: 16 },
  badge: { height: 13, width: 71, x: 6, y: 121 },
  band: { height: 11, y: 2 },
  effect: { height: 42, width: 71, x: 6, y: 76 },
  height: 140,
  large: {
    art: { x: 10, y: 32 },
    badge: { height: 26, width: 142, x: 12, y: 242 },
    band: { height: 18, y: 4 },
    body: { height: 82, width: 142, x: 12, y: 152 },
    height: 280,
    width: 166,
  },
  row: { gap: 8 },
  width: 83,
} as const;

export function cardRowSpec(maxCount: number): CardRowSpec {
  return {
    cardHeight: CARD_LAYOUT.height,
    cardWidth: CARD_LAYOUT.width,
    gap: CARD_LAYOUT.row.gap,
    maxCount,
  };
}

// The enlarged card's height for body content contentHeight tall: its body's rows, which
// card-frame-large draws alike, shrink to the content, and never grow past the frame's.
export function largeCardHeight(contentHeight: number): number {
  const { body, height } = CARD_LAYOUT.large;
  return height - Math.max(0, body.height - Math.ceil(contentHeight));
}

// The enlarged card's rect, height tall, centred in area on whole pixels.
export function largeCardRect(area: Rect, height: number = CARD_LAYOUT.large.height): Rect {
  const { width } = CARD_LAYOUT.large;
  return {
    height,
    width,
    x: area.x + Math.floor((area.width - width) / 2),
    y: area.y + Math.floor((area.height - height) / 2),
  };
}

// The cards' rects for each count from 1 to maxCount, centred on the road.
export function cardRows(maxCount: number, road: Rect): Rect[][] {
  return Array.from({ length: maxCount }, (_, i) =>
    cardRowRects(cardRowSpec(maxCount), i + 1, road),
  );
}
