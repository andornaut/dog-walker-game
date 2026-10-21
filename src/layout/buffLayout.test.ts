import { describe, expect, it } from "vitest";

import { insetRect, type Rect } from "../lib/rect";
import { BUFF_POP, cardCharmAt, CHARM, charmByWalkerRect, strikeGeometry } from "./buffLayout";
import { CARD_LAYOUT } from "./cardLayout";

const inside = (outer: Rect, inner: Rect) =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.x + inner.width <= outer.x + outer.width &&
  inner.y + inner.height <= outer.y + outer.height;

describe("strikeGeometry", () => {
  // The title font's capitals take rows 4 to 8 of its line, the body font's rows 2 to 7.
  it.each([
    { font: "title", metrics: { capHeight: 5, capTop: 4 }, row: 6, scale: 1 },
    { font: "title", metrics: { capHeight: 5, capTop: 4 }, row: 6, scale: 2 },
    { font: "body", metrics: { capHeight: 6, capTop: 2 }, row: 4, scale: 1 },
  ])(
    "strikes the $font font's row $row at scale $scale, past the ink",
    ({ metrics, row, scale }) => {
      const ink = { capTop: metrics.capTop * scale, left: 10, right: 30 };
      const { afterX, line } = strikeGeometry(metrics, scale, ink);
      expect(line).toEqual({ height: scale, width: 20 + 2 * scale, x: 10 - scale, y: row * scale });
      // The new value starts 3 font pixels clear of the line's end.
      expect(afterX - (line.x + line.width)).toBe(3 * scale);
    },
  );
});

describe("the charm on a card", () => {
  const ring = (rect: Rect) => insetRect(-CHARM.ring, rect);
  it.each([
    { card: CARD_LAYOUT, name: "small", scale: 1 },
    { card: CARD_LAYOUT.large, name: "enlarged", scale: 2 },
  ])("stays inside the $name card, lit and stacked", ({ card, scale }) => {
    const bounds = { height: card.height, width: card.width, x: 0, y: 0 };
    for (const index of [0, 1]) {
      const at = cardCharmAt({ x: 0, y: 0 }, scale, index);
      const size = CHARM.size * scale;
      expect(inside(bounds, ring({ height: size, width: size, ...at }))).toBe(true);
    }
  });

  it("sits beside the walker's head, left of the walker's centre", () => {
    const rect = charmByWalkerRect({ x: 100, y: 200 });
    expect(rect.x + rect.width / 2).toBe(100 + BUFF_POP.walker.dx);
    expect(rect.y).toBe(200 + BUFF_POP.walker.dy);
  });
});
