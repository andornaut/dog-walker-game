import { itemAt } from "@andornaut/game-kit/arrays";
import { keysOf } from "@andornaut/game-kit/records";
import { insetRect, type Rect, rectsOverlap } from "@andornaut/game-kit/rect";
import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { SCREEN_LAYOUT } from "../data/screen";
import { charmEffects } from "../hud/buffMarks";
import { type EffectItem, effectName } from "../hud/effectIcons";
import { MAX_CARD_OPTIONS } from "../rules/choices";
import { fontFileMetrics, inkWidth } from "../testing/fontInk";
import { inside } from "../testing/rects";
import { CARD_HEADER } from "../ui/cardRow";
import { inkRowsOfLines } from "../ui/fontMetrics";
import { plainMarks } from "../ui/pixelFont";
import { CARD_CHARMS_HEIGHT, cardCharmPlates, cardCharmWidth, CHARM } from "./buffLayout";
import {
  CARD_LAYOUT,
  CARD_ROW_BLOCK_HEIGHT,
  cardRows,
  cardRowTop,
  forkHomeRect,
  largeBodyStyle,
  largeCardHeight,
  largeCardRect,
} from "./cardLayout";

describe("largeCardHeight", () => {
  it.each([
    ["the full card for a full body", 78, 280],
    ["a taller card for a body past the frame's", 120, 322],
    ["a card shorter by the empty rows", 20, 222],
    ["whole rows for a fractional height", 19.5, 222],
    ["the frame without its body rows but the gap for no content", 0, 202],
  ] as const)("sets %s", (_, content, height) => {
    expect(largeCardHeight(content)).toBe(height);
  });

  // The changes' most lines, at the tallest box, under no warning.
  it("keeps the tallest enlarged card and its charms in the walk view", () => {
    const body = fontFileMetrics("font-body");
    const { lines = 1, scale } = largeBodyStyle(body, CARD_LAYOUT.large.body.height, WALK);
    const card = largeCardRect(WALK, largeCardHeight(inkRowsOfLines(body, lines) * scale));
    expect(card.y).toBeGreaterThanOrEqual(WALK.y);
    expect(bottom(card) + CARD_CHARMS_HEIGHT).toBeLessThanOrEqual(bottom(WALK));
  });
});

// The illustration sits across the card's middle, an odd pixel left over to its right; the
// enlarged card draws it at 2x.
describe("the card's illustration", () => {
  const { art, large, width } = CARD_LAYOUT;
  it.each([
    { artWidth: art.width, cardWidth: width, name: "a card", x: art.x },
    { artWidth: art.width * 2, cardWidth: large.width, name: "the enlarged card", x: large.art.x },
  ])("centres the illustration across $name", ({ artWidth, cardWidth, x }) => {
    expect(cardWidth - (x + artWidth) - x).toBe((cardWidth - artWidth) % 2);
  });
});

// A card's band runs across the card inside its 2px frame. Its body-font label, which every
// label fits, keeps at least 1px clear either side.
describe("the card's band label", () => {
  it("keeps at least 1px clear of either end of the band", () => {
    const { band, width } = CARD_LAYOUT;
    expect((width - 2 * 2 - band.room) / 2).toBeGreaterThanOrEqual(1);
  });
});

const SCREEN = SCREEN_LAYOUT;
const WALK = SCREEN.walkView;
const bottom = (rect: Rect) => rect.y + rect.height;
const right = (rect: Rect) => rect.x + rect.width;

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
  });

  it.each(ROWS.map((row, i) => ({ count: i + 1, row })))(
    "puts every card of a $count-card row at the row's top",
    ({ row }) => {
      for (const card of row) {
        expect(card.y).toBe(cardRowTop(WALK));
      }
    },
  );

  it("puts Head home under the charms' rows, inside the walk view", () => {
    const cards = itemAt(itemAt(ROWS, 0), 0);
    expect(HEAD_HOME.y).toBe(bottom(cards) + CARD_CHARMS_HEIGHT + CARD_LAYOUT.forkHome.gap);
    expect(inside(HEAD_HOME, WALK)).toBe(true);
  });

  it("centres the enlarged card and its charms' rows in the walk view", () => {
    for (const height of [CARD_LAYOUT.large.height, largeCardHeight(0)]) {
      const card = largeCardRect(WALK, height);
      const above = card.y - WALK.y;
      const below = bottom(WALK) - (bottom(card) + CARD_CHARMS_HEIGHT);
      expect(below - above).toBeGreaterThanOrEqual(0);
      expect(below - above).toBeLessThanOrEqual(1);
    }
  });
});

