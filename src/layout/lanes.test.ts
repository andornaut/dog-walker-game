import { describe, expect, it } from "vitest";

import { type LaneDirection, laneMask, moveLane } from "./lanes";

describe("laneMask", () => {
  it.each([
    { count: 0, first: 2, mask: 0b0 },
    { count: 1, first: 3, mask: 0b1000 },
    { count: 3, first: 1, mask: 0b1110 },
    { count: 5, first: 0, mask: 0b11111 },
  ])("sets $count lanes from $first on", ({ count, first, mask }) => {
    expect(laneMask(first, count)).toBe(mask);
  });
});

describe("moveLane", () => {
  // One lane left or right, staying in the edge lane when moving off the road.
  it("moves one lane left or right, staying in the edge lane off the road", () => {
    for (const [lane, direction, expected] of [
      [2, -1, 1],
      [2, 1, 3],
      [0, -1, 0],
      [4, 1, 4],
    ] satisfies readonly [number, LaneDirection, number][]) {
      expect(moveLane(5, direction, lane)).toBe(expected);
    }
  });
});
