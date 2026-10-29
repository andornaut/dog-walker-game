import { itemAt } from "@andornaut/game-kit/arrays";

import { type LaneDirection, moveLane } from "../layout/lanes";

// moveDuration is in seconds, the time one lane change takes.
export interface LaneMotionConfig {
  laneCount: number;
  moveDuration: number;
}

// Moving: elapsed and duration in seconds.
export type LaneMotion =
  | { kind: "still"; lane: number }
  | { duration: number; elapsed: number; from: number; kind: "moving"; to: number };
export type MovingLaneMotion = Extract<LaneMotion, { kind: "moving" }>;

export function stillInLane(lane: number): LaneMotion {
  return { kind: "still", lane };
}

// A move off the road edge leaves the pack where it is.
export function startMove(
  config: LaneMotionConfig,
  direction: LaneDirection,
  lane: number,
): LaneMotion {
  const to = moveLane(config.laneCount, direction, lane);
  if (to === lane || config.moveDuration <= 0) {
    return stillInLane(to);
  }
  return { duration: config.moveDuration, elapsed: 0, from: lane, kind: "moving", to };
}

// Turns the pack around at once, from where it is.
export function turnAround(motion: MovingLaneMotion): LaneMotion {
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