// Every charm a card can show: each item with a charm effect, gear found or not, with its name
// over each of its effects' lines.
const ITEMS: EffectItem[] = [
  ...keysOf(gameData.shopGear).flatMap((gear): EffectItem[] => [
    { gear, kind: "gear" },
    { found: true, gear, kind: "gear" },
  ]),
  ...keysOf(gameData.walkerPerks).map((perk): EffectItem => ({ kind: "perk", perk })),
  ...keysOf(gameData.upgrades).map((upgrade): EffectItem => ({ kind: "upgrade", upgrade })),
];
const ONE_X = { scale: 1 };
const CHARM_WIDTHS = ITEMS.flatMap((item) =>
  charmEffects(gameData, item).map((effect) => {
    const name = inkWidth("font-body", ONE_X, effectName(gameData, item));
    const line = plainMarks(gameData.runText.card.charmEffect[effect]).toUpperCase();
    return cardCharmWidth(Math.max(name, inkWidth("font-title", ONE_X, line)));
  }),
);
const WIDEST = Math.max(...CHARM_WIDTHS);

describe("a card's charms", () => {
  it("cover every charm effect", () => {
    expect(new Set(ITEMS.flatMap((item) => charmEffects(gameData, item)))).toEqual(
      new Set(keysOf(gameData.runText.card.charmEffect)),
    );
  });

  const cases = Array.from({ length: CHARM.card.most }, (_, i) => i + 1).flatMap((count) => [
    // The row's cards, Skip among them, and Head home stay in view beside a small card's charms;
    // the enlarged card hides them.
    ...SMALL_CARDS.map(({ card, row }) => ({
      card,
      controls: [HEAD_HOME],
      count,
      row,
      size: "small",
    })),
    ...[CARD_LAYOUT.large.height, largeCardHeight(0)].map((height) => ({
      card: largeCardRect(WALK, height),
      controls: [],
      count,
      row: [],
      size: "enlarged",
    })),
  ]);

  it.each(cases)(
    "stack $count at the widest under the $size card, centred on it, in their reserved rows",
    ({ card, controls, count, row }) => {
      const widths = Array.from({ length: count }, () => WIDEST);
      const rings = cardCharmPlates(card, widths).map((plate) => insetRect(-CHARM.ring, plate));
      const reserved = bottom(card) + CARD_CHARMS_HEIGHT;
      expect(itemAt(rings, 0).y).toBe(bottom(card) + CHARM.under);
      rings.slice(1).forEach((ring, i) => {
        expect(ring.y - bottom(itemAt(rings, i))).toBe(CHARM.gap);
      });
      for (const ring of rings) {
        // Centred across the card, the odd pixel to the right, and no wider than it.
        const margin = right(card) - right(ring) - (ring.x - card.x);
        expect(margin).toBeGreaterThanOrEqual(0);
        expect(margin).toBeLessThanOrEqual(1);
        expect(ring.x).toBeGreaterThanOrEqual(card.x);
        expect(bottom(ring)).toBeLessThanOrEqual(reserved);
        expect(inside(ring, WALK)).toBe(true);
        for (const other of [...row, ...controls]) {
          expect(rectsOverlap(ring, other)).toBe(false);
        }
      }
    },
  );

  it("fill their reserved rows when an option has the most", () => {
    const card = itemAt(itemAt(ROWS, 0), 0);
    const widths = Array.from({ length: CHARM.card.most }, () => WIDEST);
    const last = itemAt(cardCharmPlates(card, widths), CHARM.card.most - 1);
    expect(bottom(insetRect(-CHARM.ring, last))).toBe(bottom(card) + CARD_CHARMS_HEIGHT);
  });
});
