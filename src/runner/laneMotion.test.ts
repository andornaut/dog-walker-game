import { describe, expect, it } from "vitest";

import {
  advanceLaneMotion,
  destinationLane,
  type LaneMotion,
  laneMotionX,
  occupiedLanes,
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
  it("starts a move one lane in the requested direction", () => {
    expect(requestLaneMove(config, 1, stillInLane(2))).toEqual(moving(2, 3));
    expect(requestLaneMove(config, -1, stillInLane(2))).toEqual(moving(2, 1));
  });

  it("stays still when moving off either road edge", () => {
    expect(requestLaneMove(config, -1, stillInLane(0))).toEqual(stillInLane(0));
    expect(requestLaneMove(config, 1, stillInLane(4))).toEqual(stillInLane(4));
  });

  it("changes lane at once when the move takes no time", () => {
    const instant = { ...config, moveDuration: 0 };
    expect(requestLaneMove(instant, 1, stillInLane(2))).toEqual(stillInLane(3));
  });

  it("queues a request made while moving, without changing the current move", () => {
    const queued = requestLaneMove(config, 1, moving(2, 3, 0.1));
    expect(queued).toEqual({ ...moving(2, 3, 0.1), queued: 1 });
  });

  it("keeps only the latest queued request", () => {
    const first = requestLaneMove(config, 1, moving(2, 3));
    expect(requestLaneMove(config, -1, first)).toEqual({ ...moving(2, 3), queued: -1 });
  });
});

describe("advanceLaneMotion", () => {
  it("counts elapsed time while moving", () => {
    expect(advanceLaneMotion(config, 0.05, moving(2, 3))).toEqual(moving(2, 3, 0.05));
  });

  it("arrives still in the destination lane once the duration has passed", () => {
    expect(advanceLaneMotion(config, 0.2, moving(2, 3))).toEqual(stillInLane(3));
  });

  it("leaves a still pack alone", () => {
    expect(advanceLaneMotion(config, 1, stillInLane(2))).toEqual(stillInLane(2));
  });

  it("starts the queued move on arrival and carries the leftover time into it", () => {
    const queued = { ...moving(2, 3, 0.15), queued: 1 as const };
    const next = advanceLaneMotion(config, 0.1, queued);
    expect(next).toMatchObject({ from: 3, kind: "moving", to: 4 });
    expect((next as Moving).elapsed).toBeCloseTo(0.05);
  });

  it("runs a queued move back the way it came", () => {
    const queued = { ...moving(2, 3), queued: -1 as const };
    expect(advanceLaneMotion(config, 0.2, queued)).toEqual(moving(3, 2));
  });

  it("drops a queued move that would leave the road", () => {
    const queued = { ...moving(3, 4), queued: 1 as const };
    expect(advanceLaneMotion(config, 0.3, queued)).toEqual(stillInLane(4));
  });

  it("finishes both the current and queued moves in one long step", () => {
    const queued = { ...moving(1, 2), queued: 1 as const };
    expect(advanceLaneMotion(config, 1, queued)).toEqual(stillInLane(3));
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

describe("occupiedLanes", () => {
  it("is the one lane while still", () => {
    expect(occupiedLanes(stillInLane(2))).toEqual([2]);
  });

  it("is both the origin and destination lanes while moving", () => {
    expect(occupiedLanes(moving(2, 1, 0.01))).toEqual([2, 1]);
  });
});

describe("destinationLane", () => {
  it("is the lane being moved to while moving", () => {
    expect(destinationLane(moving(2, 3))).toBe(3);
    expect(destinationLane(stillInLane(1))).toBe(1);
  });
});

describe("laneMotionX", () => {
  it("is the lane centre while still", () => {
    expect(laneMotionX(laneXs, stillInLane(4))).toBe(332);
  });

  it("interpolates between the lane centres while moving", () => {
    expect(laneMotionX(laneXs, moving(2, 3, 0.05))).toBeCloseTo(234);
    expect(laneMotionX(laneXs, moving(2, 1, 0.1))).toBeCloseTo(192);
  });
});
