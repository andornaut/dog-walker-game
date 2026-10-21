import { clampIndex } from "../arrays";
import type { LaneDirection } from "../layout/lanes";
import {
  destinationLane,
  type LaneMotion,
  type LaneMotionConfig,
  startMove,
  stillInLane,
  turnAround,
} from "./laneMotion";

// target is the lane the pack heads for, one lane-change at a time; each steer moves it by
// one, so a quick drag across three lanes ends three lanes over. lockSeconds is how long
// steering is still ignored. lockOnArrival is a pull's lock, which starts once the pack stops.
// heading is the way the target last moved, absent before it has.
export interface LaneControl {
  heading?: LaneDirection;
  lockOnArrival?: number;
  lockSeconds: number;
  motion: LaneMotion;
  target: number;
}

export function laneControlIn(motion: LaneMotion): LaneControl {
  return { lockSeconds: 0, motion, target: destinationLane(motion) };
}

export function isSteeringLocked(control: LaneControl): boolean {
  return control.lockSeconds > 0;
}

// A longer lock already running is kept.
function startLock(seconds: number | undefined, runningSeconds: number): number {
  return Math.max(runningSeconds, seconds ?? 0);
}

// The heading a new control carries over from control.
function headingOf(control: LaneControl): Pick<LaneControl, "heading"> {
  return control.heading === undefined ? {} : { heading: control.heading };
}

const directionTo = (from: number, to: number): LaneDirection => (to < from ? -1 : 1);

// Still, the pack sets off toward target. Moving away from it, the pack turns around at once
// from where it is; otherwise it carries on and heads on from the lane it reaches. A move
// turned around before it set off leaves the pack still in its first lane, so it sets off
// again from there: arrivals are what head on, and a still pack has none.
function headFor(config: LaneMotionConfig, target: number, motion: LaneMotion): LaneMotion {
  if (motion.kind === "still") {
    return motion.lane === target
      ? motion
      : startMove(config, directionTo(motion.lane, target), motion.lane);
  }
  const heading = directionTo(motion.from, motion.to);
  if ((target - motion.to) * heading >= 0) {
    return motion;
  }
  const turned = turnAround(motion);
  return turned.kind === "still" ? headFor(config, target, turned) : turned;
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
  return {
    ...control,
    heading: direction,
    motion: headFor(config, target, control.motion),
    target,
  };
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
      ...headingOf(control),
      lockSeconds: startLock(lockSeconds, control.lockSeconds),
      motion: control.motion,
      target,
    };
  }
  const motion =
    control.motion.kind === "still" ? headFor(config, target, control.motion) : control.motion;
  return {
    heading: direction,
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

// Sets a lock that starts when the pack stops, as a pull's does; a still pack locks at once.
// A longer lock already waiting is kept.
export function lockOnArrival(seconds: number, control: LaneControl): LaneControl {
  if (control.motion.kind === "still") {
    return lockSteering(seconds, control);
  }
  return { ...control, lockOnArrival: startLock(seconds, control.lockOnArrival ?? 0) };
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
        ...headingOf(control),
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
    ...headingOf(control),
    lockSeconds: Math.max(0, lockSeconds - secondsLeft),
    motion,
    target: control.target,
  };
}
