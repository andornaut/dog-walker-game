import { describe, expect, it } from "vitest";

import {
  destinationLane,
  type LaneMotion,
  laneMotionX,
  type MovingLaneMotion,
  startMove,
  stillInLane,
  turnAround,
} from "./laneMotion";

const config = { laneCount: 5, moveDuration: 0.2 };
const laneXs = [108, 164, 220, 276, 332];

const moving = (from: number, to: number, elapsed = 0): MovingLaneMotion => ({
  duration: 0.2,
  elapsed,
  from,
  kind: "moving",
  to,
});

describe("startMove", () => {
  it("starts a move a lane either way, and stays still off either edge", () => {
    for (const { direction, expected, lane } of [
      { direction: 1, expected: moving(2, 3), lane: 2, name: "starts a move right" },
      { direction: -1, expected: moving(2, 1), lane: 2, name: "starts a move left" },
      { direction: -1, expected: stillInLane(0), lane: 0, name: "stays still off the left edge" },
      { direction: 1, expected: stillInLane(4), lane: 4, name: "stays still off the right edge" },
    ] satisfies readonly {
      direction: 1 | -1;
      expected: LaneMotion;
      lane: number;
      name: string;
    }[]) {
      expect(startMove(config, direction, lane)).toEqual(expected);
    }
  });

  it("changes lane at once when the move takes no time", () => {
    expect(startMove({ ...config, moveDuration: 0 }, 1, 2)).toEqual(stillInLane(3));
  });
});

describe("turnAround", () => {
  it("heads back the way the pack came at once, from where it is", () => {
    const before = moving(2, 3, 0.05);
    const turned = turnAround(before);
    expect(turned).toMatchObject({ from: 3, kind: "moving", to: 2 });
    expect(turned.kind === "moving" && turned.elapsed).toBeCloseTo(0.15);
    expect(laneMotionX(laneXs, turned)).toBeCloseTo(laneMotionX(laneXs, before));
    expect(turnAround(moving(2, 1, 0.12))).toMatchObject({ from: 1, to: 2 });
  });

  it("is back still in the lane it came from when turned around before moving at all", () => {
    expect(turnAround(moving(2, 3, 0))).toEqual(stillInLane(2));
  });
});

describe("destinationLane and laneMotionX", () => {
  it("are the lane and its centre while still", () => {
    expect(destinationLane(stillInLane(1))).toBe(1);
    expect(laneMotionX(laneXs, stillInLane(4))).toBe(332);
  });

  it("are the lane moved to and a point between the centres while moving", () => {
    expect(destinationLane(moving(2, 3))).toBe(3);
    expect(laneMotionX(laneXs, moving(2, 3, 0.05))).toBeCloseTo(234);
    expect(laneMotionX(laneXs, moving(2, 1, 0.1))).toBeCloseTo(192);
  });
});
