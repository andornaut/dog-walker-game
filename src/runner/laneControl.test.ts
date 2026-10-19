import { describe, expect, it } from "vitest";

import {
  advanceLaneControl,
  isSteeringLocked,
  type LaneControl,
  laneControlIn,
  pullLane,
  steerLane,
} from "./laneControl";
import { advanceLaneMotion, destinationLane, type LaneMotion, stillInLane } from "./laneMotion";

const config = { laneCount: 5, moveDuration: 0.2 };

const still = (lane: number) => laneControlIn(stillInLane(lane));
const advance = (seconds: number, control: LaneControl) =>
  advanceLaneControl(config, seconds, control);

describe("steerLane", () => {
  it("moves the pack when steering is not locked", () => {
    const control = steerLane(config, 1, still(2));
    expect(destinationLane(control.motion)).toBe(3);
  });

  it("is ignored while a pull's lock lasts", () => {
    const pulled = advance(0.2, pullLane(config, 0.5, 1, still(2)));
    expect(steerLane(config, -1, pulled)).toBe(pulled);
  });

  it("works again once the lock has run out", () => {
    const control = advance(0.75, pullLane(config, 0.5, 1, still(2)));
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

  it("drops a queued pull and its lock when a later press replaces it", () => {
    let control = steerLane(config, 1, still(2));
    control = pullLane(config, 0.5, 1, control);
    control = steerLane(config, 1, control);
    control = advance(0.4, control);
    expect(control.motion).toEqual(stillInLane(4));
    expect(isSteeringLocked(control)).toBe(false);
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

  it("keeps a longer lock that is already running", () => {
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

  it("replaces a player move queued mid-move", () => {
    let control = steerLane(config, 1, still(2));
    control = steerLane(config, 1, control);
    control = pullLane(config, 0.25, -1, control);
    control = advance(0.4, control);
    expect(control.motion).toEqual(stillInLane(2));
  });

  it("locks nothing for a small dog", () => {
    expect(isSteeringLocked(advance(0.2, pullLane(config, 0, 1, still(2))))).toBe(false);
  });
});

describe("advanceLaneControl", () => {
  it("runs a running lock down to zero and no further", () => {
    const locked = pullLane(config, 0.25, 1, still(4));
    expect(advance(0.1, locked).lockSeconds).toBeCloseTo(0.15);
    expect(advance(1, locked).lockSeconds).toBe(0);
  });

  it("moves the pack exactly as the lane motion alone does", () => {
    const motion: LaneMotion = {
      duration: 0.2,
      elapsed: 0.03,
      from: 1,
      kind: "moving",
      queued: 1,
      to: 2,
    };
    for (const seconds of [0.05, 0.17, 0.3, 1]) {
      const actual = advance(seconds, laneControlIn(motion)).motion;
      const expected = advanceLaneMotion(config, seconds, motion);
      if (actual.kind === "moving" && expected.kind === "moving") {
        expect(actual).toMatchObject({ ...expected, elapsed: actual.elapsed });
        expect(actual.elapsed).toBeCloseTo(expected.elapsed);
      } else {
        expect(actual).toEqual(expected);
      }
    }
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
