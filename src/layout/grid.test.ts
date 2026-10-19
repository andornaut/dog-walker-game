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

  it("finds the cell under a point", () => {
    expect(rectIndexAt(rects, 130, 270)).toBe(4);
  });

  it("finds nothing in the gap between cells or outside the grid", () => {
    expect(rectIndexAt(rects, 121, 220)).toBeUndefined();
    expect(rectIndexAt(rects, 4, 220)).toBeUndefined();
  });
});
