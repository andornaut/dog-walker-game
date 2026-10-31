import { clampIndex } from "@andornaut/game-kit/arrays";

import type { DogId, GameData, ObstacleEncounterId } from "../data/types";
import type { LaneDirection } from "../layout/lanes";
import { countTally } from "../rules/achievements";
import { modifiedStat } from "../rules/modifiers";
import { read } from "../rules/units";
import { packDogs } from "../state/pack";
import type { RunState } from "../state/runState";
import type { RoadPoint } from "./collision";
import { pullLane } from "./laneControl";
import { destinationLane } from "./laneMotion";
import { isWaiting, laneAt, moverPlace, moverY } from "./movers";
import { moverOutcomes } from "./outcomes";
import {
  laneMotionConfig,
  laneMoveSeconds,
  packBoxes,
  type RoadGeometry,
  roadScrollSpeed,
  type Walk,
} from "./walk";
import { blocksLane, isPullObstacle, type WalkItem } from "./walkItems";

// Every dog pulls toward encounters whose resolution is pull. One dog strains at a time, the
// one nearest the target: pullTell seconds with its bubble, an arrow and a line to the
// target, then the pack lurches one lane toward it. Each target draws its pulls once.

export type PullData = Pick<
  GameData,
  "debuffs" | "dogs" | "encounters" | "minorObstacles" | "tuning" | "walkers" | "world"
>;
export type PullGeometry = Pick<
  RoadGeometry,
  "cell" | "laneCount" | "lens" | "packBand" | "packParts" | "roadTop"
>;

type PullTargetKind = ObstacleEncounterId;

// The dog straining toward a target on the road, toward direction, with tellSeconds of its
// tell to go. pullsLeft is the pulls the target still draws. blocked is set while the lane it
// would pull into has an obstacle too close to react to: the dog strains on, and pulls once
// the lane clears. fromLane is the pack's lane when the tell started: steering away from it,
// against direction, cancels the pull, as does a press toward the edge from an edge lane.
export interface Strain {
  readonly blocked: boolean;
  readonly direction: LaneDirection;
  readonly dog: DogId;
  readonly fromLane: number;
  readonly itemId: number;
  readonly kind: PullTargetKind;
  readonly pullsLeft: number;
  readonly tellSeconds: number;
}

