import { describe, expect, it } from "vitest";

import { laneCenterXs, type LaneDirection, laneDividerXs, moveLane } from "./lanes";

const road = { height: 600, width: 280, x: 80, y: 40 };

describe("moveLane", () => {
  // One lane left or right, staying in the edge lane when moving off the road.
  it.each<[number, LaneDirection, number]>([
    [2, -1, 1],
    [2, 1, 3],
    [0, -1, 0],
    [4, 1, 4],
  ])("moves from lane %d by %d to lane %d", (lane, direction, expected) => {
    expect(moveLane(5, direction, lane)).toBe(expected);
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
