import type { DogId, GameData } from "../data/types";
import type { LaneDirection } from "../layout/lanes";
import { modifiedStat } from "../rules/modifiers";
import { read } from "../rules/units";
import { packDogs } from "../state/pack";
import { destinationLane } from "./laneMotion";
import { laneAt, moverPlace } from "./movers";
import { type PullEvent, type PullPose, pullWalk } from "./pulls";
import type { RoadGeometry, Walk, WalkItem } from "./walk";

// Chasers pull the pack toward a squirrel on the road: the pack's first chaser leans for
// pullTell, then pulls one lane toward it once it is in another lane. A darting squirrel is
// chased from when its cue shows, and pulled toward only while it moves; a static one while
// it is ahead of the pack and off the pack's lane. chaserSquirrelPulls modifiers, such as Good
// leash, scale the pulls each squirrel draws from one; after each pull but the last, the chaser
// leans again. The nearest squirrel is chased, and each squirrel draws its pulls once.
export interface ChaseTarget {
  readonly direction: LaneDirection;
  readonly itemId: number;
  readonly pullsLeft: number;
  readonly tellSeconds: number;
}

// spent is the squirrels still on the road whose pulls are used up.
export interface SquirrelChase {
  readonly dog: DogId;
  readonly spent: readonly number[];
  readonly target: ChaseTarget | null;
}

export interface ChaseStep {
  readonly pulled: readonly PullEvent[];
  // The chaser whose tell started this step, toward the side it leans.
  readonly tells: readonly { readonly direction: LaneDirection; readonly dog: DogId }[];
  readonly walk: Walk;
}

export type ChaseGeometry = Pick<RoadGeometry, "laneCount" | "packBand">;

interface Quarry {
  readonly itemId: number;
  readonly lanePosition: number;
  readonly moving: boolean;
  readonly y: number;
}

const NOTHING: Omit<ChaseStep, "walk"> = { pulled: [], tells: [] };

function withChase(chase: SquirrelChase | null, walk: Walk): Walk {
  return walk.road.chase === chase ? walk : { ...walk, road: { ...walk.road, chase } };
}

// A squirrel the chaser can chase, where it is now.
function quarryOf(geometry: ChaseGeometry, lane: number, item: WalkItem): Quarry | null {
  if (item.kind !== "squirrel") {
    return null;
  }
  if (item.mover !== undefined) {
    const place = moverPlace(geometry.laneCount, item.mover.path, item.mover.since);
    return { itemId: item.id, lanePosition: place.lanePosition, moving: place.moving, y: item.y };
  }
  const ahead = item.y + item.height <= geometry.packBand.top;
  return ahead && item.lane !== lane
    ? { itemId: item.id, lanePosition: item.lane, moving: true, y: item.y }
    : null;
}

// The squirrel being chased while it can still be, otherwise the nearest one not yet chased.
function pickTarget(
  pulls: number,
  tell: number,
  quarries: readonly Quarry[],
  spent: readonly number[],
  current: ChaseTarget | null,
): { quarry: Quarry; started: boolean; target: Omit<ChaseTarget, "direction"> } | null {
  const kept = quarries.find((quarry) => quarry.itemId === current?.itemId);
  if (kept !== undefined && current !== null) {
    return { quarry: kept, started: false, target: current };
  }
  const nearest = quarries
    .filter((quarry) => !spent.includes(quarry.itemId))
    .reduce<Quarry | null>(
      (best, quarry) => (best === null || quarry.y > best.y ? quarry : best),
      null,
    );
  return nearest === null
    ? null
    : {
        quarry: nearest,
        started: true,
        target: { itemId: nearest.itemId, pullsLeft: pulls, tellSeconds: tell },
      };
}

// Like a dog's own pulls, the chase stands still unless the walk is walking with no hit stop.
export function stepChase(
  data: Pick<GameData, "dogs" | "tuning">,
  geometry: ChaseGeometry,
  stepSeconds: number,
  walk: Walk,
): ChaseStep {
  const { road, run } = walk;
  if (run.phase.kind !== "walking" || road.hitStop !== null) {
    return { ...NOTHING, walk };
  }
  const chaser = packDogs(run).find((dog) => data.dogs[dog].trait === "chaser");
  const pulls = Math.round(modifiedStat(data.tuning, run.modifiers, "chaserSquirrelPulls", 1));
  if (chaser === undefined || pulls < 1) {
    return { ...NOTHING, walk: withChase(null, walk) };
  }
  const lane = destinationLane(road.control.motion);
  const quarries = road.items.flatMap((item) => quarryOf(geometry, lane, item) ?? []);
  const onRoad = new Set(road.items.map((item) => item.id));
  const spent = (road.chase?.spent ?? []).filter((id) => onRoad.has(id));
  const tell = read(data.tuning, "seconds", "pullTell");
  const picked = pickTarget(pulls, tell, quarries, spent, road.chase?.target ?? null);
  if (picked === null) {
    const idle = spent.length === 0 ? null : { dog: chaser, spent, target: null };
    return { ...NOTHING, walk: withChase(idle, walk) };
  }
  const { quarry, started } = picked;
  const direction: LaneDirection = quarry.lanePosition < lane ? -1 : 1;
  const leaned: ChaseTarget = {
    ...picked.target,
    direction,
    tellSeconds: Math.max(0, picked.target.tellSeconds - stepSeconds),
  };
  const tells = started ? [{ direction, dog: chaser }] : [];
  if (leaned.tellSeconds > 0 || !quarry.moving || laneAt(quarry.lanePosition) === lane) {
    return { pulled: [], tells, walk: withChase({ dog: chaser, spent, target: leaned }, walk) };
  }
  const pull = pullWalk(data, geometry.laneCount, chaser, direction, walk);
  const pullsLeft = leaned.pullsLeft - 1;
  const chase: SquirrelChase =
    pullsLeft > 0
      ? { dog: chaser, spent, target: { ...leaned, pullsLeft, tellSeconds: tell } }
      : { dog: chaser, spent: [...spent, quarry.itemId], target: null };
  return {
    pulled: [{ direction, dog: chaser, moved: pull.moved }],
    tells: pullsLeft > 0 ? [...tells, { direction, dog: chaser }] : tells,
    walk: withChase(chase, pull.walk),
  };
}

// The chaser's tell while it leans toward a squirrel.
export function chasePose(chase: SquirrelChase | null, dog: DogId): PullPose | null {
  if (chase === null || chase.dog !== dog || chase.target === null) {
    return null;
  }
  const { direction, tellSeconds } = chase.target;
  return tellSeconds > 0 ? { direction, tag: "tell" } : null;
}
