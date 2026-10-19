import { describe, expect, it } from "vitest";

import { cardRects, type Rect, screenLayout } from "./layout";

const config = {
  dogColumnWidth: 80,
  dogSlotCount: 3,
  dogSlotPadding: 4,
  height: 640,
  topBarHeight: 40,
  width: 360,
};

const bottom = (rect: Rect) => rect.y + rect.height;
const right = (rect: Rect) => rect.x + rect.width;

describe("screenLayout", () => {
  it("puts the road right of the dog column and below the top bar, filling the rest", () => {
    expect(screenLayout(config).road).toEqual({ height: 600, width: 280, x: 80, y: 40 });
  });

  it("spans the top bar across the full width", () => {
    expect(screenLayout(config).topBar).toEqual({ height: 40, width: 360, x: 0, y: 0 });
  });

  it("stacks equal dog slots inside the column without overlap", () => {
    const { dogColumn, dogSlots } = screenLayout(config);
    expect(dogSlots).toHaveLength(3);
    dogSlots.forEach((slot, i) => {
      expect(slot.x).toBeGreaterThanOrEqual(dogColumn.x);
      expect(right(slot)).toBeLessThanOrEqual(right(dogColumn));
      expect(slot.y).toBeGreaterThanOrEqual(dogColumn.y);
      expect(bottom(slot)).toBeLessThanOrEqual(bottom(dogColumn));
      expect(slot.height).toBe(dogSlots[0].height);
      if (i > 0) {
        expect(slot.y).toBeGreaterThanOrEqual(bottom(dogSlots[i - 1]));
      }
    });
  });

  it("keeps the road width when there are fewer slots", () => {
    expect(screenLayout({ ...config, dogSlotCount: 1 }).road.width).toBe(280);
  });
});

describe("cardRects", () => {
  const area = { height: 600, width: 280, x: 80, y: 40 };

  it("fills the width with a full row, the same gap at both edges and between cards", () => {
    const cards = cardRects(3, 8, 140, 3, area);
    expect(cards[0].x).toBeCloseTo(area.x + 8);
    expect(cards[1].x - right(cards[0])).toBeCloseTo(8);
    expect(cards[2].x - right(cards[1])).toBeCloseTo(8);
    expect(right(area) - right(cards[2])).toBeCloseTo(8);
  });

  it("keeps the full-row card size for a shorter row", () => {
    const [full] = cardRects(3, 8, 140, 3, area);
    for (const card of cardRects(3, 8, 140, 2, area)) {
      expect(card.width).toBeCloseTo(full.width);
    }
  });

  it("centres a shorter row horizontally", () => {
    const cards = cardRects(3, 8, 140, 2, area);
    expect(cards[1].x - right(cards[0])).toBeCloseTo(8);
    expect(cards[0].x - area.x).toBeCloseTo(right(area) - right(cards[1]));
  });

  it("centres the cards vertically in the area", () => {
    const [card] = cardRects(3, 8, 140, 3, area);
    expect(card.y - area.y).toBe(bottom(area) - bottom(card));
  });
});
