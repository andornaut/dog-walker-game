import { describe, expect, it } from "vitest";

import type { Point } from "../lib/rect";
import { arrowheadPixels, compassStep } from "./arrowhead";

const key = ({ x, y }: Point) => `${x},${y}`;
// A pixel offset reflected across the line through the tip along step.
const reflect = (step: Point, { x, y }: Point): Point => {
  const along = (2 * (x * step.x + y * step.y)) / (step.x * step.x + step.y * step.y);
  return { x: along * step.x - x, y: along * step.y - y };
};

describe("compassStep", () => {
  it.each([
    [10, 0, 1, 0],
    [10, 3, 1, 0],
    [10, 8, 1, 1],
    [1, -10, 0, -1],
    [-6, -7, -1, -1],
    [-10, 2, -1, 0],
  ])("snaps (%d, %d) to (%d, %d)", (dx, dy, x, y) => {
    expect(compassStep(dx, dy)).toEqual({ x, y });
  });
});

describe("arrowheadPixels", () => {
  // A line's direction, at angles on and between the compass steps.
  it.each([[0], [20], [45], [60], [90], [135], [200], [250], [315]])(
    "is symmetric about its axis for a line at %d degrees",
    (degrees) => {
      const dx = Math.cos((degrees * Math.PI) / 180);
      const dy = Math.sin((degrees * Math.PI) / 180);
      const step = compassStep(dx, dy);
      const pixels = arrowheadPixels(4, dx, dy);
      const shown = new Set(pixels.map(key));
      expect(pixels.filter((pixel) => !shown.has(key(reflect(step, pixel))))).toEqual([]);
      expect(shown.has("0,0")).toBe(true);
      // Every pixel lies behind the tip.
      expect(pixels.every(({ x, y }) => x * step.x + y * step.y <= 0)).toBe(true);
    },
  );
});
