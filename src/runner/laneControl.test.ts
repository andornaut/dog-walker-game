import { describe, expect, it } from "vitest";

import {
  advanceLaneControl,
  type LaneControl,
  laneControlIn,
  pullLane,
  steerLane,
} from "./laneControl";
import { destinationLane, stillInLane } from "./laneMotion";

const config = { laneCount: 5, moveDuration: 0.2 };

const still = (lane: number) => laneControlIn(stillInLane(lane));
const advance = (seconds: number, control: LaneControl) =>
  advanceLaneControl(config, seconds, control);

describe("steerLane", () => {
  it("works at once after a pull's move ends", () => {
    const pulled = advance(0.2, pullLane(config, 1, still(2)));
    expect(destinationLane(steerLane(config, -1, pulled).motion)).toBe(2);
  });

  it("turns a pull around during its move", () => {
    let control = advance(0.05, pullLane(config, 1, still(2)));
    control = steerLane(config, -1, control);
    expect(destinationLane(control.motion)).toBe(2);
    control = advance(0.05, control);
    expect(control.motion).toEqual(stillInLane(2));
  });

  it("lets a press during a pull's move change the target", () => {
    let control = steerLane(config, 1, still(2));
    control = pullLane(config, 1, control);
    control = steerLane(config, -1, control);
    control = advance(0.4, control);
    expect(control.motion).toEqual(stillInLane(3));
  });

  it("ends two lanes over and one back a lane over, without turning around", () => {
    let control = steerLane(config, 1, still(2));
    control = steerLane(config, 1, advance(0.05, control));
    control = steerLane(config, -1, advance(0.05, control));
    expect(control.motion).toMatchObject({ from: 2, kind: "moving", to: 3 });
    expect(advance(1, control).motion).toEqual(stillInLane(3));
  });

  it("turns around at once when the target falls behind the move", () => {
    let control = advance(0.05, steerLane(config, 1, still(2)));
    control = steerLane(config, -1, control);
    expect(control.motion).toMatchObject({ from: 3, kind: "moving", to: 2 });
    expect(advance(0.05, control).motion).toEqual(stillInLane(2));
  });

  it("heads on past the lane it started from when turning around before setting off", () => {
    let control = steerLane(config, 1, still(1));
    control = pullLane(config, -1, control);
    control = steerLane(config, -1, control);
    expect(control.target).toBe(0);
    expect(advance(1, control).motion).toEqual(stillInLane(0));
  });

  it("holds the target at the road's edges", () => {
    expect(steerLane(config, 1, still(4)).target).toBe(4);
    let control = still(1);
    control = steerLane(config, -1, steerLane(config, -1, control));
    expect(control.target).toBe(0);
    control = steerLane(config, 1, control);
    expect(advance(1, control).motion).toEqual(stillInLane(1));
  });
});

describe("steering symmetry", () => {
  const steerTimes = (direction: 1 | -1, times: number, from: LaneControl) => {
    let control = from;
    for (let i = 0; i < times; i++) {
      control = advance(0.02, steerLane(config, direction, control));
    }
    return advance(1, control).motion;
  };

  it("ends any number of steers left or right as many lanes over", () => {
    for (const times of [1, 2, 3]) {
      expect(steerTimes(1, times, still(1))).toEqual(stillInLane(1 + times));
      expect(steerTimes(-1, times, still(3))).toEqual(stillInLane(3 - times));
    }
  });
});

describe("pullLane", () => {
  it("leaves the pack in the edge lane when the pull cannot leave the road", () => {
    expect(pullLane(config, 1, still(4))).toEqual(still(4));
  });

  it("moves on from an earlier pull", () => {
    const first = advance(0.2, pullLane(config, 1, still(1)));
    const second = advance(0.25, pullLane(config, 1, first));
    expect(destinationLane(second.motion)).toBe(3);
  });

  it("queues behind the current move", () => {
    let control = steerLane(config, 1, still(1));
    control = pullLane(config, 1, control);
    control = advance(0.3, control);
    expect(control.motion).toMatchObject({ from: 2, kind: "moving", to: 3 });
    control = advance(0.15, control);
    expect(control.motion).toEqual(stillInLane(3));
  });

  it("replaces the player's target mid-move", () => {
    let control = steerLane(config, 1, still(2));
    control = steerLane(config, 1, control);
    control = pullLane(config, -1, control);
    control = advance(0.4, control);
    expect(control.motion).toEqual(stillInLane(2));
  });
});

describe("advanceLaneControl", () => {
  it("carries the time left after an arrival into the next lane change", () => {
    const control: LaneControl = {
      motion: { duration: 0.2, elapsed: 0.03, from: 1, kind: "moving", to: 2 },
      target: 3,
    };
    const short = advance(0.05, control).motion;
    expect(short).toMatchObject({ from: 1, kind: "moving", to: 2 });
    expect(short.kind === "moving" && short.elapsed).toBeCloseTo(0.08);
    const onward = advance(0.3, control).motion;
    expect(onward).toMatchObject({ from: 2, kind: "moving", to: 3 });
    expect(onward.kind === "moving" && onward.elapsed).toBeCloseTo(0.13);
    expect(advance(1, control).motion).toEqual(stillInLane(3));
  });

  it("ends in the same place however the time is split into steps", () => {
    const pulled = pullLane(config, 1, steerLane(config, 1, still(0)));
    let manySteps = pulled;
    for (let i = 0; i < 10; i++) {
      manySteps = advance(0.05, manySteps);
    }
    const oneStep = advance(0.5, pulled);
    expect(manySteps.motion).toEqual(oneStep.motion);
  });
});
