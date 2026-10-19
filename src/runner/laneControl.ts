import type { LaneDirection } from "../layout/lanes";
import {
  type LaneMotion,
  type LaneMotionConfig,
  queueLaneMove,
  requestLaneMove,
  stillInLane,
} from "./laneMotion";

// lockSeconds is how long player steering is still ignored after a pull. A pull's lock
// waits for its lane move to end: lockAfterMove belongs to the move in progress, and
// lockAfterQueuedMove to the queued one.
export interface LaneControl {
  lockAfterMove?: number;
  lockAfterQueuedMove?: number;
  lockSeconds: number;
  motion: LaneMotion;
}

export function laneControlIn(motion: LaneMotion): LaneControl {
  return { lockSeconds: 0, motion };
}

export function isSteeringLocked(control: LaneControl): boolean {
  return control.lockSeconds > 0;
}

// A longer lock already running is kept.
function startLock(seconds: number | undefined, runningSeconds: number): number {
  return Math.max(runningSeconds, seconds ?? 0);
}

// The lock waiting on a move, or no field at all when there is none.
function lockAfter(seconds: number | undefined): Pick<LaneControl, "lockAfterMove"> {
  return seconds === undefined ? {} : { lockAfterMove: seconds };
}

// The player's lane change, ignored while a pull's lock lasts. A reverse press turns the
// pack around, and a pull it turns around still locks once the pack arrives back. Any
// other press replaces the queued move, so a queued pull is dropped with its lock.
export function steerLane(
  config: LaneMotionConfig,
  direction: LaneDirection,
  control: LaneControl,
): LaneControl {
  if (isSteeringLocked(control)) {
    return control;
  }
  const motion = requestLaneMove(config, direction, control.motion);
  if (motion.kind === "still" && control.motion.kind === "moving") {
    return { lockSeconds: startLock(control.lockAfterMove, control.lockSeconds), motion };
  }
  const { lockAfterMove, lockSeconds } = control;
  return motion.kind === "moving" && control.motion.kind === "moving"
    ? { ...lockAfter(lockAfterMove), lockSeconds, motion }
    : { lockSeconds, motion };
}

// A dog's pull is never blocked by the lock, and mid-move it replaces any queued move.
// Its lock starts when its own lane move ends.
export function pullLane(
  config: LaneMotionConfig,
  lockSeconds: number,
  direction: LaneDirection,
  control: LaneControl,
): LaneControl {
  const motion = queueLaneMove(config, direction, control.motion);
  if (control.motion.kind === "moving") {
    return { ...control, lockAfterQueuedMove: lockSeconds, motion };
  }
  if (motion.kind === "still") {
    return { lockSeconds: startLock(lockSeconds, control.lockSeconds), motion };
  }
  return { lockAfterMove: lockSeconds, lockSeconds: control.lockSeconds, motion };
}

// Steps from arrival to arrival, so a lock starts at the moment its move ends and the
// time left over counts it down.
export function advanceLaneControl(
  config: LaneMotionConfig,
  stepSeconds: number,
  control: LaneControl,
): LaneControl {
  let current = control;
  let secondsLeft = stepSeconds;
  while (current.motion.kind === "moving") {
    const { motion } = current;
    const toArrival = motion.duration - motion.elapsed;
    if (secondsLeft < toArrival) {
      return {
        ...current,
        lockSeconds: Math.max(0, current.lockSeconds - secondsLeft),
        motion: { ...motion, elapsed: motion.elapsed + secondsLeft },
      };
    }
    secondsLeft -= toArrival;
    const running = Math.max(0, current.lockSeconds - toArrival);
    const lockSeconds = startLock(current.lockAfterMove, running);
    if (motion.queued === undefined) {
      current = { lockSeconds, motion: stillInLane(motion.to) };
      break;
    }
    const next = queueLaneMove(config, motion.queued, stillInLane(motion.to));
    current =
      next.kind === "moving"
        ? { ...lockAfter(current.lockAfterQueuedMove), lockSeconds, motion: next }
        : { lockSeconds: startLock(current.lockAfterQueuedMove, lockSeconds), motion: next };
  }
  return { ...current, lockSeconds: Math.max(0, current.lockSeconds - secondsLeft) };
}
