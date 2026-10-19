import { describe, expect, it } from "vitest";

import {
  advanceLaneMotion,
  destinationLane,
  isReverseMove,
  type LaneMotion,
  laneMotionX,
  occupiedLanes,
  queueLaneMove,
  requestLaneMove,
  stillInLane,
} from "./laneMotion";

const config = { laneCount: 5, moveDuration: 0.2 };
const laneXs = [108, 164, 220, 276, 332];

type Moving = Extract<LaneMotion, { kind: "moving" }>;

const moving = (from: number, to: number, elapsed = 0): Moving => ({
  duration: 0.2,
  elapsed,
  from,
  kind: "moving",
  to,
});

describe("requestLaneMove", () => {
  it.each<{ direction: 1 | -1; expected: LaneMotion; from: LaneMotion; name: string }>([
    { direction: 1, expected: moving(2, 3), from: stillInLane(2), name: "starts a move right" },
    { direction: -1, expected: moving(2, 1), from: stillInLane(2), name: "starts a move left" },
    {
      direction: -1,
      expected: stillInLane(0),
      from: stillInLane(0),
      name: "stays still off the left edge",
    },
    {
      direction: 1,
      expected: stillInLane(4),
      from: stillInLane(4),
      name: "stays still off the right edge",
    },
    {
      direction: 1,
      expected: { ...moving(2, 3, 0.05), queued: 1 },
      from: { ...moving(2, 3, 0.05), queued: -1 },
      name: "replaces an earlier queued move with the latest press",
    },
    {
      direction: -1,
      expected: moving(3, 2, 0.1),
      from: { ...moving(2, 3, 0.1), queued: 1 },
      name: "drops the queued move when it turns around",
    },
    {
      direction: -1,
      expected: stillInLane(2),
      from: moving(2, 3, 0),
      name: "is back still in the lane it came from when turned around before moving at all",
    },
  ])("$name", ({ direction, expected, from }) => {
    expect(requestLaneMove(config, direction, from)).toEqual(expected);
  });

  it("changes lane at once when the move takes no time", () => {
    const instant = { ...config, moveDuration: 0 };
    expect(requestLaneMove(instant, 1, stillInLane(2))).toEqual(stillInLane(3));
  });

  it("turns the pack around at once, where it is, on a press against the current move", () => {
    const before = moving(2, 3, 0.05);
    const turned = requestLaneMove(config, -1, before);
    expect(turned).toMatchObject({ from: 3, kind: "moving", to: 2 });
    expect((turned as Moving).elapsed).toBeCloseTo(0.15);
    expect(laneMotionX(laneXs, turned)).toBeCloseTo(laneMotionX(laneXs, before));
    expect(requestLaneMove(config, 1, moving(2, 1, 0.12))).toMatchObject({ from: 1, to: 2 });
  });
});

describe("queueLaneMove", () => {
  it("starts a move from still like a press, but queues one against the current move", () => {
    expect(queueLaneMove(config, 1, stillInLane(2))).toEqual(moving(2, 3));
    expect(queueLaneMove(config, -1, moving(2, 3, 0.05))).toEqual({
      ...moving(2, 3, 0.05),
      queued: -1,
    });
  });
});

describe("isReverseMove", () => {
  it("is true only for a direction against a move in progress", () => {
    expect(isReverseMove(-1, moving(2, 3))).toBe(true);
    expect(isReverseMove(1, moving(2, 3))).toBe(false);
    expect(isReverseMove(-1, stillInLane(2))).toBe(false);
  });
});

describe("advanceLaneMotion", () => {
  it.each<{ expected: LaneMotion; from: LaneMotion; name: string; seconds: number }>([
    {
      expected: stillInLane(3),
      from: moving(2, 3),
      name: "arrives still in the destination lane once the duration has passed",
      seconds: 0.2,
    },
    {
      expected: moving(3, 2),
      from: { ...moving(2, 3), queued: -1 },
      name: "runs a queued move back the way it came",
      seconds: 0.2,
    },
    {
      expected: stillInLane(4),
      from: { ...moving(3, 4), queued: 1 },
      name: "drops a queued move that would leave the road",
      seconds: 0.3,
    },
    {
      expected: stillInLane(3),
      from: { ...moving(1, 2), queued: 1 },
      name: "finishes both the current and queued moves in one long step",
      seconds: 1,
    },
  ])("$name", ({ expected, from, seconds }) => {
    expect(advanceLaneMotion(config, seconds, from)).toEqual(expected);
  });

  it("ends in the same place however the time is split into steps", () => {
    // 0.17 s finishes the first move, leaving 0.13 s into the queued one.
    const queued: LaneMotion = { ...moving(1, 2, 0.03), queued: 1 };
    let manySteps: LaneMotion = queued;
    for (let i = 0; i < 6; i++) {
      manySteps = advanceLaneMotion(config, 0.05, manySteps);
    }
    for (const motion of [advanceLaneMotion(config, 0.3, queued), manySteps]) {
      expect(motion).toMatchObject({ from: 2, kind: "moving", to: 3 });
      expect((motion as Moving).elapsed).toBeCloseTo(0.13);
    }
  });
});

describe("occupiedLanes, destinationLane and laneMotionX", () => {
  it("are the one lane and its centre while still", () => {
    expect(occupiedLanes(stillInLane(2))).toEqual([2]);
    expect(destinationLane(stillInLane(1))).toBe(1);
    expect(laneMotionX(laneXs, stillInLane(4))).toBe(332);
  });

  it("are both lanes, the lane moved to, and a point between the centres while moving", () => {
    expect(occupiedLanes(moving(2, 1, 0.01))).toEqual([2, 1]);
    expect(destinationLane(moving(2, 3))).toBe(3);
    expect(laneMotionX(laneXs, moving(2, 3, 0.05))).toBeCloseTo(234);
    expect(laneMotionX(laneXs, moving(2, 1, 0.1))).toBeCloseTo(192);
  });
});
