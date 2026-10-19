import type { DogId, GameData } from "../data/types";
import type { LaneDirection } from "../layout/lanes";
import { modifiedStat } from "../rules/modifiers";
import { read } from "../rules/units";
import { packDogs } from "../state/pack";
import { destinationLane } from "./laneMotion";
import { laneAt, moverPlace } from "./movers";
import { type PullEvent, type PullPose, pullWalk } from "./pulls";
import type { Walk } from "./walk";

// Chasers pull the pack toward a squirrel on the road: once its cue shows, the pack's first
// chaser leans for pullTell, then pulls one lane toward it as soon as it is moving and in
// another lane. chaserSquirrelPulls modifiers, such as Good leash, scale the pulls each
// squirrel draws from one; after each pull but the last, the chaser leans again.
export interface SquirrelChase {
  readonly direction: LaneDirection;
  readonly dog: DogId;
  readonly itemId: number;
  readonly pullsLeft: number;
  readonly tellSeconds: number;
}

export interface ChaseStep {
  readonly pulled: readonly PullEvent[];
  // The chaser whose tell started this step, toward the side it leans.
  readonly tells: readonly { readonly direction: LaneDirection; readonly dog: DogId }[];
  readonly walk: Walk;
}

const NOTHING: Omit<ChaseStep, "walk"> = { pulled: [], tells: [] };

function withChase(chase: SquirrelChase | null, walk: Walk): Walk {
  return walk.road.chase === chase ? walk : { ...walk, road: { ...walk.road, chase } };
}

// Like a dog's own pulls, the chase stands still unless the walk is walking with no hit stop.
export function stepChase(
  data: Pick<GameData, "dogs" | "tuning">,
  laneCount: number,
  stepSeconds: number,
  walk: Walk,
): ChaseStep {
  const { road, run } = walk;
  if (run.phase.kind !== "walking" || road.hitStop !== null) {
    return { ...NOTHING, walk };
  }
  const chaser = packDogs(run).find((dog) => data.dogs[dog].trait === "chaser");
  const pulls = Math.round(modifiedStat(data.tuning, run.modifiers, "chaserSquirrelPulls", 1));
  const squirrel = road.items.find((item) => item.kind === "squirrel" && item.mover !== undefined);
  if (chaser === undefined || pulls < 1 || squirrel?.mover === undefined) {
    return { ...NOTHING, walk: withChase(null, walk) };
  }
  const place = moverPlace(laneCount, squirrel.mover.path, squirrel.mover.since);
  const lane = destinationLane(road.control.motion);
  const direction: LaneDirection = place.lanePosition < lane ? -1 : 1;
  const tell = read(data.tuning, "seconds", "pullTell");
  const started = road.chase === null || road.chase.itemId !== squirrel.id;
  const current =
    road.chase === null || started
      ? { dog: chaser, itemId: squirrel.id, pullsLeft: pulls, tellSeconds: tell }
      : road.chase;
  const leaned = {
    ...current,
    direction,
    tellSeconds: Math.max(0, current.tellSeconds - stepSeconds),
  };
  const tells = started ? [{ direction, dog: leaned.dog }] : [];
  if (
    leaned.pullsLeft === 0 ||
    leaned.tellSeconds > 0 ||
    !place.moving ||
    laneAt(place.lanePosition) === lane
  ) {
    return { pulled: [], tells, walk: withChase(leaned, walk) };
  }
  const pull = pullWalk(data, laneCount, leaned.dog, direction, walk);
  const pullsLeft = leaned.pullsLeft - 1;
  return {
    pulled: [{ direction, dog: leaned.dog, moved: pull.moved }],
    tells: pullsLeft > 0 ? [...tells, { direction, dog: leaned.dog }] : tells,
    walk: withChase({ ...leaned, pullsLeft, tellSeconds: tell }, pull.walk),
  };
}

// The chaser's tell while it leans toward a squirrel.
export function chasePose(chase: SquirrelChase | null, dog: DogId): PullPose | null {
  return chase !== null && chase.dog === dog && chase.pullsLeft > 0 && chase.tellSeconds > 0
    ? { direction: chase.direction, tag: "tell" }
    : null;
}
