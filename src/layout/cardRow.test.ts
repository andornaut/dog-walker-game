import { describe, expect, it } from "vitest";

import { itemAt } from "../arrays";
import { cardHeader, cardRowRects } from "./cardRow";
import type { Rect } from "./rect";

const area = { height: 450, width: 280, x: 80, y: 190 };
const spec = { cardHeight: 140, cardWidth: 83, gap: 8, maxCount: 3 };

const bottom = (rect: Rect) => rect.y + rect.height;
const right = (rect: Rect) => rect.x + rect.width;

describe("cardRowRects", () => {
  it("lays a full row 83px wide and 8px apart, the odd pixel in the right margin", () => {
    const cards = cardRowRects(spec, 3, area);
    expect(cards.map((card) => card.x)).toEqual([87, 178, 269]);
    expect(cards.every((card) => card.width === 83)).toBe(true);
    expect(itemAt(cards, 0).x - area.x).toBe(7);
    expect(right(area) - right(itemAt(cards, 2))).toBe(8);
  });

  it("centres a shorter row on whole pixels", () => {
    const cards = cardRowRects(spec, 2, area);
    expect(itemAt(cards, 1).x - right(itemAt(cards, 0))).toBe(8);
    expect(itemAt(cards, 0).x - area.x).toBe(53);
    expect(right(area) - right(itemAt(cards, 1))).toBe(53);
  });

  it("centres the cards vertically on a whole pixel", () => {
    const card = itemAt(cardRowRects(spec, 3, area), 0);
    expect(card.height).toBe(140);
    expect(card.y - area.y).toBe(155);
    expect(bottom(area) - bottom(card)).toBe(155);
  });

  it("rejects a count outside 1 to maxCount", () => {
    expect(() => cardRowRects(spec, 0, area)).toThrow(RangeError);
    expect(() => cardRowRects(spec, 4, area)).toThrow(RangeError);
  });
});

describe("cardHeader", () => {
  // Capitals are 5 rows at 1x and 10 at 2x, with the title's 1px shadow and the body font's
  // 2-row descenders under them. The band's ink well runs from its second row to 6 rows above
  // its bottom.
  const inkTop = (band: Rect) => band.y + 1;
  const inkBottom = (band: Rect) => bottom(band) - 6;

  it.each([1, 2, 3].flatMap((count) => [false, true].map((keys) => [count, keys] as const)))(
    "stacks the header over %i cards, key numbers shown: %s",
    (count, keys) => {
      const cards = cardRowRects(spec, count, area);
      const { band, keyTop, subtitleTop, titleTop } = cardHeader(keys, cards);
      const top = itemAt(cards, 0).y;
      expect(band.x).toBe(itemAt(cards, 0).x);
      expect(right(band)).toBe(right(itemAt(cards, count - 1)));
      expect(titleTop + 10 + 1).toBeLessThan(band.y);
      expect(subtitleTop).toBeGreaterThan(inkTop(band));
      expect(bottom(band)).toBeLessThan(top);
      const lastRow = keys ? keyTop + 5 : subtitleTop + 5 + 2;
      expect(lastRow).toBeLessThanOrEqual(inkBottom(band) + 1);
      if (keys) {
        expect(keyTop).toBeGreaterThan(subtitleTop + 5 + 2);
      }
    },
  );
});
