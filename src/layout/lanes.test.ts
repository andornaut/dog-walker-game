import { describe, expect, it } from "vitest";

import { laneCenterXs, laneDividerXs, moveLane } from "./lanes";

const road = { height: 600, width: 280, x: 80, y: 40 };

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

describe("laneCenterXs", () => {
  it("puts each centre in the middle of its share of the road", () => {
    expect(laneCenterXs(5, road)).toEqual([108, 164, 220, 276, 332]);
  });
});

describe("laneDividerXs", () => {
  it("puts a divider on each inner lane boundary and none on the road edges", () => {
    expect(laneDividerXs(5, road)).toEqual([136, 192, 248, 304]);
  });
});
