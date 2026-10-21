import { describe, expect, it } from "vitest";

import type { Rect } from "../../lib/rect";
import { sheetFromRows } from "../../testing/sheetImage";
import { blankImage, blitExtruded, opaqueRect, type RgbaImage } from "./atlasPixels";

// A grey image whose pixel at (x, y) is the single byte value 10 * y + x, opaque.
function numbered(width: number, height: number): RgbaImage {
  const image = blankImage(width, height);
  for (let i = 0; i < width * height; i++) {
    const value = 10 * Math.floor(i / width) + (i % width);
    image.data.set([value, value, value, 255], i * 4);
  }
  return image;
}

const valueAt = (image: RgbaImage, x: number, y: number) => image.data[(y * image.width + x) * 4];

describe("blitExtruded", () => {
  it("copies the rect, repeats its edges one pixel out and leaves the rest clear", () => {
    const source = numbered(4, 4);
    const target = blankImage(5, 5);
    blitExtruded(source, { height: 2, width: 2, x: 1, y: 1 }, 1, target, { x: 2, y: 2 });
    const rows = Array.from({ length: 5 }, (_, y) =>
      Array.from({ length: 5 }, (_, x) => valueAt(target, x, y)),
    );
    expect(rows).toEqual([
      [0, 0, 0, 0, 0],
      [0, 11, 11, 12, 12],
      [0, 11, 11, 12, 12],
      [0, 21, 21, 22, 22],
      [0, 21, 21, 22, 22],
    ]);
    expect(target.data[3]).toBe(0);
    expect(target.data[(1 * 5 + 1) * 4 + 3]).toBe(255);
  });

  // The rect at (1, 1) of a 4x4 image, 2 wide: its border is the pixels around it in bounds,
  // and bounds' edge pixels repeated past bounds.
  it.each<{ bounds: Rect; name: string; rows: number[][] }>([
    {
      bounds: { height: 4, width: 4, x: 0, y: 0 },
      name: "reads the border inside bounds",
      rows: [
        [0, 1, 2, 3],
        [10, 11, 12, 13],
        [20, 21, 22, 23],
        [30, 31, 32, 33],
      ],
    },
    {
      bounds: { height: 3, width: 3, x: 1, y: 1 },
      name: "repeats bounds' edge pixels past it",
      rows: [
        [11, 11, 12, 13],
        [11, 11, 12, 13],
        [21, 21, 22, 23],
        [31, 31, 32, 33],
      ],
    },
  ])("$name", ({ bounds, rows }) => {
    const target = blankImage(4, 4);
    blitExtruded(
      numbered(4, 4),
      { height: 2, width: 2, x: 1, y: 1 },
      1,
      target,
      { x: 1, y: 1 },
      bounds,
    );
    expect(
      Array.from({ length: 4 }, (_, y) =>
        Array.from({ length: 4 }, (_, x) => valueAt(target, x, y)),
      ),
    ).toEqual(rows);
  });
});

describe("opaqueRect", () => {
  it.each<{ expected: Rect | undefined; name: string; rows: string[]; within: Rect }>([
    {
      expected: { height: 2, width: 3, x: 1, y: 1 },
      name: "bounds the opaque pixels",
      rows: ["....", ".a..", "..bc", "...."],
      within: { height: 4, width: 4, x: 0, y: 0 },
    },
    {
      expected: { height: 1, width: 1, x: 1, y: 1 },
      name: "ignores opaque pixels outside within",
      rows: ["....", ".a..", "..bc", "...."],
      within: { height: 2, width: 2, x: 0, y: 0 },
    },
    {
      expected: undefined,
      name: "is undefined for a clear rect",
      rows: ["....", "....", "....", "...."],
      within: { height: 4, width: 4, x: 0, y: 0 },
    },
  ])("$name", ({ expected, rows, within }) => {
    expect(opaqueRect(sheetFromRows("dog-koda", [rows]).image, within)).toEqual(expected);
  });
});
