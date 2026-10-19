import type { DogId, GameData } from "../data/types";
import { type GestureState, reanchorDrag } from "../input/gestures";
import type { LaneDirection } from "../layout/lanes";
import { inputLockSeconds } from "../rules/dogs";
import { modifiedStat } from "../rules/modifiers";
import { read } from "../rules/units";
import { packDogs } from "../state/pack";
import { pullLane } from "./laneControl";
import { destinationLane } from "./laneMotion";
import { laneAt, moverPlace } from "./movers";
import { isNeedUrgent, isOtherDog, needSpotOf, spotMeets } from "./needs";
import {
  blocksLane,
  laneMotionConfig,
  laneMoveSeconds,
  type RoadGeometry,
  type Walk,
  type WalkItem,
  walkScrollSpeed,
} from "./walk";

// A dog pulls only toward something it wants on the road: a treat for a food-driven dog, a
// squirrel for the pack's first chaser, another dog for a nervous dog, or a spot that meets
// its need once the need is urgent. One dog strains at a time: pullTell seconds with its
// bubble, an arrow and a line to the target, then the pack lurches one lane toward it. Each
// target draws its pulls once.

export type PullData = Pick<
  GameData,
  "debuffs" | "dogs" | "encounters" | "minorObstacles" | "needSpots" | "tuning" | "world"
>;
export type PullGeometry = Pick<RoadGeometry, "laneCount" | "packBand" | "roadTop">;

export type PullTargetKind = "need" | "otherDog" | "squirrel" | "treat";

// The dog straining toward a target on the road, toward direction, with tellSeconds of its
// tell to go. pullsLeft is the pulls the target still draws. blocked is set while the lane it
// would pull into has an obstacle too close to react to: the dog strains on, and pulls once
// the lane clears.
export interface Strain {
  readonly blocked: boolean;
  readonly direction: LaneDirection;
  readonly dog: DogId;
  readonly itemId: number;
  readonly kind: PullTargetKind;
  readonly pullsLeft: number;
  readonly tellSeconds: number;
}

// A pull at clock time at, toward a target of kind.
export interface LastPull {
  readonly at: number;
  readonly direction: LaneDirection;
  readonly dog: DogId;
  readonly kind: PullTargetKind;
}

// clock is the seconds the walk has moved; it stands still through hit stops, cards and
// pauses, so no dog strains or pulls during them. spent is the targets still on the road
// whose pulls are used up.
export interface Pulls {
  readonly clock: number;
  readonly last: LastPull | null;
  readonly spent: readonly number[];
  readonly strain: Strain | null;
}

export const NO_PULLS: Pulls = { clock: 0, last: null, spent: [], strain: null };

// moved is false for a pull dropped during a hit stop.
export interface PullEvent {
  readonly direction: LaneDirection;
  readonly dog: DogId;
  readonly moved: boolean;
}

// A dog that started straining this step, or whose strain was blocked, toward the side it
// will pull.
export interface PullTell {
  readonly direction: LaneDirection;
  readonly dog: DogId;
  readonly kind: PullTargetKind;
}

// blocked is the strains blocked this step; failed the dogs whose blocked strain ended without
// a pull.
export interface PullStep {
  readonly blocked: readonly PullTell[];
  readonly failed: readonly DogId[];
  readonly pulled: readonly PullEvent[];
  readonly pulls: Pulls;
  readonly tells: readonly PullTell[];
  readonly walk: Walk;
}

// The pose a quirk shows in place of the tell or pull: a nervous dog's lunge while she strains
// toward another dog, an acrobatic dog's flourish after any pull.
export type QuirkPullTag = "flourish" | "lunge";

// What a dog shows: its tell while it strains, then its pull lean for one lane move after a
// pull, or its quirk's pose where it has one.
export interface PullPose {
  readonly direction: LaneDirection;
  readonly quirkTag?: QuirkPullTag;
  readonly tag: "pull" | "tell";
}

