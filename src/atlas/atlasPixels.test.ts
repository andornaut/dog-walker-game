import { describe, expect, it } from "vitest";

import { blankImage, blitExtruded, type RgbaImage } from "./atlasPixels";

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
});
