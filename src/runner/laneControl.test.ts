import { describe, expect, it } from "vitest";

import {
  advanceLaneControl,
  isSteeringLocked,
  type LaneControl,
  laneControlIn,
  lockSteering,
  pullLane,
  steerLane,
} from "./laneControl";
import { destinationLane, stillInLane } from "./laneMotion";

const config = { laneCount: 5, moveDuration: 0.2 };

const still = (lane: number) => laneControlIn(stillInLane(lane));
const advance = (seconds: number, control: LaneControl) =>
  advanceLaneControl(config, seconds, control);

describe("steerLane", () => {
  it("moves the pack when steering is not locked", () => {
    const control = steerLane(config, 1, still(2));
    expect(destinationLane(control.motion)).toBe(3);
  });

  it("is ignored while a pull's lock lasts, and works again once it has run out", () => {
    const pulled = advance(0.2, pullLane(config, 0.5, 1, still(2)));
    expect(steerLane(config, -1, pulled)).toBe(pulled);
    const control = advance(0.55, pulled);
    expect(isSteeringLocked(control)).toBe(false);
    expect(destinationLane(steerLane(config, -1, control).motion)).toBe(2);
  });

  it("turns a pull around during its move, and the lock still starts on arrival", () => {
    let control = advance(0.05, pullLane(config, 0.5, 1, still(2)));
    control = steerLane(config, -1, control);
    expect(destinationLane(control.motion)).toBe(2);
    control = advance(0.05, control);
    expect(control.motion).toEqual(stillInLane(2));
    expect(control.lockSeconds).toBeCloseTo(0.5);
  });

  it("lets a press during a pull's move change the target, and still locks on arrival", () => {
    let control = steerLane(config, 1, still(2));
    control = pullLane(config, 0.5, 1, control);
    control = steerLane(config, -1, control);
    control = advance(0.4, control);
    expect(control.motion).toEqual(stillInLane(3));
    expect(control.lockSeconds).toBeCloseTo(0.3);
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
    control = pullLane(config, 0.5, -1, control);
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

  it.each([1, 2, 3])("ends %i steers left or right as many lanes over", (times) => {
    expect(steerTimes(1, times, still(1))).toEqual(stillInLane(1 + times));
    expect(steerTimes(-1, times, still(3))).toEqual(stillInLane(3 - times));
  });
});

describe("lockSteering", () => {
  it("keeps a longer lock that is already running", () => {
    expect(lockSteering(0.2, lockSteering(0.5, still(2))).lockSeconds).toBe(0.5);
  });
});

describe("pullLane", () => {
  it("moves the pack one lane and does not lock until the move ends", () => {
    const control = pullLane(config, 0.25, -1, still(2));
    expect(destinationLane(control.motion)).toBe(1);
    expect(isSteeringLocked(control)).toBe(false);
    expect(isSteeringLocked(advance(0.19, control))).toBe(false);
  });

  it("starts the lock when the pull's move ends and counts down the time after it", () => {
    const control = advance(0.3, pullLane(config, 0.25, -1, still(2)));
    expect(control.motion).toEqual(stillInLane(1));
    expect(control.lockSeconds).toBeCloseTo(0.15);
  });

  it("locks at once when the pull cannot leave the road", () => {
    expect(pullLane(config, 0.25, 1, still(4)).lockSeconds).toBe(0.25);
  });

  it("is not blocked by a lock from an earlier pull", () => {
    const first = advance(0.2, pullLane(config, 0.5, 1, still(1)));
    const second = advance(0.25, pullLane(config, 0.5, 1, first));
    expect(destinationLane(second.motion)).toBe(3);
  });

  it("locks nothing for a small dog, keeping a longer lock that is already running", () => {
    expect(isSteeringLocked(advance(0.2, pullLane(config, 0, 1, still(2))))).toBe(false);
    const locked = advance(0.2, pullLane(config, 0.5, 1, still(1)));
    const smallPull = advance(0.2, pullLane(config, 0, 1, locked));
    expect(smallPull.lockSeconds).toBeCloseTo(0.3);
  });

  it("queues behind the current move and locks only once its own move ends", () => {
    let control = steerLane(config, 1, still(1));
    control = pullLane(config, 0.25, 1, control);
    control = advance(0.3, control);
    expect(control.motion).toMatchObject({ from: 2, kind: "moving", to: 3 });
    expect(isSteeringLocked(control)).toBe(false);
    control = advance(0.15, control);
    expect(control.motion).toEqual(stillInLane(3));
    expect(control.lockSeconds).toBeCloseTo(0.2);
  });

  it("replaces the player's target mid-move", () => {
    let control = steerLane(config, 1, still(2));
    control = steerLane(config, 1, control);
    control = pullLane(config, 0.25, -1, control);
    control = advance(0.4, control);
    expect(control.motion).toEqual(stillInLane(2));
  });
});

describe("advanceLaneControl", () => {
  it("runs a running lock down to zero and no further", () => {
    const locked = pullLane(config, 0.25, 1, still(4));
    expect(advance(0.1, locked).lockSeconds).toBeCloseTo(0.15);
    expect(advance(1, locked).lockSeconds).toBe(0);
  });

  it("carries the time left after an arrival into the next lane change", () => {
    const control: LaneControl = {
      lockSeconds: 0,
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

  it("ends in the same place and lock however the time is split into steps", () => {
    const pulled = pullLane(config, 0.5, 1, steerLane(config, 1, still(0)));
    let manySteps = pulled;
    for (let i = 0; i < 10; i++) {
      manySteps = advance(0.05, manySteps);
    }
    const oneStep = advance(0.5, pulled);
    expect(manySteps.motion).toEqual(oneStep.motion);
    expect(manySteps.lockSeconds).toBeCloseTo(oneStep.lockSeconds);
    expect(oneStep.lockSeconds).toBeCloseTo(0.4);
  });
});