// A lane change caused by a dog: one lane toward direction, held on the road, then lane input
// locks for the dog's lock. Dropped during a hit stop, as steering is.
export function pullWalk(
  data: Pick<GameData, "debuffs" | "dogs" | "tuning">,
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
  const config = laneMotionConfig(data, laneCount, run);
  const control = pullLane(config, lock, direction, road.control);
  return {
    moved: control.target !== road.control.target,
    walk: { ...walk, road: { ...road, control } },
  };
}

// A target where it is now: its lane position, whether it is ready to be pulled toward (a
// darting squirrel only while it moves) and how near the pack it is.
interface Target {
  readonly itemId: number;
  readonly kind: PullTargetKind;
  readonly lanePosition: number;
  readonly ready: boolean;
  readonly y: number;
}

// A darting squirrel is a target from when its cue shows, in any lane; anything else while
// it is wholly ahead of the pack and off the pack's lane.
function targetOf(
  geometry: PullGeometry,
  lane: number,
  kind: PullTargetKind,
  item: WalkItem,
): Target | null {
  if (item.mover !== undefined) {
    const place = moverPlace(geometry.laneCount, item.mover.path, item.mover.since);
    return {
      itemId: item.id,
      kind,
      lanePosition: place.lanePosition,
      ready: place.moving,
      y: item.y,
    };
  }
  const ahead = item.y + item.height <= geometry.packBand.top;
  return ahead && item.lane !== lane
    ? { itemId: item.id, kind, lanePosition: item.lane, ready: true, y: item.y }
    : null;
}

// How many pulls a squirrel draws from the pack's first chaser: chaserSquirrelPulls
// modifiers, such as Good leash, scale its one pull.
function squirrelPulls(data: PullData, walk: Walk): number {
  return Math.round(modifiedStat(data.tuning, walk.run.modifiers, "chaserSquirrelPulls", 1));
}

// What the item is to the dog, if the dog wants it.
function wantOf(
  data: PullData,
  dog: DogId,
  chaser: DogId | undefined,
  walk: Walk,
  item: WalkItem,
): PullTargetKind | null {
  const { quirk, trait } = data.dogs[dog];
  if (item.kind === "treat") {
    return trait === "foodDriven" ? "treat" : null;
  }
  if (item.kind === "squirrel") {
    return dog === chaser && squirrelPulls(data, walk) >= 1 ? "squirrel" : null;
  }
  if (quirk === "nervous" && isOtherDog(data, item.kind)) {
    return "otherDog";
  }
  const spot = needSpotOf(data, item.kind);
  return spot !== null && spotMeets(data, spot, dog) && isNeedUrgent(data, walk.run, dog)
    ? "need"
    : null;
}

// The nearest target the dog wants that has not drawn its pulls.
function nearestTarget(
  data: PullData,
  geometry: PullGeometry,
  spent: readonly number[],
  dog: DogId,
  walk: Walk,
): Target | null {
  const lane = destinationLane(walk.road.control.motion);
  const chaser = packDogs(walk.run).find((candidate) => data.dogs[candidate].trait === "chaser");
  let nearest: Target | null = null;
  for (const item of walk.road.items) {
    const kind = spent.includes(item.id) ? null : wantOf(data, dog, chaser, walk, item);
    const target = kind === null ? null : targetOf(geometry, lane, kind, item);
    if (target !== null && (nearest === null || target.y > nearest.y)) {
      nearest = target;
    }
  }
  return nearest;
}

// The strained-for target where it is now, or null once it has gone, passed the pack or, if
// it does not move, been reached.
function currentTarget(
  data: PullData,
  geometry: PullGeometry,
  strain: Strain,
  walk: Walk,
): Target | null {
  const item = walk.road.items.find(({ id }) => id === strain.itemId);
  if (item === undefined || !walk.run.pack.some(({ dog }) => dog === strain.dog)) {
    return null;
  }
  return targetOf(geometry, destinationLane(walk.road.control.motion), strain.kind, item);
}

