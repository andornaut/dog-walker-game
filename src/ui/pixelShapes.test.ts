import { describe, expect, it } from "vitest";

import {
  opaqueBounds,
  opaqueBoundsOfRgba,
  pixelEllipseSpans,
  pixelLinePoints,
  type PixelSpan,
} from "./pixelShapes";

const pixelsOf = (spans: PixelSpan[]) =>
  spans.flatMap(({ width, x, y }) => Array.from({ length: width }, (_, i) => `${x + i},${y}`));

describe("pixelEllipseSpans", () => {
  it("spans the ellipse's width and height around its centre, symmetric, each pixel once", () => {
    const spans = pixelEllipseSpans(100, 50, 8, 2.5);
    const widest = Math.max(...spans.map(({ width }) => width));
    expect(widest).toBe(16);
    expect(spans.find(({ width }) => width === widest)?.x).toBe(92);
    expect(spans.map(({ y }) => y)).toEqual([48, 49, 50, 51]);
    for (const { width, x } of spans) {
      expect(x + width - 100).toBe(100 - x);
    }
    const pixels = pixelsOf(spans);
    expect(new Set(pixels).size).toBe(pixels.length);
  });
});

describe("pixelLinePoints", () => {
  it("runs from one end to the other, one touching pixel per step along the longer axis", () => {
    const points = pixelLinePoints(3, 10, 9, 2);
    expect(points[0]).toEqual([3, 10]);
    expect(points.at(-1)).toEqual([9, 2]);
    points.slice(1).forEach(([x, y], i) => {
      const [px, py] = points[i] ?? [x, y];
      expect(Math.max(Math.abs(x - px), Math.abs(y - py))).toBe(1);
    });
    expect(pixelLinePoints(0, 0, 3, 10)).toHaveLength(11);
    expect(pixelLinePoints(4, 4, 4, 4)).toEqual([[4, 4]]);
  });
});

describe("opaqueBounds", () => {
  it("boxes the opaque pixels, right and bottom one past them, and is undefined for a clear image", () => {
    const opaque = new Set(["3,2", "6,5", "4,7"]);
    expect(opaqueBounds(10, 10, (x, y) => opaque.has(`${x},${y}`))).toEqual({
      bottom: 8,
      left: 3,
      right: 7,
      top: 2,
    });
    expect(opaqueBounds(4, 4, () => false)).toBeUndefined();
  });

  it("reads the alpha byte of each RGBA pixel, row by row", () => {
    // 3x2: only (2, 0) and (1, 1) have alpha; (0, 1) has colour but no alpha.
    const rgba = [
      [9, 9, 9, 0],
      [9, 9, 9, 0],
      [0, 0, 0, 255],
      [9, 9, 9, 0],
      [0, 0, 0, 1],
      [0, 0, 0, 0],
    ].flat();
    expect(opaqueBoundsOfRgba(3, 2, Uint8ClampedArray.from(rgba))).toEqual({
      bottom: 2,
      left: 1,
      right: 3,
      top: 0,
    });
    expect(opaqueBoundsOfRgba(2, 2, new Uint8ClampedArray(16).fill(200, 0, 3))).toBeUndefined();
  });
});
