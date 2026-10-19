import { describe, expect, it } from "vitest";

import type { Rect } from "../layout/rect";
import { bubbleRect } from "./bubbleRect";
import { HOME_LAYOUT } from "./homeLayout";

const { board } = HOME_LAYOUT.petShop;
const { gap, gate, walkerAtGate } = HOME_LAYOUT;
const sizes = { clearance: 2, margin: gap / 2 };
const top = gate.y + 6;
const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

describe("bubbleRect", () => {
  it.each([1, 2, 3, 4, 5, 8].flatMap((lines) => [60, 120, 200].map((width) => [lines, width])))(
    "keeps a %i line bubble %i wide clear of the Pet shop's board",
    (lines, width) => {
      const height = lines * 12 + 6;
      const rect = bubbleRect(board, sizes, { x: walkerAtGate.x, y: top }, { height, width });
      expect(overlaps(rect, board)).toBe(false);
      expect(rect.x).toBeGreaterThanOrEqual(sizes.margin);
    },
  );

  it("leaves a bubble that stops above the board where it is centred", () => {
    const rect = bubbleRect(board, sizes, { x: 180, y: top }, { height: 10, width: 100 });
    expect(rect.x).toBe(130);
  });
});
