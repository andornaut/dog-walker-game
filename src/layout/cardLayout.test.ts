import { describe, expect, it } from "vitest";

import { CARD_LAYOUT, largeCardHeight } from "./cardLayout";

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
