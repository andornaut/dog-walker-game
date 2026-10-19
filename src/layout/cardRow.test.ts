import { describe, expect, it } from "vitest";

import { defined } from "../testing/defined";
import { cardRowRects } from "./cardRow";
import type { Rect } from "./rect";

const area = { height: 600, width: 280, x: 80, y: 40 };
const spec = { cardHeight: 140, gap: 8, maxCount: 3 };

const bottom = (rect: Rect) => rect.y + rect.height;
const right = (rect: Rect) => rect.x + rect.width;

describe("cardRowRects", () => {
  it("fills the width with a full row, the same gap at both edges and between cards", () => {
    const cards = cardRowRects(spec, 3, area);
    expect(defined(cards[0]).x).toBeCloseTo(area.x + 8);
    expect(defined(cards[1]).x - right(defined(cards[0]))).toBeCloseTo(8);
    expect(defined(cards[2]).x - right(defined(cards[1]))).toBeCloseTo(8);
    expect(right(area) - right(defined(cards[2]))).toBeCloseTo(8);
  });

  it("keeps the full-row card size for a shorter row", () => {
    const full = defined(cardRowRects(spec, 3, area)[0]);
    for (const card of cardRowRects(spec, 2, area)) {
      expect(card.width).toBeCloseTo(full.width);
    }
  });

  it("centres a shorter row horizontally", () => {
    const cards = cardRowRects(spec, 2, area);
    expect(defined(cards[1]).x - right(defined(cards[0]))).toBeCloseTo(8);
    expect(defined(cards[0]).x - area.x).toBeCloseTo(right(area) - right(defined(cards[1])));
  });

  it("centres the cards vertically in the area", () => {
    const card = defined(cardRowRects(spec, 3, area)[0]);
    expect(card.height).toBe(140);
    expect(card.y - area.y).toBe(bottom(area) - bottom(card));
  });
});
