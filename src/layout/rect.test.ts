import { describe, expect, it } from "vitest";

import { containsPoint, insetRect } from "./rect";

describe("containsPoint", () => {
  const rect = { height: 20, width: 10, x: 5, y: 40 };

  it("holds points on its left and top edges and inside", () => {
    expect(containsPoint(rect, 5, 40)).toBe(true);
    expect(containsPoint(rect, 14, 59)).toBe(true);
  });

  it("does not hold points on its right and bottom edges or outside", () => {
    expect(containsPoint(rect, 15, 50)).toBe(false);
    expect(containsPoint(rect, 10, 60)).toBe(false);
    expect(containsPoint(rect, 4, 50)).toBe(false);
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
