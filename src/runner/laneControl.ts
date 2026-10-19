import { clampIndex } from "../arrays";
import type { LaneDirection } from "../layout/lanes";
import {
  destinationLane,
  type LaneMotion,
  type LaneMotionConfig,
  queueLaneMove,
  requestLaneMove,
  stillInLane,
} from "./laneMotion";

// target is the lane the pack heads for, one lane-change at a time; each steer moves it by
// one, so a quick drag across three lanes ends three lanes over. lockSeconds is how long
// steering is still ignored. lockOnArrival is a pull's lock, which starts once the pack stops.
export interface LaneControl {
  lockOnArrival?: number;
  lockSeconds: number;
  motion: LaneMotion;
  target: number;
}

// The motion's own queued move counts toward the target.
export function laneControlIn(motion: LaneMotion): LaneControl {
  if (motion.kind === "still") {
    return { lockSeconds: 0, motion, target: motion.lane };
  }
  const { queued, ...move } = motion;
  return { lockSeconds: 0, motion: move, target: motion.to + (queued ?? 0) };
}

export function isSteeringLocked(control: LaneControl): boolean {
  return control.lockSeconds > 0;
}

// A longer lock already running is kept.
function startLock(seconds: number | undefined, runningSeconds: number): number {
  return Math.max(runningSeconds, seconds ?? 0);
}

const directionTo = (from: number, to: number): LaneDirection => (to < from ? -1 : 1);
const reverse = (direction: LaneDirection): LaneDirection => (direction === 1 ? -1 : 1);

// Still, the pack sets off toward target. Moving away from it, the pack turns around at once
// from where it is; otherwise it carries on and heads on from the lane it reaches.
function headFor(config: LaneMotionConfig, target: number, motion: LaneMotion): LaneMotion {
  if (motion.kind === "still") {
    return motion.lane === target
      ? motion
      : queueLaneMove(config, directionTo(motion.lane, target), motion);
  }
  const heading = directionTo(motion.from, motion.to);
  return (target - motion.to) * heading < 0
    ? requestLaneMove(config, reverse(heading), motion)
    : motion;
}

// The player's lane change moves the target one lane, held on the road, and is ignored while
// a lock lasts.
export function steerLane(
  config: LaneMotionConfig,
  direction: LaneDirection,
  control: LaneControl,
): LaneControl {
  if (isSteeringLocked(control)) {
    return control;
  }
  const target = clampIndex(config.laneCount, control.target + direction);
  if (target === control.target) {
    return control;
  }
  return { ...control, motion: headFor(config, target, control.motion), target };
}

// A dog's pull is never blocked by the lock. It moves the target one lane past the lane the
// pack is in or heading to, and its lock starts when the pack stops. A pull off the road
// locks at once.
export function pullLane(
  config: LaneMotionConfig,
  lockSeconds: number,
  direction: LaneDirection,
  control: LaneControl,
): LaneControl {
  const from = destinationLane(control.motion);
  const target = clampIndex(config.laneCount, from + direction);
  if (target === from && control.motion.kind === "still") {
    return {
      lockSeconds: startLock(lockSeconds, control.lockSeconds),
      motion: control.motion,
      target,
    };
  }
  const motion =
    control.motion.kind === "still" ? headFor(config, target, control.motion) : control.motion;
  return {
    lockOnArrival: startLock(lockSeconds, control.lockOnArrival ?? 0),
    lockSeconds: control.lockSeconds,
    motion,
    target,
  };
}

// Sets an extra lock, such as a stumble, at once; a longer running lock is kept.
export function lockSteering(seconds: number, control: LaneControl): LaneControl {
  return { ...control, lockSeconds: startLock(seconds, control.lockSeconds) };
}

// Steps from arrival to arrival, so a lock starts at the moment the pack stops and the time
// left over counts it down. Arriving short of the target, the pack sets off for the next lane.
export function advanceLaneControl(
  config: LaneMotionConfig,
  stepSeconds: number,
  control: LaneControl,
): LaneControl {
  let { lockSeconds, motion } = control;
  let { lockOnArrival } = control;
  let secondsLeft = stepSeconds;
  while (motion.kind === "moving") {
    const toArrival = motion.duration - motion.elapsed;
    if (secondsLeft < toArrival) {
      return {
        ...(lockOnArrival === undefined ? {} : { lockOnArrival }),
        lockSeconds: Math.max(0, lockSeconds - secondsLeft),
        motion: { ...motion, elapsed: motion.elapsed + secondsLeft },
        target: control.target,
      };
    }
    secondsLeft -= toArrival;
    lockSeconds = Math.max(0, lockSeconds - toArrival);
    const arrived = stillInLane(motion.to);
    motion = headFor(config, control.target, arrived);
    if (motion.kind === "still") {
      lockSeconds = startLock(lockOnArrival, lockSeconds);
      lockOnArrival = undefined;
    }
  }
  return {
    lockSeconds: Math.max(0, lockSeconds - secondsLeft),
    motion,
    target: control.target,
  };
}
