import type { LaneDirection } from "../layout/lanes";
import {
  advanceLaneMotion,
  type LaneMotion,
  type LaneMotionConfig,
  requestLaneMove,
} from "./laneMotion";

// lockSeconds is how long player steering is still ignored after a pull.
export interface LaneControl {
  lockSeconds: number;
  motion: LaneMotion;
}

export function laneControlIn(motion: LaneMotion): LaneControl {
  return { lockSeconds: 0, motion };
}

export function isSteeringLocked(control: LaneControl): boolean {
  return control.lockSeconds > 0;
}

// The player's lane change, ignored while a pull's lock lasts.
export function steerLane(
  config: LaneMotionConfig,
  direction: LaneDirection,
  control: LaneControl,
): LaneControl {
  if (isSteeringLocked(control)) {
    return control;
  }
  return { ...control, motion: requestLaneMove(config, direction, control.motion) };
}

// A dog's pull is never blocked by the lock. Mid-move it replaces any queued player move.
// The lock runs from the pull, and a longer lock already running is kept.
export function pullLane(
  config: LaneMotionConfig,
  lockSeconds: number,
  direction: LaneDirection,
  control: LaneControl,
): LaneControl {
  return {
    lockSeconds: Math.max(control.lockSeconds, lockSeconds),
    motion: requestLaneMove(config, direction, control.motion),
  };
}

export function advanceLaneControl(
  config: LaneMotionConfig,
  stepSeconds: number,
  control: LaneControl,
): LaneControl {
  return {
    lockSeconds: Math.max(0, control.lockSeconds - stepSeconds),
    motion: advanceLaneMotion(config, stepSeconds, control.motion),
  };
}
