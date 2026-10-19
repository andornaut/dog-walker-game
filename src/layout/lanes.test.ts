import { describe, expect, it } from "vitest";

import { defined } from "../testing/defined";
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

  it("returns one centre per lane", () => {
    expect(laneCenterXs(3, { height: 100, width: 90, x: 0, y: 0 })).toHaveLength(3);
  });
});

describe("laneDividerXs", () => {
  it("puts a divider on each inner lane boundary and none on the road edges", () => {
    expect(laneDividerXs(5, road)).toEqual([136, 192, 248, 304]);
  });

  it("puts each divider halfway between the centres of the lanes beside it", () => {
    const centers = laneCenterXs(5, road);
    laneDividerXs(5, road).forEach((x, i) => {
      expect(x).toBeCloseTo((defined(centers[i]) + defined(centers[i + 1])) / 2);
    });
  });
});
