import { describe, expect, it } from "vitest";

import { CARD_LAYOUT, largeCardHeight, largeCardRect } from "./cardLayout";

const area = { height: 320, width: 360, x: 0, y: 150 };

describe("largeCardHeight", () => {
  it.each([
    ["the full card for a full body", 82, 280],
    ["the full card for a body that overflows", 120, 280],
    ["a card shorter by the empty rows", 20, 218],
    ["whole rows for a fractional height", 19.5, 218],
    ["the frame without its body rows for no content", 0, 198],
  ])("gives %s", (_name, content, height) => {
    expect(largeCardHeight(content)).toBe(height);
  });
});

describe("largeCardRect", () => {
  it.each([
    ["the full card", CARD_LAYOUT.large.height, { height: 280, width: 166, x: 97, y: 170 }],
    ["a shorter card", 218, { height: 218, width: 166, x: 97, y: 201 }],
  ])("centres %s in the area", (_name, height, rect) => {
    expect(largeCardRect(area, height)).toEqual(rect);
  });
});

// The illustration sits across the card's middle, as far from either side; the enlarged card
// draws it at 2x.
describe("the card's illustration", () => {
  const { art, large, width } = CARD_LAYOUT;
  it.each([
    ["a card", art.x, art.width, width],
    ["the enlarged card", large.art.x, art.width * 2, large.width],
  ])("centres it across %s", (_name, x, artWidth, cardWidth) => {
    expect(cardWidth - (x + artWidth)).toBe(x);
  });
});
