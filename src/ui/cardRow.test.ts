import { itemAt } from "@andornaut/game-kit/arrays";
import type { Rect } from "@andornaut/game-kit/rect";
import { describe, expect, it } from "vitest";

import { cardHeader, cardRowRects } from "./cardRow";

const area = { height: 450, width: 280, x: 80, y: 190 };
const spec = { cardHeight: 140, cardWidth: 83, gap: 8, maxCount: 3 };

const bottom = (rect: Rect) => rect.y + rect.height;
const right = (rect: Rect) => rect.x + rect.width;

describe("cardRowRects", () => {
  it("centres a row on whole pixels, the odd pixel in the right margin, and centres it vertically", () => {
    const full = cardRowRects(spec, 3, area);
    expect(itemAt(full, 0).x - area.x).toBe(7);
    expect(right(area) - right(itemAt(full, 2))).toBe(8);
    const two = cardRowRects(spec, 2, area);
    expect(itemAt(two, 1).x - right(itemAt(two, 0))).toBe(spec.gap);
    expect(itemAt(two, 0).x - area.x).toBe(right(area) - right(itemAt(two, 1)));
    const card = itemAt(full, 0);
    expect(card.y - area.y).toBe(bottom(area) - bottom(card));
  });

  it("rejects a count outside 1 to maxCount", () => {
    expect(() => cardRowRects(spec, 0, area)).toThrow(RangeError);
    expect(() => cardRowRects(spec, 4, area)).toThrow(RangeError);
  });
});

describe("cardHeader", () => {
  // Capitals are 5 rows at 1x, with the body font's 2-row descenders under them. The title's
  // lettering is 10-row capitals at 2x; the fork's display font draws it, outline and shadow
  // included, from a row above the capitals' top to 12 rows below it. The band's ink well runs
  // from its second row to 6 rows above its bottom.
  const inkTop = (band: Rect) => band.y + 1;
  const inkBottom = (band: Rect) => bottom(band) - 6;
  const titleInk = (titleTop: number) => ({ bottom: titleTop + 12, top: titleTop - 1 });

  const HEADERS = [1, 2, 3].flatMap((count) => [false, true].map((keys) => ({ count, keys })));

  it.each(HEADERS)(
    "stacks the header over $count cards (key numbers $keys) on a band behind the title",
    ({ count, keys }) => {
      const cards = cardRowRects(spec, count, area);
      const { band, keyTop, subtitleTop, titleTop } = cardHeader(keys, cards);
      const top = itemAt(cards, 0).y;
      expect(band.x).toBe(itemAt(cards, 0).x);
      expect(right(band)).toBe(right(itemAt(cards, count - 1)));
      const title = titleInk(titleTop);
      expect(title.top).toBeGreaterThanOrEqual(inkTop(band));
      expect(title.bottom).toBeLessThan(subtitleTop);
      expect(bottom(band)).toBeLessThan(top);
      const lastRow = keys ? keyTop + 5 : subtitleTop + 5 + 2;
      expect(lastRow).toBeLessThanOrEqual(inkBottom(band) + 1);
      if (keys) {
        expect(keyTop).toBeGreaterThan(subtitleTop + 5 + 2);
      }
    },
  );
});
