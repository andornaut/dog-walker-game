import type { GameData } from "../data/types";
import type { LaneDirection } from "../layout/lanes";
import { read } from "../rules/units";
import { SECONDS_EPSILON } from "./fixedStep";
import { laneBlockedWithin, type PullGeometry, pullHorizon } from "./pulls";
import { steerWalk, type Walk, walkScrollSpeed } from "./walk";

// While the pack has the Zoomies, every seconds.zoomiesDriftSeconds of walking it drifts one
// lane in the direction it last moved, toward the right before it has moved. Steering still
// works. A drift never moves the pack into an obstacle it can't react to, by the pulls' rule:
// with that lane blocked, or past the road's edge, it turns and drifts the other way, and with
// both closed it stays. The walk's own state and the seed decide every drift, so a replay
// drifts alike.

export type ZoomiesData = Pick<
  GameData,
  "debuffs" | "dogs" | "encounters" | "minorObstacles" | "tuning" | "walkers" | "world"
>;

// seconds is the walking time since the last drift, or since the Zoomies began. drifted is the
// way the pack drifted this step, or null.
interface ZoomiesStep {
  readonly drifted: LaneDirection | null;
  readonly seconds: number;
  readonly walk: Walk;
}

export function hasZoomies(walk: Walk): boolean {
  return walk.run.debuffs.some(({ debuff }) => debuff === "zoomies");
}

// The way the pack drifts from its target lane: its heading, else the other way, or null when
// it stays.
function driftDirection(
  data: ZoomiesData,
  geometry: PullGeometry,
  walk: Walk,
): LaneDirection | null {
  const { control } = walk.road;
  const heading = control.heading ?? 1;
  const speed = walkScrollSpeed(data, walk.run) * walk.road.speedFactor;
  const horizon = pullHorizon(data, walk);
  const open = (direction: LaneDirection) => {
    const lane = control.target + direction;
    return (
      lane >= 0 &&
      lane < geometry.laneCount &&
      !laneBlockedWithin(data, geometry, speed, horizon, lane, walk)
    );
  };
  if (open(heading)) {
    return heading;
  }
  const back: LaneDirection = heading === 1 ? -1 : 1;
  return open(back) ? back : null;
}

// One step of the Zoomies clock: with the debuff on and the walk walking with no hit stop, the
// clock runs, and each time it reaches zoomiesDriftSeconds the pack drifts a lane. Without
// the debuff the clock rests at 0.
export function stepZoomies(
  data: ZoomiesData,
  geometry: PullGeometry,
  stepSeconds: number,
  seconds: number,
  walk: Walk,
): ZoomiesStep {
  if (!hasZoomies(walk)) {
    return { drifted: null, seconds: 0, walk };
  }
  if (walk.run.phase.kind !== "walking" || walk.road.hitStop !== null) {
    return { drifted: null, seconds, walk };
  }
  const every = read(data.tuning, "seconds", "zoomiesDriftSeconds");
  const elapsed = seconds + stepSeconds;
  if (elapsed < every - SECONDS_EPSILON) {
    return { drifted: null, seconds: elapsed, walk };
  }
  const direction = driftDirection(data, geometry, walk);
  if (direction === null) {
    return { drifted: null, seconds: elapsed - every, walk };
  }
  return {
    drifted: direction,
    seconds: elapsed - every,
    walk: steerWalk(data, geometry.laneCount, direction, walk),
  };
}
