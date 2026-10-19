import { describe, expect, it } from "vitest";

import { laneCenters, moveLane } from "./lanes";

describe("moveLane", () => {
  it("moves one lane left or right", () => {
    expect(moveLane(5, -1, 2)).toBe(1);
    expect(moveLane(5, 1, 2)).toBe(3);
  });

  it("stays in the edge lane when moving off the road", () => {
    expect(moveLane(5, -1, 0)).toBe(0);
    expect(moveLane(5, 1, 4)).toBe(4);
  });
});

describe("laneCenters", () => {
  it("puts each centre in the middle of its share of the road", () => {
    expect(laneCenters(5, { height: 600, width: 280, x: 80, y: 40 })).toEqual([
      108, 164, 220, 276, 332,
    ]);
  });

  it("returns one centre per lane", () => {
    expect(laneCenters(3, { height: 100, width: 90, x: 0, y: 0 })).toHaveLength(3);
  });
});
