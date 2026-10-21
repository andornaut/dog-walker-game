import { describe, expect, it } from "vitest";

import { type LaneDirection, moveLane } from "./lanes";

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
