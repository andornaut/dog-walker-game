import { describe, expect, it } from "vitest";

import { containsPoint, insetRect } from "./rect";

describe("containsPoint", () => {
  const rect = { height: 20, width: 10, x: 5, y: 40 };

  it.each([
    ["the top-left corner", 5, 40, true],
    ["the last pixel inside", 14, 59, true],
    ["the right edge", 15, 50, false],
    ["the bottom edge", 10, 60, false],
    ["outside", 4, 50, false],
  ])("holds a point on %s (%d, %d): %s", (_, x, y, expected) => {
    expect(containsPoint(rect, x, y)).toBe(expected);
  });
});

describe("insetRect", () => {
  it("shrinks the rect by the amount on every side", () => {
    expect(insetRect(1, { height: 192, width: 72, x: 4, y: 44 })).toEqual({
      height: 190,
      width: 70,
      x: 5,
      y: 45,
    });
  });
});
