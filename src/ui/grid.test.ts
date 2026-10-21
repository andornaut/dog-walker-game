import { describe, expect, it } from "vitest";

import { gridRects, rectIndexAt } from "./grid";

const spec = { cellHeight: 50, cellWidth: 112, columns: 3, gapX: 4, gapY: 4 };

describe("gridRects", () => {
  it("fills rows left to right, then the next row down", () => {
    const rects = gridRects(spec, 4, { x: 8, y: 212 });
    expect(rects.map(({ x, y }) => [x, y])).toEqual([
      [8, 212],
      [124, 212],
      [240, 212],
      [8, 266],
    ]);
  });

  it("makes every cell the same size", () => {
    for (const rect of gridRects(spec, 9, { x: 0, y: 0 })) {
      expect([rect.width, rect.height]).toEqual([112, 50]);
    }
  });
});

describe("rectIndexAt", () => {
  const rects = gridRects(spec, 9, { x: 8, y: 212 });

  it.each([
    ["a cell", 130, 270, 4],
    ["the gap between cells", 121, 220, undefined],
    ["outside the grid", 4, 220, undefined],
  ])("finds under a point in %s (%d, %d): %s", (_, x, y, expected) => {
    expect(rectIndexAt(rects, x, y)).toBe(expected);
  });
});