// A pull at clock time at, toward a target of kind.
interface LastPull {
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

// moved is false for a pull toward the lane the pack already heads for, one lane past the lane
// it is in or moving to.
export interface PullEvent {
  readonly direction: LaneDirection;
  readonly dog: DogId;
  readonly moved: boolean;
}

// A dog that started straining this step, toward the side it will pull.
interface PullTell {
  readonly direction: LaneDirection;
  readonly dog: DogId;
  readonly kind: PullTargetKind;
}

// failed is the dogs whose strain ended without a pull: blocked until its target went, cancelled
// by steering away, or toward a target leaving past the road's edge beside the pack; leashed the
// dogs that would have started straining toward a squirrel that draws no pulls, such as under
// Good leash, once per squirrel.
export interface PullStep {
  readonly failed: readonly DogId[];
  readonly leashed: readonly DogId[];
  readonly pulled: readonly PullEvent[];
  readonly pulls: Pulls;
  readonly tells: readonly PullTell[];
  readonly walk: Walk;
}

// What a dog shows: its tell while it strains, then its pull lean for one lane move after a
// pull.
export interface PullPose {
  readonly direction: LaneDirection;
  readonly tag: "pull" | "tell";
}

// A lane change caused by a dog: one lane toward direction, held on the road.
export function pullWalk(
  data: Pick<GameData, "debuffs" | "dogs" | "tuning" | "walkers">,
  laneCount: number,
  direction: LaneDirection,
  walk: Walk,
): { readonly moved: boolean; readonly walk: Walk } {
  const { road, run } = walk;
  const config = laneMotionConfig(data, laneCount, run);
  const control = pullLane(config, direction, road.control);
  return {
    moved: control.target !== road.control.target,
    walk: { ...walk, road: { ...road, control } },
  };
}

// A target where it is now: its lane position and how near the pack it is. centre is its
// middle in road pixels.
interface Target {
  readonly centre: RoadPoint;
  readonly itemId: number;
  readonly kind: PullTargetKind;
  readonly lanePosition: number;
  readonly y: number;
}

// Only what is wholly ahead of the pack is a target: nothing acts on the pack once it reaches
// the pack's rows. A darting squirrel is one from when its cue shows, never while it waits idle
// at the road's edge before it, in any lane; anything else while it is off the pack's lane.
function targetOf(
  geometry: PullGeometry,
  lane: number,
  kind: PullTargetKind,
  item: WalkItem,
): Target | null {
  const { mover } = item;
  if (
    item.y + item.height > geometry.packBand.top ||
    (mover === undefined && item.lane === lane) ||
    (mover !== undefined && isWaiting(mover.path, mover.since))
  ) {
    return null;
  }
  const lanePosition =
    mover === undefined
      ? item.lane
      : moverPlace(geometry.laneCount, mover.path, mover.since).lanePosition;
  return {
    centre: {
      x: (lanePosition + item.laneSpan / 2) * geometry.cell.length,
      y: item.y + item.height / 2,
    },
    itemId: item.id,
    kind,
    lanePosition,
    y: item.y,
  };
}

// How many pulls a squirrel draws: squirrelPulls modifiers, such as Good leash, scale its one
// pull.
function squirrelPulls(data: PullData, walk: Walk): number {
  return Math.round(modifiedStat(data.tuning, walk.run.modifiers, "squirrelPulls", 1));
}

// The nearest eligible encounter that has not drawn its pulls, even when it draws none.
function nearestTarget(
  data: PullData,
  geometry: PullGeometry,
  spent: readonly number[],
  walk: Walk,
): Target | null {
  const lane = destinationLane(walk.road.control.motion);
  let nearest: Target | null = null;
  for (const item of walk.road.items) {
    const target =
      isPullObstacle(data, item.kind) && !spent.includes(item.id)
        ? targetOf(geometry, lane, item.kind as ObstacleEncounterId, item)
        : null;
    if (target !== null && (nearest === null || target.y > nearest.y)) {
      nearest = target;
    }
  }
  return nearest;
}

// The strained-for target where it is now, or null once it has gone, passed the pack or, if
// it does not move, been reached, or once the straining dog has left the pack: a fired dog
// never pulls.
function currentTarget(geometry: PullGeometry, strain: Strain, walk: Walk): Target | null {
  const item = walk.road.items.find(({ id }) => id === strain.itemId);
  if (item === undefined || !packDogs(walk.run).includes(strain.dog)) {
    return null;
  }
  return targetOf(geometry, destinationLane(walk.road.control.motion), strain.kind, item);
}

// Samples of a mover's path over the reaction horizon.
const SWEEP_SAMPLES = 24;

// When an item at y, height tall, starts and stops overlapping the pack's band, in seconds from
// now: from its near edge reaching the band's top until its far edge passes the band's bottom.
export function contactWindow(
  band: RoadGeometry["packBand"],
  speed: number,
  y: number,
  height: number,
): { readonly end: number; readonly start: number } {
  return { end: (band.bottom - y) / speed, start: (band.top - (y + height)) / speed };
}

// Whether something the pack must steer around reaches the pack in lane within horizon
// seconds: an obstacle in the lane, or a mover in it at any moment of its sweep. A stalker with
// steps still to choose may take any of them, since it chooses each toward where the pack is
// when its cue begins, which a drift or a pull into lane moves.
export function laneBlockedWithin(
  data: Pick<GameData, "encounters" | "minorObstacles">,
  geometry: PullGeometry,
  speed: number,
  horizon: number,
  lane: number,
  walk: Walk,
): boolean {
  const { bottom, top } = geometry.packBand;
  // A hit box's inset from its lanes' edges, in lanes.
  const inset = geometry.cell.inset / geometry.cell.length;
  return walk.road.items.some((item) => {
    if (!blocksLane(data, item.kind)) {
      return false;
    }
    const { mover } = item;
    if (mover === undefined) {
      const inLane = lane >= item.lane && lane < item.lane + item.laneSpan;
      const { end, start } = contactWindow(geometry.packBand, speed, item.y, item.height);
      return inLane && end > 0 && start < horizon;
    }
    const paths = moverOutcomes(mover.path);
    return paths.some((path) => {
      for (let sample = 0; sample <= SWEEP_SAMPLES; sample++) {
        const scroll = (sample / SWEEP_SAMPLES) * horizon * speed;
        const place = moverPlace(geometry.laneCount, path, mover.since + scroll);
        const y = moverY(geometry.roadTop, item.height, place);
        const touches = y + item.height > top && y < bottom;
        // A mover between lanes touches both: it covers every lane its hit box overlaps.
        const left = place.lanePosition + inset;
        const inLane = left < lane + 1 && left + item.laneSpan - 2 * inset > lane;
        if (place.solid && touches && inLane) {
          return true;
        }
      }
      return false;
    });
  });
}

// The time a pull must leave before an obstacle reaches the pack in its new lane: the pull's
// lane move, the reaction window and a lane move back out.
export function pullHorizon(
  data: Pick<GameData, "debuffs" | "dogs" | "tuning" | "walkers">,
  walk: Walk,
): number {
  const move = laneMoveSeconds(data, walk.run);
  return move + read(data.tuning, "seconds", "pullReactionWindow") + move;
}

// Whether a lane has an obstacle too close to react to once the pack is pulled or drifts into it:
// one reaching the pack within pullHorizon at the road's speed (laneBlockedWithin).
export function laneBlockedForPull(
  data: PullData,
  geometry: PullGeometry,
  lane: number,
  walk: Walk,
): boolean {
  return laneBlockedWithin(
    data,
    geometry,
    roadScrollSpeed(data, walk),
    pullHorizon(data, walk),
    lane,
    walk,
  );
}

// Whether the lane a strain would pull into has an obstacle too close to react to.
function pullBlocked(data: PullData, geometry: PullGeometry, strain: Strain, walk: Walk): boolean {
  const lane = destinationLane(walk.road.control.motion) + strain.direction;
  return laneBlockedForPull(data, geometry, lane, walk);
}

const NOTHING = { failed: [], leashed: [], pulled: [], tells: [] } as const;

// The walking dog whose part of the pack's box has its centre nearest the target's across the
// road, so the dog on the target's side strains, the first in pack order on a tie.
function nearestDog(geometry: PullGeometry, target: Target, walk: Walk): DogId | undefined {
  let nearest: { readonly distance: number; readonly dog: DogId } | undefined;
  for (const box of packBoxes(geometry, walk.road.control.motion, walk.run).dogs) {
    const distance = Math.abs((box.left + box.right) / 2 - target.centre.x);
    if (nearest === undefined || distance < nearest.distance) {
      nearest = { distance, dog: box.dog };
    }
  }
  return nearest?.dog;
}

// The ids of items still on the road.
function stillOnRoad(items: readonly WalkItem[], ids: readonly number[]): number[] {
  if (ids.length === 0) {
    return [];
  }
  const onRoad = new Set(items.map(({ id }) => id));
  return ids.filter((id) => onRoad.has(id));
}

// The side of the pack's lane the target is on.
function sideOf(lane: number, target: Target): LaneDirection {
  return target.lanePosition < lane ? -1 : 1;
}

// Whether the player steered away from the strain's target: the pack's lane moved away from
// it, or, in an edge lane, a press toward the edge, which cannot move the pack.
function steeredAway(
  laneCount: number,
  lane: number,
  pressed: readonly LaneDirection[],
  strain: Strain,
): boolean {
  if ((lane - strain.fromLane) * strain.direction < 0) {
    return true;
  }
  const away = -strain.direction;
  return pressed.some(
    (direction) => direction === away && clampIndex(laneCount, lane + direction) === lane,
  );
}

// One step of the pull clock. pressed is the lane presses applied this step, in order. With no dog
// straining, the dog nearest the nearest squirrel starts its tell toward it, which draws
// squirrelPulls pulls. A strain whose target has gone, passed or been reached ends, and steering
// away from the target cancels it. Once the tell has run, and the squirrel is off the pack's lane
// (a darting one once it moves), the dog pulls one lane toward it, unless the fairness rule blocks
// the pull: then it strains on until the lane clears or the strain ends. A strain toward a target
// leaving past the road's edge beside the pack fails. A target with pulls left starts the tell
// again. Nothing moves unless the walk is walking with no hit stop.
export function stepPulls(
  data: PullData,
  geometry: PullGeometry,
  stepSeconds: number,
  pressed: readonly LaneDirection[],
  pulls: Pulls,
  walk: Walk,
): PullStep {
  if (walk.run.phase.kind !== "walking" || walk.road.hitStop !== null) {
    return { ...NOTHING, pulls, walk };
  }
  const clock = pulls.clock + stepSeconds;
  let spent = stillOnRoad(walk.road.items, pulls.spent);
  const tell = read(data.tuning, "seconds", "pullTell");
  const lane = destinationLane(walk.road.control.motion);

  // The pulls once a strain toward the item with itemId ends, that target's pulls spent.
  const spentOn = (itemId: number): Pulls => ({
    ...pulls,
    clock,
    spent: [...spent, itemId],
    strain: null,
  });

  let strain = pulls.strain;
  let target = strain === null ? null : currentTarget(geometry, strain, walk);
  const failed: DogId[] = [];
  if (strain !== null && target === null) {
    if (strain.blocked) {
      failed.push(strain.dog);
    }
    spent = [...spent, strain.itemId];
    strain = null;
  }
  if (strain === null || target === null) {
    target = nearestTarget(data, geometry, spent, walk);
    const dog = target === null ? undefined : nearestDog(geometry, target, walk);
    if (target === null || dog === undefined) {
      return { ...NOTHING, failed, pulls: { ...pulls, clock, spent, strain: null }, walk };
    }
    const pullsLeft = squirrelPulls(data, walk);
    if (pullsLeft < 1) {
      return { ...NOTHING, failed, leashed: [dog], pulls: spentOn(target.itemId), walk };
    }
    strain = {
      blocked: false,
      direction: sideOf(lane, target),
      dog,
      fromLane: lane,
      itemId: target.itemId,
      kind: target.kind,
      pullsLeft,
      tellSeconds: tell,
    };
    const started: PullTell = { direction: strain.direction, dog, kind: target.kind };
    const next = { ...pulls, clock, spent, strain };
    return { ...NOTHING, failed, pulls: next, tells: [started], walk };
  }

  // Steering away from the target during the strain cancels the pull, and the target's pulls
  // with it.
  if (steeredAway(geometry.laneCount, lane, pressed, strain)) {
    return { ...NOTHING, failed: [strain.dog], pulls: spentOn(strain.itemId), walk };
  }
  const leaned: Strain = {
    ...strain,
    direction: sideOf(lane, target),
    tellSeconds: Math.max(0, strain.tellSeconds - stepSeconds),
  };
  if (leaned.tellSeconds > 0 || laneAt(target.lanePosition) === lane) {
    return { ...NOTHING, pulls: { ...pulls, clock, spent, strain: leaned }, walk };
  }
  // A target leaving past the road's edge from beside the pack's edge lane draws no pull.
  if (clampIndex(geometry.laneCount, lane + leaned.direction) === lane) {
    return { ...NOTHING, failed: [leaned.dog], pulls: spentOn(leaned.itemId), walk };
  }
  if (pullBlocked(data, geometry, leaned, walk)) {
    return {
      ...NOTHING,
      pulls: { ...pulls, clock, spent, strain: { ...leaned, blocked: true } },
      walk,
    };
  }
  const { direction, dog } = leaned;
  const pull = pullWalk(data, geometry.laneCount, direction, walk);
  const pullsLeft = leaned.pullsLeft - 1;
  const fromLane = destinationLane(pull.walk.road.control.motion);
  const again =
    pullsLeft > 0 ? { ...leaned, blocked: false, fromLane, pullsLeft, tellSeconds: tell } : null;
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
    // A pull that moved the pack counts toward the squirrel pulls tally.
    walk: pull.moved
      ? { ...pull.walk, run: countTally("squirrelPulls", pull.walk.run) }
      : pull.walk,
  };
}

// The dog's tell while it strains, then its pull pose for one of the walker's lane moves after
// a pull.
export function pullPose(
  data: Pick<GameData, "debuffs" | "dogs" | "tuning" | "walkers">,
  run: Pick<RunState, "debuffs" | "modifiers" | "pack" | "walker">,
  pulls: Pulls,
  dog: DogId,
): PullPose | null {
  const { last, strain } = pulls;
  if (strain?.dog === dog) {
    return { direction: strain.direction, tag: "tell" };
  }
  const recent = last !== null && pulls.clock - last.at < laneMoveSeconds(data, run);
  if (!recent || last.dog !== dog) {
    return null;
  }
  return { direction: last.direction, tag: "pull" };
}
