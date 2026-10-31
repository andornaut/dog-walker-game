import { clampIndex } from "@andornaut/game-kit/arrays";

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
// one, so a quick drag across three lanes ends three lanes over. heading is the way the
// target last moved, absent before it has.
export interface LaneControl {
  heading?: LaneDirection;
  // Present only while a manually requested lane movement is active.
  manualDirection?: LaneDirection;
  motion: LaneMotion;
  target: number;
}

export function laneControlIn(motion: LaneMotion): LaneControl {
  return { motion, target: destinationLane(motion) };
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

// The player's lane change moves the target one lane, held on the road.
export function steerLane(
  config: LaneMotionConfig,
  direction: LaneDirection,
  control: LaneControl,
): LaneControl {
  const target = clampIndex(config.laneCount, control.target + direction);
  if (target === control.target) {
    return control;
  }
  return {
    ...control,
    heading: direction,
    manualDirection: direction,
    motion: headFor(config, target, control.motion),
    target,
  };
}

// A dog's pull moves the target one lane past the lane the pack is in or heading to, held on
// the road.
export function pullLane(
  config: LaneMotionConfig,
  direction: LaneDirection,
  control: LaneControl,
): LaneControl {
  const from = destinationLane(control.motion);
  const target = clampIndex(config.laneCount, from + direction);
  if (target === from && control.motion.kind === "still") {
    return { ...headingOf(control), motion: control.motion, target };
  }
  const motion =
    control.motion.kind === "still" ? headFor(config, target, control.motion) : control.motion;
  return { heading: direction, motion, target };
}

// Steps from arrival to arrival. Arriving short of the target, the pack sets off for the next
// lane.
export function advanceLaneControl(
  config: LaneMotionConfig,
  stepSeconds: number,
  control: LaneControl,
): LaneControl {
  let { motion } = control;
  let secondsLeft = stepSeconds;
  while (motion.kind === "moving") {
    const toArrival = motion.duration - motion.elapsed;
    if (secondsLeft < toArrival) {
      return {
        ...control,
        motion: { ...motion, elapsed: motion.elapsed + secondsLeft },
        target: control.target,
      };
    }
    secondsLeft -= toArrival;
    motion = headFor(config, control.target, stillInLane(motion.to));
  }
  return { ...headingOf(control), motion, target: control.target };
}
