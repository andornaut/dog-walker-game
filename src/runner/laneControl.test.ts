import { describe, expect, it } from "vitest";

import {
  advanceLaneControl,
  isSteeringLocked,
  laneControlIn,
  pullLane,
  steerLane,
} from "./laneControl";
import { destinationLane, stillInLane } from "./laneMotion";

const config = { laneCount: 5, moveDuration: 0.2 };

describe("steerLane", () => {
  it("moves the pack when steering is not locked", () => {
    const control = steerLane(config, 1, laneControlIn(stillInLane(2)));
    expect(destinationLane(control.motion)).toBe(3);
  });

  it("is ignored while a pull's lock lasts", () => {
    const pulled = advanceLaneControl(
      config,
      0.2,
      pullLane(config, 0.5, 1, laneControlIn(stillInLane(2))),
    );
    expect(steerLane(config, -1, pulled)).toBe(pulled);
  });

  it("works again once the lock has run out", () => {
    let control = pullLane(config, 0.5, 1, laneControlIn(stillInLane(2)));
    control = advanceLaneControl(config, 0.5, control);
    expect(isSteeringLocked(control)).toBe(false);
    expect(destinationLane(steerLane(config, -1, control).motion)).toBe(2);
  });
});

describe("pullLane", () => {
  it("moves the pack one lane and starts the lock", () => {
    const control = pullLane(config, 0.25, -1, laneControlIn(stillInLane(2)));
    expect(destinationLane(control.motion)).toBe(1);
    expect(control.lockSeconds).toBe(0.25);
  });

  it("is not blocked by a lock from an earlier pull", () => {
    const first = pullLane(config, 0.5, 1, laneControlIn(stillInLane(1)));
    const second = advanceLaneControl(
      config,
      0.25,
      pullLane(config, 0.5, 1, advanceLaneControl(config, 0.2, first)),
    );
    expect(destinationLane(second.motion)).toBe(3);
  });

  it("keeps a longer lock that is already running", () => {
    const big = pullLane(config, 0.5, 1, laneControlIn(stillInLane(1)));
    expect(pullLane(config, 0, 1, big).lockSeconds).toBe(0.5);
  });

  it("replaces a player move queued mid-move", () => {
    let control = steerLane(config, 1, laneControlIn(stillInLane(2)));
    control = steerLane(config, 1, control);
    control = pullLane(config, 0.25, -1, control);
    control = advanceLaneControl(config, 0.4, control);
    expect(control.motion).toEqual(stillInLane(2));
  });

  it("locks nothing for a small dog", () => {
    const control = pullLane(config, 0, 1, laneControlIn(stillInLane(2)));
    expect(isSteeringLocked(control)).toBe(false);
  });
});

describe("advanceLaneControl", () => {
  it("runs the lock down to zero and no further", () => {
    const control = pullLane(config, 0.25, 1, laneControlIn(stillInLane(2)));
    expect(advanceLaneControl(config, 0.1, control).lockSeconds).toBeCloseTo(0.15);
    expect(advanceLaneControl(config, 1, control).lockSeconds).toBe(0);
  });

  it("advances the lane motion", () => {
    const control = steerLane(config, 1, laneControlIn(stillInLane(2)));
    expect(advanceLaneControl(config, 0.2, control).motion).toEqual(stillInLane(3));
  });
});
