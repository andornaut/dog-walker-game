import type { DogId, GameData } from "../data/types";
import { type GestureState, reanchorDrag } from "../input/gestures";
import type { LaneDirection } from "../layout/lanes";
import { inputLockSeconds, pullIntervalSeconds } from "../rules/dogs";
import { read } from "../rules/units";
import { packDogs } from "../state/pack";
import { pullLane } from "./laneControl";
import { destinationLane } from "./laneMotion";
import type { Random } from "./random";
import { laneMotionConfig, type RoadGeometry, type Walk } from "./walk";

export type PullData = Pick<GameData, "dogs" | "tuning">;

// A dog's next pull, at clock time `at`. lean is the side it leans toward once its tell has
// started, and pulled the clock time and side of its last pull.
export interface DogPull {
  readonly at: number;
  readonly dog: DogId;
  readonly lean: LaneDirection | null;
  readonly pulled: { readonly at: number; readonly direction: LaneDirection } | null;
}

// clock is the seconds the walk has moved; it stands still through hit stops, cards and
// pauses, so no dog tells or pulls during them.
export interface Pulls {
  readonly clock: number;
  readonly dogs: readonly DogPull[];
}

export const NO_PULLS: Pulls = { clock: 0, dogs: [] };

// moved is false for a pull the road edge blocked.
export interface PullEvent {
  readonly direction: LaneDirection;
  readonly dog: DogId;
  readonly moved: boolean;
}

export interface PullStep {
  readonly pulled: readonly PullEvent[];
  readonly pulls: Pulls;
  // The dogs whose tell started this step, toward the side they will pull.
  readonly tells: readonly { readonly direction: LaneDirection; readonly dog: DogId }[];
  readonly walk: Walk;
}

// What a dog shows: its tell lean before a pull, then its pull lean for one lane move.
export interface PullPose {
  readonly direction: LaneDirection;
  readonly tag: "pull" | "tell";
}

// A lane change caused by a dog: one lane toward direction, held on the road, then lane input
// locks for the dog's lock. Dropped during a hit stop, as steering is.
export function pullWalk(
  data: PullData,
  laneCount: number,
  dog: DogId,
  direction: LaneDirection,
  walk: Walk,
): { readonly moved: boolean; readonly walk: Walk } {
  const { road, run } = walk;
  if (road.hitStop !== null) {
    return { moved: false, walk };
  }
  const lock = inputLockSeconds(data.tuning, run.modifiers, data.dogs[dog]);
  const control = pullLane(laneMotionConfig(data, laneCount), lock, direction, road.control);
  return {
    moved: control.target !== road.control.target,
    walk: { ...walk, road: { ...road, control } },
  };
}

// The lane of the treat nearest ahead of the pack, for a food-driven dog.
function treatLane(geometry: Pick<RoadGeometry, "packBand">, walk: Walk): number | undefined {
  const ahead = walk.road.items.filter(
    (item) => item.kind === "treat" && item.y < geometry.packBand.top,
  );
  const nearest = ahead.reduce<(typeof ahead)[number] | undefined>(
    (best, item) => (best === undefined || item.y > best.y ? item : best),
    undefined,
  );
  return nearest?.lane;
}

// Toward the dog's trait target when it has one off the pack's lane, otherwise toward the
// random side. The side is drawn either way, so the stream's draws do not depend on the road.
function pullDirection(
  data: PullData,
  geometry: Pick<RoadGeometry, "packBand">,
  random: Random,
  dog: DogId,
  walk: Walk,
): LaneDirection {
  const side: LaneDirection = random() < 0.5 ? -1 : 1;
  const target = data.dogs[dog].trait === "foodDriven" ? treatLane(geometry, walk) : undefined;
  const lane = destinationLane(walk.road.control.motion);
  if (target === undefined || target === lane) {
    return side;
  }
  return target < lane ? -1 : 1;
}

// A dog's first pull comes at a random point of its first interval, after a whole tell, so
// the pack's dogs do not pull in step.
function firstPull(data: PullData, random: Random, clock: number, dog: DogId, walk: Walk): DogPull {
  const interval = pullIntervalSeconds(data.tuning, walk.run.modifiers, data.dogs[dog]);
  const tell = read(data.tuning, "seconds", "pullTell");
  return { at: clock + tell + random() * interval, dog, lean: null, pulled: null };
}

// One step of the pull clock: each walking dog leans and barks pullTell seconds before its
// pull, then pulls toward the side it leaned and schedules its next pull one interval later.
// Fired dogs drop out. Nothing moves unless the walk is walking with no hit stop.
export function stepPulls(
  data: PullData,
  geometry: Pick<RoadGeometry, "laneCount" | "packBand">,
  random: Random,
  stepSeconds: number,
  pulls: Pulls,
  walk: Walk,
): PullStep {
  if (walk.run.phase.kind !== "walking" || walk.road.hitStop !== null) {
    return { pulled: [], pulls, tells: [], walk };
  }
  const clock = pulls.clock + stepSeconds;
  const tell = read(data.tuning, "seconds", "pullTell");
  const pulled: PullEvent[] = [];
  const tells: { direction: LaneDirection; dog: DogId }[] = [];
  let current = walk;
  const dogs = packDogs(walk.run).map((dog): DogPull => {
    let state = pulls.dogs.find((candidate) => candidate.dog === dog);
    state ??= firstPull(data, random, pulls.clock, dog, walk);
    if (state.lean === null && clock >= state.at - tell) {
      const direction = pullDirection(data, geometry, random, dog, current);
      tells.push({ direction, dog });
      state = { ...state, lean: direction };
    }
    if (state.lean === null || clock < state.at) {
      return state;
    }
    const pull = pullWalk(data, geometry.laneCount, dog, state.lean, current);
    current = pull.walk;
    pulled.push({ direction: state.lean, dog, moved: pull.moved });
    const interval = pullIntervalSeconds(data.tuning, walk.run.modifiers, data.dogs[dog]);
    return {
      at: state.at + interval,
      dog,
      lean: null,
      pulled: { at: clock, direction: state.lean },
    };
  });
  return { pulled, pulls: { clock, dogs }, tells, walk: current };
}

// The dog's tell while it leans, then its pull pose for one lane move after the pull.
export function pullPose(data: PullData, pulls: Pulls, dog: DogId): PullPose | null {
  const state = pulls.dogs.find((candidate) => candidate.dog === dog);
  if (state === undefined) {
    return null;
  }
  if (state.lean !== null) {
    return { direction: state.lean, tag: "tell" };
  }
  const last = state.pulled;
  return last !== null && pulls.clock - last.at < read(data.tuning, "seconds", "laneMove")
    ? { direction: last.direction, tag: "pull" }
    : null;
}

// A pull that moved the pack re-anchors a drag at the pointer, so getting back takes another
// lane-width of drag.
export function gestureAfterPulls(
  pulled: readonly PullEvent[],
  gesture: GestureState,
): GestureState {
  return pulled.some((pull) => pull.moved) ? reanchorDrag(gesture) : gesture;
}
