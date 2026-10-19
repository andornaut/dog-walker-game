import { itemAt } from "../arrays";
import { type LaneDirection, moveLane } from "../layout/lanes";

// moveDuration is in seconds, the time one lane change takes.
export interface LaneMotionConfig {
  laneCount: number;
  moveDuration: number;
}

// Moving: elapsed and duration in seconds. queued is the one move waiting to start on arrival.
export type LaneMotion =
  | { kind: "still"; lane: number }
  | {
      duration: number;
      elapsed: number;
      from: number;
      kind: "moving";
      queued?: LaneDirection;
      to: number;
    };

export function stillInLane(lane: number): LaneMotion {
  return { kind: "still", lane };
}

// A move off the road edge leaves the pack where it is.
function startMove(config: LaneMotionConfig, direction: LaneDirection, lane: number): LaneMotion {
  const to = moveLane(config.laneCount, direction, lane);
  if (to === lane || config.moveDuration <= 0) {
    return stillInLane(to);
  }
  return { duration: config.moveDuration, elapsed: 0, from: lane, kind: "moving", to };
}

// While moving, the move is queued one deep: a later request replaces an earlier one.
export function queueLaneMove(
  config: LaneMotionConfig,
  direction: LaneDirection,
  motion: LaneMotion,
): LaneMotion {
  if (motion.kind === "still") {
    return startMove(config, direction, motion.lane);
  }
  return { ...motion, queued: direction };
}

export function isReverseMove(direction: LaneDirection, motion: LaneMotion): boolean {
  return motion.kind === "moving" && Math.sign(motion.to - motion.from) === -direction;
}

// The player's press. One against the current move turns the pack around at once, from
// where it is, and drops any queued move. Any other press queues like queueLaneMove.
export function requestLaneMove(
  config: LaneMotionConfig,
  direction: LaneDirection,
  motion: LaneMotion,
): LaneMotion {
  if (motion.kind === "still" || !isReverseMove(direction, motion)) {
    return queueLaneMove(config, direction, motion);
  }
  if (motion.elapsed <= 0) {
    return stillInLane(motion.from);
  }
  return {
    duration: motion.duration,
    elapsed: motion.duration - motion.elapsed,
    from: motion.to,
    kind: "moving",
    to: motion.from,
  };
}

// Time left over after arriving carries into the queued move, so the result does not
// depend on how the time is split into steps.
export function advanceLaneMotion(
  config: LaneMotionConfig,
  stepSeconds: number,
  motion: LaneMotion,
): LaneMotion {
  if (motion.kind === "still") {
    return motion;
  }
  const elapsed = motion.elapsed + stepSeconds;
  if (elapsed < motion.duration) {
    return { ...motion, elapsed };
  }
  if (motion.queued === undefined) {
    return stillInLane(motion.to);
  }
  const next = startMove(config, motion.queued, motion.to);
  return advanceLaneMotion(config, elapsed - motion.duration, next);
}

// Mid-move the pack spans both lanes, so it can hit things in either.
export function occupiedLanes(motion: LaneMotion): number[] {
  return motion.kind === "still" ? [motion.lane] : [motion.from, motion.to];
}

// The lane the pack is in, or heading to.
export function destinationLane(motion: LaneMotion): number {
  return motion.kind === "still" ? motion.lane : motion.to;
}

// Linear between the two lane centres.
export function laneMotionX(laneXs: readonly number[], motion: LaneMotion): number {
  if (motion.kind === "still") {
    return itemAt(laneXs, motion.lane);
  }
  const progress = Math.min(1, motion.elapsed / motion.duration);
  const fromX = itemAt(laneXs, motion.from);
  return fromX + (itemAt(laneXs, motion.to) - fromX) * progress;
}