// Samples of a mover's path over the reaction horizon.
const SWEEP_SAMPLES = 24;

// Whether something the pack must steer around reaches the pack in lane within horizon
// seconds: an obstacle in the lane, or a mover in it at any moment of its sweep.
export function laneBlockedWithin(
  data: Pick<GameData, "encounters" | "minorObstacles" | "needSpots">,
  geometry: PullGeometry,
  speed: number,
  horizon: number,
  lane: number,
  walk: Walk,
): boolean {
  const { bottom, top } = geometry.packBand;
  return walk.road.items.some((item) => {
    if (!blocksLane(data, item.kind)) {
      return false;
    }
    const { mover } = item;
    if (mover === undefined) {
      const inLane = lane >= item.lane && lane < item.lane + item.laneSpan;
      const start = (top - (item.y + item.height)) / speed;
      const end = (bottom - item.y) / speed;
      return inLane && end > 0 && start < horizon;
    }
    for (let sample = 0; sample <= SWEEP_SAMPLES; sample++) {
      const scroll = (sample / SWEEP_SAMPLES) * horizon * speed;
      const place = moverPlace(geometry.laneCount, mover.path, mover.since + scroll);
      const y = geometry.roadTop - item.height + place.travel;
      const touches = y + item.height > top && y < bottom;
      if (place.moving && touches && laneAt(place.lanePosition) === lane) {
        return true;
      }
    }
    return false;
  });
}

// The time a pull must leave before an obstacle reaches the pack in its new lane: the pull's
// lane move, the dog's input lock, the reaction window and a lane move back out.
export function pullHorizon(
  data: Pick<GameData, "debuffs" | "dogs" | "tuning">,
  dog: DogId,
  walk: Walk,
): number {
  const move = laneMoveSeconds(data, walk.run);
  const lock = inputLockSeconds(data.tuning, walk.run.modifiers, data.dogs[dog]);
  return move + lock + read(data.tuning, "seconds", "pullReactionWindow") + move;
}

// Whether the lane a strain would pull into has an obstacle too close to react to.
function pullBlocked(data: PullData, geometry: PullGeometry, strain: Strain, walk: Walk): boolean {
  const lane = destinationLane(walk.road.control.motion) + strain.direction;
  const speed = walkScrollSpeed(data, walk.run) * walk.road.speedFactor;
  const horizon = pullHorizon(data, strain.dog, walk);
  return laneBlockedWithin(data, geometry, speed, horizon, lane, walk);
}

const NOTHING = { blocked: [], failed: [], pulled: [], tells: [] } as const;

