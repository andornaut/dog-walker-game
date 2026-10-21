import { describe, expect, it } from "vitest";

import { SCREEN_CONFIG } from "../data/screen";
import { itemAt } from "../lib/arrays";
import { insetRect, type Rect, rectsOverlap } from "../lib/rect";
import { MAX_CARD_OPTIONS } from "../rules/choices";
import { CARD_HEADER } from "../ui/cardRow";
import { cardCharmsAt, CHARM, charmRingSize, charmRowHeight } from "./buffLayout";
import {
  CARD_LAYOUT,
  CARD_ROW_BLOCK_HEIGHT,
  cardRows,
  cardRowTop,
  forkHomeRect,
  largeCardHeight,
  largeCardRect,
} from "./cardLayout";
import { screenLayout } from "./screenLayout";

describe("largeCardHeight", () => {
  it("shrinks the large card by its empty body rows, in whole rows, up to the full card", () => {
    for (const [, content, height] of [
      ["the full card for a full body", 82, 280],
      ["the full card for a body that overflows", 120, 280],
      ["a card shorter by the empty rows", 20, 218],
      ["whole rows for a fractional height", 19.5, 218],
      ["the frame without its body rows for no content", 0, 198],
    ] as const) {
      expect(largeCardHeight(content)).toBe(height);
    }
  });
});

// The illustration sits across the card's middle, as far from either side; the enlarged card
// draws it at 2x.
describe("the card's illustration", () => {
  const { art, large, width } = CARD_LAYOUT;
  it("centres the illustration across a card and the enlarged card", () => {
    for (const [, x, artWidth, cardWidth] of [
      ["a card", art.x, art.width, width],
      ["the enlarged card", large.art.x, art.width * 2, large.width],
    ] as const) {
      expect(cardWidth - (x + artWidth)).toBe(x);
    }
  });
});

// A card's band runs across the card inside its 2px frame. A title-font label keeps 3px of
// the band clear either side; the body font, which every label fits, keeps at least 1px.
describe("the card's band label", () => {
  const { band, width } = CARD_LAYOUT;
  it.each([
    ["a title-font label", band.titleRoom, 3],
    ["a body-font label", band.room, 1],
  ])("keeps %s at least %ipx clear of either end of the band", (_name, room, pad) => {
    expect((width - 2 * 2 - room) / 2).toBeGreaterThanOrEqual(pad);
  });
});

const SCREEN = screenLayout(SCREEN_CONFIG);
const WALK = SCREEN.walkView;
const bottom = (rect: Rect) => rect.y + rect.height;
const right = (rect: Rect) => rect.x + rect.width;
const inside = (outer: Rect, inner: Rect) =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  right(inner) <= right(outer) &&
  bottom(inner) <= bottom(outer);

// Each count of cards, and each card in it, with the fork's Head home under the row.
const ROWS = cardRows(MAX_CARD_OPTIONS, WALK);
const SMALL_CARDS = ROWS.flatMap((row) => row.map((card) => ({ card, row })));
const HEAD_HOME = forkHomeRect(itemAt(itemAt(ROWS, 0), 0), WALK.x + WALK.width / 2);

describe("the card row's block", () => {
  it("sits at the walk view's 2/3 line: the rows over it and under it 1:2", () => {
    const top = cardRowTop(WALK) - CARD_HEADER.titleRise;
    const above = top - WALK.y;
    const below = bottom(WALK) - (top + CARD_ROW_BLOCK_HEIGHT);
    expect(above).toBe(Math.round((above + below) / 3));
    expect(CARD_ROW_BLOCK_HEIGHT).toBe(
      CARD_HEADER.titleRise + CARD_LAYOUT.height + charmRowHeight(1),
    );
  });

  it.each(ROWS.map((row, i) => ({ count: i + 1, row })))(
    "puts every card of a $count-card row at the row's top",
    ({ row }) => {
      for (const card of row) {
        expect(card.y).toBe(cardRowTop(WALK));
      }
    },
  );

  it("puts Head home under the charm row, inside the walk view", () => {
    const cards = itemAt(itemAt(ROWS, 0), 0);
    expect(HEAD_HOME.y).toBe(bottom(cards) + charmRowHeight(1) + CARD_LAYOUT.forkHome.gap);
    expect(inside(WALK, HEAD_HOME)).toBe(true);
  });

  it("centres the enlarged card and its charm row in the walk view", () => {
    for (const height of [CARD_LAYOUT.large.height, largeCardHeight(0)]) {
      const card = largeCardRect(WALK, height);
      const above = card.y - WALK.y;
      const below = bottom(WALK) - (bottom(card) + charmRowHeight(2));
      expect(below - above).toBeGreaterThanOrEqual(0);
      expect(below - above).toBeLessThanOrEqual(1);
    }
  });
});

describe("a card's charms", () => {
  const cases = [1, 2].flatMap((count) => [
    // The row's cards, Skip among them, and Head home stay in view beside a small card's charms;
    // the enlarged card hides them.
    ...SMALL_CARDS.map(({ card, row }) => ({
      card,
      controls: [HEAD_HOME],
      count,
      row,
      scale: 1,
      size: "small",
    })),
    ...[CARD_LAYOUT.large.height, largeCardHeight(0)].map((height) => ({
      card: largeCardRect(WALK, height),
      controls: [],
      count,
      row: [],
      scale: 2,
      size: "enlarged",
    })),
  ]);

  it.each(cases)(
    "sit $count across, fully below the $size card and centred under it",
    ({ card, controls, count, row, scale }) => {
      const rings = cardCharmsAt(card, scale, count).map((well) =>
        insetRect(-CHARM.ring * scale, {
          height: CHARM.size * scale,
          width: CHARM.size * scale,
          ...well,
        }),
      );
      const first = itemAt(rings, 0);
      const last = itemAt(rings, count - 1);
      expect(first.width).toBe(charmRingSize(scale));
      rings.slice(1).forEach((ring, i) => {
        expect(ring.x - right(itemAt(rings, i))).toBe(CHARM.gap * scale);
      });
      // Centred under the card, the odd pixel to the right.
      const margin = right(card) - right(last) - (first.x - card.x);
      expect(margin).toBeGreaterThanOrEqual(0);
      expect(margin).toBeLessThanOrEqual(1);
      for (const ring of rings) {
        expect(ring.y).toBe(bottom(card) + CHARM.under);
        expect(bottom(ring)).toBe(bottom(card) + charmRowHeight(scale));
        expect(inside(WALK, ring)).toBe(true);
        for (const other of [...row, ...controls]) {
          expect(rectsOverlap(ring, other)).toBe(false);
        }
      }
    },
  );
});