// One step of the pull clock. With no dog straining, the first dog in pack order that wants
// a target starts its tell: a squirrel draws squirrelPulls pulls, anything else one. A strain
// whose target has gone, passed or been reached ends. Once the tell has run, and a darting
// squirrel or loose dog moves and is off the pack's lane, the dog pulls one lane toward the
// target, unless the fairness rule blocks the pull: then it strains on until the lane clears or
// the strain ends. A target with pulls left starts the tell again. Nothing moves unless the
// walk is walking with no hit stop.
export function stepPulls(
  data: PullData,
  geometry: PullGeometry,
  stepSeconds: number,
  pulls: Pulls,
  walk: Walk,
): PullStep {
  if (walk.run.phase.kind !== "walking" || walk.road.hitStop !== null) {
    return { ...NOTHING, pulls, walk };
  }
  const clock = pulls.clock + stepSeconds;
  const onRoad = new Set(walk.road.items.map(({ id }) => id));
  let spent = pulls.spent.filter((id) => onRoad.has(id));
  const tell = read(data.tuning, "seconds", "pullTell");
  const lane = destinationLane(walk.road.control.motion);
  const side = (target: Target): LaneDirection => (target.lanePosition < lane ? -1 : 1);

  let strain = pulls.strain;
  let target = strain === null ? null : currentTarget(data, geometry, strain, walk);
  const failed: DogId[] = [];
  if (strain !== null && target === null) {
    if (strain.blocked) {
      failed.push(strain.dog);
    }
    spent = [...spent, strain.itemId];
    strain = null;
  }
  if (strain === null || target === null) {
    for (const dog of packDogs(walk.run)) {
      target = nearestTarget(data, geometry, spent, dog, walk);
      if (target !== null) {
        strain = {
          blocked: false,
          direction: side(target),
          dog,
          itemId: target.itemId,
          kind: target.kind,
          pullsLeft: target.kind === "squirrel" ? squirrelPulls(data, walk) : 1,
          tellSeconds: tell,
        };
        const started: PullTell = { direction: strain.direction, dog, kind: target.kind };
        const next = { ...pulls, clock, spent, strain };
        return { ...NOTHING, failed, pulls: next, tells: [started], walk };
      }
    }
    return { ...NOTHING, failed, pulls: { ...pulls, clock, spent, strain: null }, walk };
  }

  const leaned: Strain = {
    ...strain,
    direction: side(target),
    tellSeconds: Math.max(0, strain.tellSeconds - stepSeconds),
  };
  if (leaned.tellSeconds > 0 || !target.ready || laneAt(target.lanePosition) === lane) {
    return { ...NOTHING, pulls: { ...pulls, clock, spent, strain: leaned }, walk };
  }
  if (pullBlocked(data, geometry, leaned, walk)) {
    const { direction, dog, kind } = leaned;
    return {
      ...NOTHING,
      blocked: leaned.blocked ? [] : [{ direction, dog, kind }],
      pulls: { ...pulls, clock, spent, strain: { ...leaned, blocked: true } },
      walk,
    };
  }
  const { direction, dog } = leaned;
  const pull = pullWalk(data, geometry.laneCount, dog, direction, walk);
  const pullsLeft = leaned.pullsLeft - 1;
  const again = pullsLeft > 0 ? { ...leaned, blocked: false, pullsLeft, tellSeconds: tell } : null;
  return {
    ...NOTHING,
    pulled: [{ direction, dog, moved: pull.moved }],
    pulls: {
      clock,
      last: { at: clock, direction, dog, kind: leaned.kind },
      spent: again === null ? [...spent, leaned.itemId] : spent,
      strain: again,
    },
    tells: again === null ? [] : [{ direction: again.direction, dog, kind: again.kind }],
    walk: pull.walk,
  };
}

// The dog's tell while it strains, then its pull pose for one lane move after a pull. A
// nervous dog straining toward another dog lunges, and an acrobatic dog flourishes after its
// pull.
export function pullPose(
  data: Pick<GameData, "dogs" | "tuning">,
  pulls: Pulls,
  dog: DogId,
): PullPose | null {
  const { last, strain } = pulls;
  const { quirk } = data.dogs[dog];
  if (strain?.dog === dog) {
    const lunges = quirk === "nervous" && strain.kind === "otherDog";
    const tell: PullPose = { direction: strain.direction, tag: "tell" };
    return lunges ? { ...tell, quirkTag: "lunge" } : tell;
  }
  const recent = last !== null && pulls.clock - last.at < read(data.tuning, "seconds", "laneMove");
  if (!recent || last.dog !== dog) {
    return null;
  }
  const pull: PullPose = { direction: last.direction, tag: "pull" };
  return quirk === "acrobatic" ? { ...pull, quirkTag: "flourish" } : pull;
}

// A pull that moved the pack re-anchors a drag at the pointer, so getting back takes another
// lane-width of drag.
export function gestureAfterPulls(
  pulled: readonly PullEvent[],
  gesture: GestureState,
): GestureState {
  return pulled.some((pull) => pull.moved) ? reanchorDrag(gesture) : gesture;
}
