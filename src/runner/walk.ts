import type {
  DogId,
  Encounter,
  EncounterId,
  GameData,
  MinorObstacleId,
  MoveCount,
  Movement,
  MovementKind,
  ObstacleEncounterId,
} from "../data/types";
import type { LaneDirection } from "../layout/lanes";
import { hasObstacleArt, obstacleParts, obstacleSilhouette } from "../layout/obstacleArt";
import { formationOrder, PART_INSET } from "../layout/packFormation";
import { itemAt } from "../lib/arrays";
import { chance, type Random, randomPick } from "../lib/random";
import { countBump, countLandedBump, countTally } from "../rules/achievements";
import { type HeartChange, modifierCauses, type MoneyChange } from "../rules/causes";
import { applyInstantEncounter, type ChoiceOutcome } from "../rules/choices";
import { expireAtZoneEnd, tickDebuffs } from "../rules/durations";
import { changeHearts } from "../rules/effects";
import { affectedDogs, hitLabel, opensCard } from "../rules/encounters";
import {
  changeModified,
  type ModifiedValue,
  modifiedValue,
  modifierCause,
  modifierCausesOf,
} from "../rules/modified";
import { modifiedStat } from "../rules/modifiers";
import { currentZone, walkLength } from "../rules/route";
import {
  bumpCash,
  bumpParts,
  fireOwnersAtZero,
  fullPackBonus,
  payZone,
  tipValue,
} from "../rules/run";
import { reachModified } from "../rules/standing";
import { treatRecipient } from "../rules/treats";
import { addCents, type Pixels, pixels, read } from "../rules/units";
import { packAgility, slowestDebuffedAgility, slowestPackAgility } from "../rules/walkers";
import { zoneScrollSpeed, zoneStats } from "../rules/zones";
import { packDogs } from "../state/pack";
import type { CardSource, RunState } from "../state/runState";
import {
  approachChoices,
  type ApproachPath,
  nearestStep,
  nextChoiceAt,
  nextStepAt,
  takeStep,
} from "./approach";
import {
  type Box,
  collideWithPack,
  type CollisionRules,
  type DogBox,
  hitDog,
  itemBox,
  type LanedBox,
  overlaps,
  type PackBoxes,
  pickupDog,
  type ScaledBox,
  tickInvulnerability,
} from "./collision";
import { STEP_SECONDS } from "./fixedStep";
import { type HeldStep, type HitStop, hitStopLength, startHitStop, tickHitStop } from "./hitStop";
import { advanceLaneControl, type LaneControl, laneControlIn, steerLane } from "./laneControl";
import { type LaneMotion, type LaneMotionConfig, laneMotionX, stillInLane } from "./laneMotion";
import {
  drawnLanes,
  hasLeftRoad,
  hopSequences,
  hopShapes,
  isWarning,
  laneAt,
  moveMovers,
  type MoverFootprint,
  type MoverItem,
  type MoverMotion,
  moverPlace,
  type MoverSpec,
  type PlannerStreams,
  type StepShape,
} from "./movers";
import { drawnObstacleBox, exitLength, type PlacedPart, type RoadLens } from "./obstacleBox";
import { awayHop, nextShyChoiceAt, shyChoices, type ShyPath, takeHop } from "./shy";
import {
  type Footprint,
  type PathRow,
  planSpawns,
  SINGLE_CELL,
  type SpawnEvent,
  type SpawnQuota,
  takeDueSpawns,
} from "./spawning";

export type WalkData = Pick<
  GameData,
  | "debuffs"
  | "dogs"
  | "encounters"
  | "homeText"
  | "minorObstacles"
  | "runText"
  | "shopGear"
  | "tuning"
  | "upgrades"
  | "walkerPerks"
  | "walkers"
  | "world"
>;

type PickupKind = "tip" | "treat";
export type WalkItemKind = EncounterId | MinorObstacleId | PickupKind;
export type WalkItem = MoverItem<WalkItemKind>;
// What a road item is to the rules: an obstacle hit by accident, a minor obstacle that opens
// no card, a lucky encounter, or a pickup.
type ItemCategory = "lucky" | "minor" | "obstacle" | PickupKind;

// Everything on the road that the run state does not hold. pending is this zone's spawns
// not yet in view, at zone distances. path is this zone's guaranteed path, at zone distances,
// empty before the first zone is planned. planned is what this zone's plan asked for from the
// tuning counts and weights, which the simulator compares with what it placed. speedFactor scales
// the scroll speed, for testing. hitStop is set while a hit or a firing holds the walk still.
export interface Road {
  control: LaneControl;
  hitStop: HitStop | null;
  invulnerableSeconds: number;
  items: readonly WalkItem[];
  nextItemId: number;
  path: readonly PathRow[];
  pending: readonly SpawnEvent<WalkItemKind>[];
  planned: readonly PlannedCount[];
  speedFactor: number;
}

// A spawn quota as counted: its kind, how many, and how they move, or null standing still.
export interface PlannedCount {
  readonly count: number;
  readonly kind: WalkItemKind;
  readonly movement: MovementKind | null;
}

export interface Walk {
  road: Road;
  run: RunState;
}

// Flat road pixels, where y grows toward the walker and the pack stands at scale 1, before
// the pseudo-3D projection draws them. packParts are the current pack's, across from its place
// on the road: each dog's hit rectangle in pack order and the walker's, inside their drawn
// sprites, which obstacles hit; and its outline, the bounding box of everything drawn for it,
// which pickups touch. packBand is the outline's rows. tallestPackBand is the longest any pack's
// outline runs, so spawns stay avoidable whoever walks. A footprint is cell.length per lane and
// row; an obstacle hits as it is drawn (solidItemBox), anything else with its footprint less
// cell.inset at each side, itemHeights long. lens is the projection that draws the road.
// roadTop is the far edge of the road in view, where spawns come into view, and sightLength
// the road in view above the tallest pack.
export interface RoadGeometry {
  cell: { inset: number; length: number };
  itemHeights: Readonly<Record<"lucky" | PickupKind, number>>;
  laneCount: number;
  lens: RoadLens;
  packBand: { bottom: number; top: number };
  packParts: { dogs: readonly ScaledBox[]; outline: Box; walker: ScaledBox };
  roadBottom: number;
  roadTop: number;
  sightLength: number;
  tallestPackBand: number;
}

// A lucky encounter that applied on contact, with no card.
interface InstantFind {
  encounter: EncounterId;
  outcome: ChoiceOutcome;
}

// A minor obstacle the pack bumped: the dog it landed on, the hearts its owner lost, or null with
// none to lose, and the cash it also cost while a debuff such as Spotlight makes bumps cost cash,
// or null with none. The dog it would land on dodges it at its dodgeChance, and loses nothing.
export interface MinorBump {
  cash: MoneyChange | null;
  change: HeartChange | null;
  dodged: boolean;
  dog: DogId;
  item: MoverItem<MinorObstacleId>;
}

// A treat the pack grabbed: the dog whose owner it went to, by treatRecipient, and the hearts
// that owner gained, or null at their max.
interface TreatGrab {
  change: HeartChange | null;
  dog: DogId;
  item: WalkItem;
}

export type EncounterCard = Extract<CardSource, { kind: "encounter" }>;

// A contact obstacle the pack touched, such as a puddle, the dog the touch landed on, and what
// its effects did.
interface ContactHit {
  dog: DogId;
  encounter: EncounterId;
  item: WalkItem;
  outcome: ChoiceOutcome;
}

// A value modifiers changed on the road, at the item it happened at: a bump's hearts, a tip's
// pay, a tip or a treat grabbed by reach, an obstacle the pack is immune to, or a value a
// contact's or a lucky find's effects changed.
interface RoadModified {
  readonly item: WalkItem;
  readonly value: ModifiedValue;
}

// bumps, cards, contacts, instants and treats are in the order the pack met them; tips are the
// money changes of the tips collected; modified every value modifiers changed, in the order the
// pack met their items; fired the owners a bump left at 0 hearts; zoneEnded is
// set on the step that reaches the end of the zone. encounterHits are the card obstacles met
// this step, which play a hit moment. A hit stop holds the step's cards and zone end back to the
// step it ends on.
export interface WalkStep {
  bumps: MinorBump[];
  cards: CardSource[];
  collected: WalkItem[];
  contacts: ContactHit[];
  encounterHits: EncounterCard[];
  fired: readonly DogId[];
  instants: InstantFind[];
  modified: RoadModified[];
  tips: MoneyChange[];
  treats: TreatGrab[];
  walk: Walk;
  zoneEnded: boolean;
}

// A zone's end: fees are the zone's pay, banked, and after the last zone the Walk bonus;
// run is the run after it.
interface ZoneEnd {
  fees: readonly MoneyChange[];
  run: RunState;
}

export function isMinorObstacle(
  data: Pick<GameData, "minorObstacles">,
  kind: WalkItemKind,
): kind is MinorObstacleId {
  return Object.hasOwn(data.minorObstacles, kind);
}

export function itemCategory(
  data: Pick<GameData, "encounters" | "minorObstacles">,
  kind: WalkItemKind,
): ItemCategory {
  if (isPickup(kind)) {
    return kind;
  }
  return isMinorObstacle(data, kind) ? "minor" : data.encounters[kind].kind;
}

// The lanes and rows an item covers: an obstacle's shape, or one cell.
export function footprintOf(
  data: Pick<GameData, "encounters" | "minorObstacles">,
  kind: WalkItemKind,
): Footprint {
  if (isPickup(kind)) {
    return SINGLE_CELL;
  }
  if (isMinorObstacle(data, kind)) {
    return data.minorObstacles[kind].shape;
  }
  const encounter = data.encounters[kind];
  return encounter.kind === "obstacle" ? encounter.shape : SINGLE_CELL;
}

type ObstacleKind = EncounterId | MinorObstacleId;

// Obstacles, minor or not, which hit as they are drawn.
export function isObstacle(
  data: Pick<GameData, "encounters" | "minorObstacles">,
  kind: WalkItemKind,
): kind is ObstacleKind {
  const category = itemCategory(data, kind);
  return category === "minor" || category === "obstacle";
}

// How an obstacle that is an encounter resolves, or null for anything else.
function obstacleResolution(
  data: Pick<GameData, "encounters" | "minorObstacles">,
  kind: WalkItemKind,
): Encounter["resolution"]["kind"] | null {
  return itemCategory(data, kind) === "obstacle"
    ? data.encounters[kind as EncounterId].resolution.kind
    : null;
}

// An obstacle touching does nothing to, such as a squirrel: dogs pull toward it instead.
export function isPullObstacle(
  data: Pick<GameData, "encounters" | "minorObstacles">,
  kind: WalkItemKind,
): boolean {
  return obstacleResolution(data, kind) === "pull";
}

// What the pack steers around, and the spawn planner keeps a path past: every obstacle but a
// pull obstacle, which passes through the pack. A pull obstacle that moves is planned as a moving
// prize.
export function blocksLane(
  data: Pick<GameData, "encounters" | "minorObstacles">,
  kind: WalkItemKind,
): boolean {
  return isObstacle(data, kind) && !isPullObstacle(data, kind);
}

// The last lane move time, scroll speed and zone length worked out, with the data groups and
// run fields they were worked out from. A walk asks for the same ones every step until its
// pack, zone, modifiers or debuffs or the data change; data and run states are never changed in place.
let lastLaneMove:
  | (Pick<GameData, "debuffs" | "dogs" | "tuning" | "walkers"> &
      Pick<RunState, "pack" | "walker"> & {
        readonly runDebuffs: RunState["debuffs"];
        readonly runModifiers: RunState["modifiers"];
        readonly seconds: number;
      })
  | null = null;
let lastScrollSpeed:
  | (Pick<GameData, "tuning" | "world"> &
      Pick<RunState, "route" | "zoneIndex"> & { readonly speed: Pixels })
  | null = null;

// How long one lane move takes: seconds.laneMove over the pack's agility, a Muddy pack's included.
export function laneMoveSeconds(
  data: Pick<GameData, "debuffs" | "dogs" | "tuning" | "walkers">,
  run: Pick<RunState, "debuffs" | "modifiers" | "pack" | "walker">,
): number {
  const last = lastLaneMove;
  if (
    last !== null &&
    last.tuning === data.tuning &&
    last.debuffs === data.debuffs &&
    last.dogs === data.dogs &&
    last.walkers === data.walkers &&
    last.pack === run.pack &&
    last.walker === run.walker &&
    last.runModifiers === run.modifiers &&
    last.runDebuffs === run.debuffs
  ) {
    return last.seconds;
  }
  const seconds = read(data.tuning, "seconds", "laneMove") / packAgility(data, run);
  lastLaneMove = {
    debuffs: data.debuffs,
    dogs: data.dogs,
    pack: run.pack,
    runDebuffs: run.debuffs,
    runModifiers: run.modifiers,
    seconds,
    tuning: data.tuning,
    walker: run.walker,
    walkers: data.walkers,
  };
  return seconds;
}

export function laneMotionConfig(
  data: Pick<GameData, "debuffs" | "dogs" | "tuning" | "walkers">,
  laneCount: number,
  run: Pick<RunState, "debuffs" | "modifiers" | "pack" | "walker">,
): LaneMotionConfig {
  return { laneCount, moveDuration: laneMoveSeconds(data, run) };
}

// Pixels per second in the run's current zone, read from the live data. Every walker walks the
// same road at the same speed.
export function walkScrollSpeed(
  data: Pick<GameData, "tuning" | "world">,
  run: Pick<RunState, "route" | "zoneIndex">,
): Pixels {
  const last = lastScrollSpeed;
  if (
    last !== null &&
    last.tuning === data.tuning &&
    last.world === data.world &&
    last.route === run.route &&
    last.zoneIndex === run.zoneIndex
  ) {
    return last.speed;
  }
  const speed = zoneScrollSpeed(data.tuning, currentZone(data, run), run.zoneIndex);
  lastScrollSpeed = {
    route: run.route,
    speed,
    tuning: data.tuning,
    world: data.world,
    zoneIndex: run.zoneIndex,
  };
  return speed;
}

// The entries of a zone's weights above 0, in the data's order.
function positiveWeights<Id extends string>(weights: Readonly<Record<Id, number>>): [Id, number][] {
  return (Object.keys(weights) as Id[])
    .map((id): [Id, number] => [id, weights[id]])
    .filter(([, weight]) => weight > 0);
}

// The minor obstacles that may appear in the run's current zone, with their weights.
export function minorObstacleWeights(
  data: Pick<GameData, "world">,
  run: Pick<RunState, "route" | "zoneIndex">,
): [MinorObstacleId, number][] {
  return positiveWeights(currentZone(data, run).weights.minorObstacles);
}

// The walk's first zone starts with spawns on the road in view, the first meeting the pack no
// sooner than this long in; later zones start with their own spawns still to come into view.
export function firstContactSeconds(
  data: Pick<GameData, "tuning">,
  run: Pick<RunState, "zoneIndex">,
): number | undefined {
  return run.zoneIndex === 0 ? read(data.tuning, "seconds", "firstZoneContact") : undefined;
}

// Every zone is the distance the base speed covers in zoneAtBaseSpeed.
export function zoneLength(data: Pick<GameData, "tuning">): Pixels {
  return pixels(
    read(data.tuning, "pixels", "roadScrollSpeed") *
      read(data.tuning, "seconds", "zoneAtBaseSpeed"),
  );
}

export function startRoad(laneCount: number, speedFactor = 1): Road {
  return {
    control: laneControlIn(stillInLane(Math.floor(laneCount / 2))),
    hitStop: null,
    invulnerableSeconds: 0,
    items: [],
    nextItemId: 0,
    path: [],
    pending: [],
    planned: [],
    speedFactor,
  };
}

// The chance weights of the obstacles in the run's current zone.
export function obstacleWeights(
  data: Pick<GameData, "world">,
  run: Pick<RunState, "route" | "zoneIndex">,
): [ObstacleEncounterId, number][] {
  return positiveWeights(currentZone(data, run).weights.obstacles);
}

export function pickWeighted<T>(random: Random, entries: readonly (readonly [T, number])[]): T {
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = random() * total;
  for (const [value, weight] of entries) {
    roll -= weight;
    if (roll < 0) {
      return value;
    }
  }
  const last = entries.at(-1);
  if (last === undefined) {
    throw new Error("pickWeighted needs at least one entry");
  }
  return last[0];
}

// The movement a drawn spawn moves with: an obstacle, minor or not, or a lucky encounter with a
// movement comes as a mover at a chance of share. Other spawns never move and draw nothing, as
// does any spawn at a share of 0.
export function moverMovement(
  data: Pick<GameData, "encounters" | "minorObstacles">,
  random: Random,
  share: number,
  kind: WalkItemKind,
): Movement | null {
  const movement = movementOf(data, kind);
  if (movement === null || share <= 0) {
    return null;
  }
  return chance(random, share) ? movement : null;
}

// The movement an obstacle, minor or not, or a lucky encounter can come with, or null for anything
// that never moves.
export function movementOf(
  data: Pick<GameData, "encounters" | "minorObstacles">,
  kind: WalkItemKind,
): Movement | null {
  if (isPickup(kind)) {
    return null;
  }
  const entry = isMinorObstacle(data, kind) ? data.minorObstacles[kind] : data.encounters[kind];
  const movement = "movement" in entry ? entry.movement : undefined;
  return movement ?? null;
}

// A step: a lane to either side, or a row toward the pack or away.
export const STEP_SHAPES: readonly StepShape[] = [
  { lanes: -1, travel: 0 },
  { lanes: 1, travel: 0 },
  { lanes: 0, travel: 1 },
  { lanes: 0, travel: -1 },
];

// Every count in a range, fewest first.
function countsOf(range: MoveCount): number[] {
  return Array.from({ length: range.max - range.min + 1 }, (_, i) => range.min + i);
}

// How a mover moves, by its movement and the tuning. A stepper's steps are drawn here, as many as
// its most, the first min from the spawns stream and any more from the movers stream; it may take
// the first steps of them, or of their mirror image, as many as its drawn count. A hopper may make
// any hops it can, as many as its drawn count, of up to HOP_SEQUENCES_MOST ways for each count,
// drawn here from the movers stream where there are more. The planner takes whichever way keeps
// the road passable, drawing among those from the zone's seed.
export function moverSpec(
  data: Pick<GameData, "tuning">,
  streams: PlannerStreams,
  footprint: MoverFootprint,
  movement: Movement,
): MoverSpec {
  const { tuning } = data;
  let motion: MoverMotion;
  if (movement.kind === "dart") {
    motion = {
      kind: "cross",
      lanesPerSecond: read(tuning, "counts", "dartLanesPerSecond"),
      reactionSeconds: read(tuning, "seconds", "pathReactionMargin"),
      startRoadShare: [
        read(tuning, "multipliers", "dartStartRoadShareMin"),
        read(tuning, "multipliers", "dartStartRoadShareMax"),
      ],
      stopLanes: {
        max: read(tuning, "counts", "dartStopLanesMax"),
        min: read(tuning, "counts", "dartStopLanesMin"),
      },
      stopShare: movement.stopShare,
      tilt: [movement.tilt.min, movement.tilt.max],
      turnAtShare: [
        read(tuning, "multipliers", "dartTurnAtShareMin"),
        read(tuning, "multipliers", "dartTurnAtShareMax"),
      ],
      turnBackShare: movement.turnBackShare,
    };
  } else if (movement.kind === "inLane") {
    motion = { kind: "ride", speedMultiplier: movement.factor };
  } else if (movement.kind === "approach") {
    motion = {
      firstDelaySeconds: [
        read(tuning, "seconds", "approachFirstDelayMin"),
        read(tuning, "seconds", "approachFirstDelayMax"),
      ],
      kind: "approach",
      secondRoadShare: [
        read(tuning, "multipliers", "approachSecondRoadShareMin"),
        read(tuning, "multipliers", "approachSecondRoadShareMax"),
      ],
      stepSeconds: read(tuning, "seconds", "moverStepSeconds"),
      steps: movement.steps,
    };
  } else if (movement.kind === "hop") {
    const sideways = movement.sideways === true;
    motion = {
      count: movement.times,
      kind: "steps",
      sequences: countsOf(movement.times).flatMap((times) =>
        hopSequences(streams.movers, movement.most, sideways, times),
      ),
      ...(movement.shy === true
        ? {
            shy: {
              nearSeconds: read(tuning, "seconds", "shyHopNearSeconds"),
              rise: sideways ? 0 : movement.most,
              shapes: hopShapes(movement.most, sideways),
              share: read(tuning, "probability", "shyHopperShare"),
            },
          }
        : {}),
      stepSeconds: read(tuning, "seconds", "moverHopSeconds"),
    };
  } else {
    const { max, min } = movement.steps;
    const steps = Array.from({ length: max }, (_, i) =>
      randomPick(i < min ? streams.spawns : streams.movers, STEP_SHAPES),
    );
    const mirrored = steps.map(({ lanes, travel }) => ({ lanes: -lanes as -1 | 0 | 1, travel }));
    motion = {
      count: movement.steps,
      kind: "steps",
      sequences: countsOf(movement.steps).flatMap((count) => [
        steps.slice(0, count),
        mirrored.slice(0, count),
      ]),
      stepSeconds: read(tuning, "seconds", "moverStepSeconds"),
    };
  }
  return {
    footprint,
    motion,
    movement: movement.kind,
    variation: {
      delaySeconds: read(tuning, "seconds", "moverTimingJitter"),
      lengthShare: read(tuning, "seconds", "moverMoveSecondsJitter"),
      speedShare: read(
        tuning,
        "multipliers",
        movement.kind === "dart" ? "dartSpeedJitter" : "moverSpeedJitter",
      ),
    },
    warningSeconds: read(tuning, "seconds", "moverWarningSeconds"),
  };
}

// Whether a kind is an obstacle that opens a card, which the planner places before every other
// spawn, so it is the last skipped.
export function opensACard(
  data: Pick<GameData, "encounters" | "minorObstacles">,
  kind: WalkItemKind,
): boolean {
  return obstacleResolution(data, kind) === "card";
}

// Each obstacle, minor obstacle and lucky find is drawn first by the zone's weights, so its
// shape is known when it is placed. Rush hour and the like scale both obstacle counts, the tips
// and the treats. Then each obstacle or lucky find whose look moves comes as a mover at the zone's
// mover share: one quota per kind, and one per stepper, whose steps are its own. A lucky find
// or a pull obstacle blocks no lane, moving or not (blocksLane).
export function spawnQuotas(
  data: WalkData,
  streams: PlannerStreams,
  run: RunState,
): SpawnQuota<WalkItemKind>[] {
  const random = streams.spawns;
  const zone = currentZone(data, run);
  const stats = zoneStats(data.tuning, zone, run.zoneIndex);
  const scaled = (stat: "obstacleSpawns" | "tipSpawns" | "treatSpawns", base: number) =>
    Math.round(modifiedStat(data.tuning, run.modifiers, stat, base));
  const drawn = <Kind extends WalkItemKind>(
    count: number,
    weights: readonly (readonly [Kind, number])[],
  ) =>
    weights.length === 0 ? [] : Array.from({ length: count }, () => pickWeighted(random, weights));
  const kinds: WalkItemKind[] = [
    ...drawn(scaled("obstacleSpawns", stats.obstacles), obstacleWeights(data, run)),
    ...drawn(scaled("obstacleSpawns", stats.minorObstacles), minorObstacleWeights(data, run)),
    ...drawn(stats.luckyEncounters, positiveWeights(zone.weights.luckyFinds)),
  ];
  const quotas = new Map<WalkItemKind, number>();
  const movers = new Map<WalkItemKind, { readonly count: number; readonly movement: Movement }>();
  const steppers: SpawnQuota<WalkItemKind>[] = [];
  const count = <Key>(map: Map<Key, number>, key: Key) => map.set(key, (map.get(key) ?? 0) + 1);
  const moverQuota = (kind: WalkItemKind, movement: Movement, moverCount: number) => ({
    blocksLane: blocksLane(data, kind),
    count: moverCount,
    first: opensACard(data, kind),
    kind,
    mover: moverSpec(data, streams, footprintOf(data, kind), movement),
  });
  for (const kind of kinds) {
    const movement = moverMovement(data, random, zone.moverShare, kind);
    if (movement === null) {
      count(quotas, kind);
    } else if (movement.kind === "step") {
      steppers.push(moverQuota(kind, movement, 1));
    } else {
      movers.set(kind, { count: (movers.get(kind)?.count ?? 0) + 1, movement });
    }
  }
  return [
    ...[...movers].map(([kind, { count: moverCount, movement }]) =>
      moverQuota(kind, movement, moverCount),
    ),
    ...steppers,
    ...[...quotas].map(([kind, kindCount]) => ({
      blocksLane: blocksLane(data, kind),
      count: kindCount,
      first: opensACard(data, kind),
      footprint: footprintOf(data, kind),
      kind,
    })),
    {
      blocksLane: false,
      count: scaled("tipSpawns", stats.tips),
      kind: "tip",
      moversPassOver: true,
      moversRestOn: true,
    },
    {
      blocksLane: false,
      count: scaled("treatSpawns", stats.treats),
      kind: "treat",
      moversPassOver: true,
    },
  ];
}

// Plans the run's current zone: its spawns, each obstacle and lucky encounter drawn by the
// zone's weights.
export function planZone(
  data: WalkData,
  geometry: Pick<
    RoadGeometry,
    | "cell"
    | "itemHeights"
    | "laneCount"
    | "lens"
    | "packBand"
    | "roadBottom"
    | "roadTop"
    | "sightLength"
    | "tallestPackBand"
  >,
  streams: PlannerStreams,
  walk: Walk,
): Walk {
  const { road, run } = walk;
  const length = zoneLength(data);
  // Each lane-blocking kind's drawn hit length, standing and moving, for the pack-fit gap.
  const withHitLengths = (quotas: SpawnQuota<WalkItemKind>[]) =>
    quotas.map((quota) =>
      !quota.blocksLane
        ? quota
        : {
            ...quota,
            hitLength: itemHeight(data, geometry, quota.kind, false),
            ...(quota.mover === undefined
              ? {}
              : {
                  mover: {
                    ...quota.mover,
                    hitLength: itemHeight(data, geometry, quota.kind, true),
                  },
                }),
          },
    );
  const firstContact = firstContactSeconds(data, run);
  // The zone's minor obstacles that never move, which one with no room is swapped among.
  const fixedKinds = minorObstacleWeights(data, run)
    .filter(([kind]) => movementOf(data, kind) === null)
    .map(([kind, weight]) => ({
      footprint: footprintOf(data, kind),
      hitLength: itemHeight(data, geometry, kind, false),
      kind,
      weight,
    }));
  const plan = {
    cellInset: plannedCellInset(data, geometry),
    cellLength: geometry.cell.length,
    ...(firstContact === undefined ? {} : { firstContactSeconds: firstContact }),
    fixedKinds,
    laneCount: geometry.laneCount,
    laneInset: geometry.cell.inset,
    // The slowest pack's lane move sets the row spacing, so every pack fits every gap.
    laneMoveSeconds: read(data.tuning, "seconds", "laneMove") / slowestPackAgility(data),
    maxEmptyRows: read(data.tuning, "counts", "maxEmptyRows"),
    minOpenLanes: read(data.tuning, "counts", "openLanesPerRowMin"),
    minSpacing: read(data.tuning, "pixels", "spawnRowSpacing"),
    moverCaps: {
      darts: read(data.tuning, "counts", "maxDartMovers"),
      slowVehicles: read(data.tuning, "counts", "maxSlowVehicles"),
      total: read(data.tuning, "counts", "maxMovers"),
    },
    // The tallest pack's hit boxes, inside its outline by PART_INSET at each end.
    packHitLength: geometry.tallestPackBand - 2 * PART_INSET,
    packLength: geometry.tallestPackBand,
    // A Muddy pack's lane move, the slowest, spaces the path's lane changes: a puddle may be on
    // any neighbourhood's road, and Muddy may last past a neighbourhood's end.
    pathLaneMoveSeconds: read(data.tuning, "seconds", "laneMove") / slowestDebuffedAgility(data),
    // The path goes on from where the last zone's ends, or starts in the pack's lane.
    pathStart: road.path[road.path.length - 1]?.lane ?? road.control.target,
    quotas: withHitLengths(spawnQuotas(data, streams, run)),
    reactionSeconds: read(data.tuning, "seconds", "pathReactionMargin"),
    roadLength: geometry.roadBottom - geometry.roadTop,
    scrollSpeed: walkScrollSpeed(data, run),
    sightLength: geometry.sightLength,
    stepSeconds: STEP_SECONDS,
    zoneLength: length,
  };
  const planned = plan.quotas.map(({ count, kind, mover }) => ({
    count,
    kind,
    movement: mover?.movement ?? null,
  }));
  const { events, path } = planSpawns(streams, plan);
  return { road: { ...road, path, pending: events, planned }, run };
}

// Steering during a hit stop is dropped, not queued.
export function steerWalk(
  data: Pick<GameData, "debuffs" | "dogs" | "tuning" | "walkers">,
  laneCount: number,
  direction: LaneDirection,
  walk: Walk,
): Walk {
  if (walk.road.hitStop !== null) {
    return walk;
  }
  const config = laneMotionConfig(data, laneCount, walk.run);
  const control = steerLane(config, direction, walk.road.control);
  return { ...walk, road: { ...walk.road, control } };
}

const PLACED_PARTS = new WeakMap<object, Map<string, readonly PlacedPart[]>>();

// The sprites an obstacle draws, standing or moving, with their silhouettes.
export function obstacleOnRoad(
  data: Pick<GameData, "encounters" | "minorObstacles">,
  geometry: Pick<RoadGeometry, "cell">,
  kind: ObstacleKind,
  moving: boolean,
): readonly PlacedPart[] {
  let byKind = PLACED_PARTS.get(data);
  if (byKind === undefined) {
    byKind = new Map();
    PLACED_PARTS.set(data, byKind);
  }
  const key = `${geometry.cell.length} ${kind} ${moving}`;
  let parts = byKind.get(key);
  if (parts === undefined) {
    const { lanes } = footprintOf(data, kind);
    parts = obstacleParts(data, hasObstacleArt, kind, moving).map(({ behind, dx, key: art }) => ({
      behind,
      dx,
      silhouette: obstacleSilhouette(geometry.cell.length, lanes, art),
    }));
    byKind.set(key, parts);
  }
  return parts;
}

// By lens, then the pack band's bottom, then the parts.
const EXIT_LENGTHS = new WeakMap<object, Map<number, Map<readonly PlacedPart[], number>>>();

// An obstacle's hit length: how far its drawn hit box runs up the road from its near edge as it
// leaves the pack's band (exitLength), so its rows overlap the band exactly while its drawn hit
// box does. Anything else's is its item height.
export function itemHeight(
  data: Pick<GameData, "encounters" | "minorObstacles">,
  geometry: Pick<RoadGeometry, "cell" | "itemHeights" | "lens" | "packBand">,
  kind: WalkItemKind,
  moving: boolean,
): number {
  if (!isObstacle(data, kind)) {
    const category = itemCategory(data, kind) as Exclude<ItemCategory, "minor" | "obstacle">;
    return geometry.itemHeights[category];
  }
  const parts = obstacleOnRoad(data, geometry, kind, moving);
  const { bottom } = geometry.packBand;
  let byBottom = EXIT_LENGTHS.get(geometry.lens);
  if (byBottom === undefined) {
    byBottom = new Map();
    EXIT_LENGTHS.set(geometry.lens, byBottom);
  }
  let lengths = byBottom.get(bottom);
  if (lengths === undefined) {
    lengths = new Map();
    byBottom.set(bottom, lengths);
  }
  let length = lengths.get(parts);
  if (length === undefined) {
    length = exitLength(geometry.lens, PART_INSET, parts, bottom);
    lengths.set(parts, length);
  }
  return length;
}

// The planner's inset at each end of a footprint row: whatever lane-blocking obstacle stands in
// a footprint, standing or moving, its hit length is no more than the footprint's rows less this
// at each end, so every blocking span it plans covers the obstacle's. Negative where an obstacle
// is drawn longer than its rows.
export function plannedCellInset(
  data: Pick<GameData, "encounters" | "minorObstacles">,
  geometry: Pick<RoadGeometry, "cell" | "itemHeights" | "lens" | "packBand">,
): number {
  const kinds = [
    ...Object.keys(data.minorObstacles),
    ...Object.keys(data.encounters).filter((kind) => blocksLane(data, kind as EncounterId)),
  ] as ObstacleKind[];
  const { length } = geometry.cell;
  const over = Math.max(
    ...kinds.flatMap((kind) =>
      (movementOf(data, kind) === null ? [false] : [false, true]).map(
        (moving) =>
          itemHeight(data, geometry, kind, moving) - (footprintOf(data, kind).rows - 1) * length,
      ),
    ),
  );
  return (length - over) / 2;
}

function isPickup(kind: WalkItemKind): kind is PickupKind {
  return kind === "tip" || kind === "treat";
}

// How many lanes beside the pack's a pickup is collected from: tipReach and treatReach
// modifiers, such as Long reach's.
export function pickupReach(
  data: Pick<GameData, "tuning">,
  run: Pick<RunState, "modifiers">,
  kind: PickupKind,
): number {
  const stat = kind === "treat" ? "treatReach" : "tipReach";
  return Math.round(modifiedStat(data.tuning, run.modifiers, stat, 0));
}

// A tip pays what tips are worth now, with its causes.
export function collectTip(
  data: WalkData,
  run: RunState,
): { readonly run: RunState; readonly tip: MoneyChange } {
  const tip = tipValue(data, run);
  return { run: { ...run, money: addCents(run.money, tip.amount) }, tip };
}

// A treat grabbed: the dog's owner gains hearts.treat, up to their max.
function grabTreat(data: WalkData, dog: DogId, run: RunState): ReturnType<typeof changeHearts> {
  return changeHearts(
    data,
    [{ amount: read(data.tuning, "hearts", "treat"), kind: "treat" }],
    dog,
    run,
  );
}

// A minor bump costs the dog's owner the hearts a bump costs now (bumpParts), with the value
// modifiers changed: hearts.bump's loss, changed by bumpHearts modifiers, then cut by a forgiving
// one such as Second chance's. While a debuff such as Spotlight makes bumps cost cash and there is
// cash, it costs that cash too (bumpCash), which nothing forgives. Each change is null when it
// changed nothing.
function bumpDog(
  data: WalkData,
  dog: DogId,
  run: RunState,
): {
  readonly cash: MoneyChange | null;
  readonly change: HeartChange | null;
  readonly modified: readonly (ModifiedValue | null)[];
  readonly state: RunState;
} {
  const parts = bumpParts(data, run);
  const bumped = changeHearts(data, [{ amount: -parts.value, kind: "bump" }], dog, run);
  const cash = bumpCash(data, bumped.state);
  const state =
    cash === null
      ? bumped.state
      : { ...bumped.state, money: addCents(bumped.state.money, cash.amount) };
  const paid = cash === null ? null : changeModified(cash);
  if (bumped.change === null) {
    return { cash, change: null, modified: [paid], state };
  }
  const raised = modifierCauses(parts.contributions).map((cause) => ({
    ...cause,
    amount: -cause.amount,
  }));
  const by = [...raised, ...modifierCausesOf(bumped.change)];
  const base = -read(data.tuning, "hearts", "bump");
  const hearts = modifiedValue({ dog, kind: "hearts" }, base, by);
  return { cash, change: bumped.change, modified: [hearts, paid], state };
}

// The pack's place across the road, in road pixels from its left edge: the walker's lane
// centre, moving linearly between lanes.
function packX(cellLength: number, laneCount: number, motion: LaneMotion): number {
  const centres = Array.from({ length: laneCount }, (_, lane) => (lane + 0.5) * cellLength);
  return laneMotionX(centres, motion);
}

// The pack's outline and hit rectangles swept across the road from its place in one motion to
// its place in another: each spans every place between, so a quick lane change passes nothing
// by between two steps. The walking dogs' rectangles are in pack order.
export function sweptPackBoxes(
  geometry: Pick<RoadGeometry, "cell" | "laneCount" | "lens" | "packParts">,
  from: LaneMotion,
  to: LaneMotion,
  run: Pick<RunState, "pack">,
): PackBoxes<DogId> {
  const fromX = packX(geometry.cell.length, geometry.laneCount, from);
  const toX = packX(geometry.cell.length, geometry.laneCount, to);
  const across = <Part extends Box>(part: Part): Part => ({
    ...part,
    left: Math.min(fromX, toX) + part.left,
    right: Math.max(fromX, toX) + part.right,
  });
  const { packParts } = geometry;
  return {
    centreX: geometry.lens.centreX,
    dogs: formationOrder(packDogs(run)).map((dog, index): DogBox<DogId> => ({
      ...across(itemAt(packParts.dogs, index)),
      dog,
    })),
    outline: across(packParts.outline),
    walker: across(packParts.walker),
  };
}

// The pack's outline and hit rectangles at its place on the road.
export function packBoxes(
  geometry: Pick<RoadGeometry, "cell" | "laneCount" | "lens" | "packParts">,
  motion: LaneMotion,
  run: Pick<RunState, "pack">,
): PackBoxes<DogId> {
  return sweptPackBoxes(geometry, motion, motion, run);
}

// Each stalker whose next step is due to be chosen, as its cue begins or, with no cue, as it
// starts, chooses that step toward the pack where it is now (approach.ts): the pack's centre,
// across from where its lane motion has it and half way down its band, and the stalker's centre
// as the step starts.
function stalkersStepped(
  geometry: Pick<RoadGeometry, "cell" | "laneCount" | "packBand" | "roadTop">,
  motion: LaneMotion,
  items: readonly WalkItem[],
): WalkItem[] {
  const { cell, laneCount, packBand, roadTop } = geometry;
  const pack = {
    x: packX(cell.length, laneCount, motion),
    y: (packBand.top + packBand.bottom) / 2,
  };
  return items.map((item) => {
    const { mover } = item;
    if (mover?.path.motion !== "approach") {
      return item;
    }
    let path: ApproachPath = mover.path;
    for (let choice = nextChoiceAt(path); choice !== null && mover.since >= choice;) {
      const at = nextStepAt(path) ?? choice;
      const place = moverPlace(laneCount, path, at);
      const centre = {
        x: (place.lanePosition + item.laneSpan / 2) * cell.length,
        y: roadTop - item.height / 2 + place.travel,
      };
      path = takeStep(
        path,
        nearestStep(cell.length, centre, pack, approachChoices(path), path.burst),
      );
      choice = nextChoiceAt(path);
    }
    return path === mover.path ? item : { ...item, mover: { ...mover, path } };
  });
}

// Each shy hopper whose next hop is due to be chosen, as its cue begins or, with no cue, as it
// starts, chooses that hop away from the pack where it is now (shy.ts): the pack's centre, across
// from where its lane motion has it and half way down its band, with the lanes it is in or moving
// into, and the hopper's centre as the hop starts.
function shyHopped(
  geometry: Pick<RoadGeometry, "cell" | "laneCount" | "packBand" | "roadTop">,
  motion: LaneMotion,
  items: readonly WalkItem[],
): WalkItem[] {
  const { cell, laneCount, packBand, roadTop } = geometry;
  const pack = {
    lanes: motion.kind === "still" ? [motion.lane] : [motion.from, motion.to],
    x: packX(cell.length, laneCount, motion),
    y: (packBand.top + packBand.bottom) / 2,
  };
  return items.map((item) => {
    const { mover } = item;
    if (mover?.path.motion !== "shy") {
      return item;
    }
    let path: ShyPath = mover.path;
    for (let choice = nextShyChoiceAt(path); choice !== null && mover.since >= choice;) {
      const place = moverPlace(laneCount, path, path.pending[0] ?? choice);
      const centre = {
        x: (place.lanePosition + item.laneSpan / 2) * cell.length,
        y: roadTop - item.height / 2 + place.travel,
      };
      path = takeHop(path, awayHop(cell.length, centre, pack, shyChoices(path), path.burst));
      choice = nextShyChoiceAt(path);
    }
    return path === mover.path ? item : { ...item, mover: { ...mover, path } };
  });
}

// The lane an item's footprint starts on: a mover's continuous place across the lanes, so one
// between lanes touches what is beside it in both, and anything else's lane.
function footprintLane(laneCount: number, item: WalkItem): number {
  const { mover } = item;
  return mover === undefined
    ? item.lane
    : moverPlace(laneCount, mover.path, mover.since).lanePosition;
}

// An item's footprint box on the road: its lanes less the inset at each side, along its height.
export function walkItemBox(
  geometry: Pick<RoadGeometry, "cell" | "laneCount">,
  item: WalkItem,
): Box {
  return itemBox(geometry.cell, { ...item, lane: footprintLane(geometry.laneCount, item) });
}

// The box an obstacle hits the pack's parts with, in the lanes of its footprint: as it is drawn
// (drawnObstacleBox), from its sprites standing on its near edge across from the middle of the
// lanes it is drawn over (drawnLanes for a mover).
export function obstacleHitBox(
  data: Pick<GameData, "encounters" | "minorObstacles">,
  geometry: Pick<RoadGeometry, "cell" | "itemHeights" | "laneCount" | "lens" | "packBand">,
  item: WalkItem,
): LanedBox {
  if (!isObstacle(data, item.kind)) {
    throw new Error(`${item.kind} is not an obstacle`);
  }
  const { cell, lens } = geometry;
  const feetY = item.y + item.height;
  const lane = footprintLane(geometry.laneCount, item);
  const lanes = { left: lane * cell.length, right: (lane + item.laneSpan) * cell.length };
  const { mover } = item;
  const drawn = mover === undefined ? item.laneSpan : drawnLanes(item.laneSpan, mover.path);
  const parts = obstacleOnRoad(data, geometry, item.kind, mover !== undefined);
  const x = (lane + drawn / 2) * cell.length;
  return { ...drawnObstacleBox(lens, PART_INSET, parts, { feetY, x }), lanes };
}

// The chance a plain hit landing on the dog misses it: probability.smallDodgeChance for a small
// dog, plus the chance of each dodge effect in play whose sizes hold the dog's, at most 1.
function dodgeChance(
  data: Pick<GameData, "dogs" | "tuning">,
  run: Pick<RunState, "dodges">,
  dog: DogId,
): number {
  const { size } = data.dogs[dog];
  const own = size === "small" ? read(data.tuning, "probability", "smallDodgeChance") : 0;
  const added = run.dodges
    .filter(({ sizes }) => sizes.includes(size))
    .reduce((sum, dodge) => sum + read(data.tuning, "probability", dodge.chance), 0);
  return Math.min(1, own + added);
}

// Whether the dog dodges the hit landing on it, at its dodgeChance. A dog with no chance draws
// nothing from random.
function dodges(
  data: Pick<GameData, "dogs" | "tuning">,
  random: Random,
  run: Pick<RunState, "dodges">,
  dog: DogId,
): boolean {
  const odds = dodgeChance(data, run, dog);
  return odds > 0 && chance(random, odds);
}

// The front dog, the first walking dog in formation order.
function frontDog(run: RunState): DogId {
  const [front] = formationOrder(packDogs(run));
  if (front === undefined) {
    throw new Error("A hit needs a walking dog");
  }
  return front;
}

// One fixed step of walking. Scrolls the road at the zone's speed, brings spawns into view,
// moves the pack, then collides: tips and treats are grabbed, a plain obstacle costs the
// owner of the dog it lands on a heart unless the dog dodges it, card obstacles (outside
// the grace window) become cards for the pack, and lucky finds apply at once. An obstacle the
// pack is immune to is harmless: it is removed, and nothing else happens. A plain hit or an
// obstacle with a hit moment starts a hit stop, and the steps it lasts hold everything still.
// random draws for dodges. Does nothing unless walking.
export function stepWalk(
  data: WalkData,
  geometry: RoadGeometry,
  random: Random,
  stepSeconds: number,
  walk: Walk,
): WalkStep {
  const { road, run } = walk;
  if (run.phase.kind !== "walking") {
    return stillStep(NOTHING_HELD, walk);
  }
  if (road.hitStop !== null) {
    const ticked = tickHitStop(stepSeconds, road.hitStop);
    return "stop" in ticked
      ? stillStep(NOTHING_HELD, { road: { ...road, hitStop: ticked.stop }, run })
      : stillStep(ticked.released, { road: { ...road, hitStop: null }, run });
  }
  const length = zoneLength(data);
  // The step stops at the end of the zone.
  let zoneDistance: number = run.zoneDistance;
  let zoneEnded = false;
  if (stepSeconds > 0) {
    const step = walkScrollSpeed(data, run) * road.speedFactor * stepSeconds;
    zoneEnded = !(step < length - zoneDistance);
    zoneDistance = zoneEnded ? length : zoneDistance + step;
  }
  const travel = zoneDistance - run.zoneDistance;

  const due = takeDueSpawns(zoneDistance, road.pending);
  let nextItemId = road.nextItemId;
  const arrived = due.due.map((event): WalkItem => {
    const height = itemHeight(data, geometry, event.kind, event.mover !== undefined);
    return {
      height,
      id: nextItemId++,
      kind: event.kind,
      lane: event.lane,
      laneSpan: footprintOf(data, event.kind).lanes,
      ...(event.mover === undefined
        ? {}
        : { mover: { path: event.mover, since: zoneDistance - event.distance } }),
      y: geometry.roadTop - height + (zoneDistance - event.distance),
    };
  });
  const scrolled = scrolledItems(geometry, travel, road.items, moveMovers(geometry, 0, arrived));

  const control = advanceLaneControl(
    laneMotionConfig(data, geometry.laneCount, run),
    stepSeconds,
    road.control,
  );
  const { cues, pickups } = scrolled;
  const solid = shyHopped(
    geometry,
    control.motion,
    stalkersStepped(geometry, control.motion, scrolled.solid),
  );
  // Swept from where the last step left the pack to where this one leaves it.
  const pack = sweptPackBoxes(geometry, road.control.motion, control.motion, run);
  // An obstacle hits a part of the pack; a lucky find, as a pickup does, touches its outline.
  const touching = (item: WalkItem) =>
    isObstacle(data, item.kind)
      ? hitDog(pack, obstacleHitBox(data, geometry, item))
      : pickupDog(pack, walkItemBox(geometry, item));
  const invulnerable = tickInvulnerability(stepSeconds, road.invulnerableSeconds);
  // A pull obstacle, such as a squirrel, passes through the pack: touching it does nothing.
  const passing = solid.filter((item) => isPullObstacle(data, item.kind));
  const { hits, invulnerableSeconds, remaining } = collideWithPack(
    collisionRules(data, run),
    touching,
    invulnerable,
    passing.length === 0 ? solid : solid.filter((item) => !passing.includes(item)),
  );
  // A pickup reached past its lanes, by Long reach, goes to the front dog.
  // A pickup the pack's outline misses was grabbed by reach alone.
  const byReach: WalkItem[] = [];
  const pickupsHit = pickups.flatMap((item): { dog: DogId; item: WalkItem }[] => {
    const reach = pickupReach(data, run, item.kind as PickupKind) * geometry.cell.length;
    const box: Box = walkItemBox(geometry, item);
    const reached = overlaps(pack.outline, {
      ...box,
      left: box.left - reach,
      right: box.right + reach,
    });
    if (reached && reach > 0 && !overlaps(pack.outline, box)) {
      byReach.push(item);
    }
    return reached ? [{ dog: pickupDog(pack, box) ?? frontDog(run), item }] : [];
  });

  // Timed debuffs count down on walking steps only, so a hit stop or a card holds them.
  let nextRun: RunState = { ...tickDebuffs(stepSeconds, run), zoneDistance: pixels(zoneDistance) };
  const bumps: MinorBump[] = [];
  const cards: EncounterCard[] = [];
  const collected: WalkItem[] = [];
  const contacts: ContactHit[] = [];
  const instants: InstantFind[] = [];
  const modified: RoadModified[] = [];
  const tips: MoneyChange[] = [];
  const treats: TreatGrab[] = [];
  const modifiedAt = (item: WalkItem, values: readonly (ModifiedValue | null)[]) => {
    for (const value of values) {
      if (value !== null) {
        modified.push({ item, value });
      }
    }
  };
  const meet = ({ dog, item }: { dog: DogId; item: WalkItem }): void => {
    const { kind } = item;
    if (isPickup(kind) && byReach.includes(item)) {
      modifiedAt(item, [reachModified(data, run, kind)]);
    }
    if (kind === "tip") {
      const pickup = collectTip(data, nextRun);
      nextRun = countTally("tips", pickup.run);
      tips.push(pickup.tip);
      collected.push(item);
      modifiedAt(item, [changeModified(pickup.tip)]);
    } else if (kind === "treat") {
      const recipient = treatRecipient(data, nextRun, dog);
      const grab = grabTreat(data, recipient, countTally("treats", nextRun));
      nextRun = grab.state;
      treats.push({ change: grab.change, dog: recipient, item });
      collected.push(item);
      modifiedAt(item, [grab.change === null ? null : changeModified(grab.change)]);
    } else if (isMinorObstacle(data, kind)) {
      const minor = { ...item, kind };
      if (dodges(data, random, nextRun, dog)) {
        // Every dog's dodge counts toward the dodges tally, a dodge effect's included.
        nextRun = countTally("dodges", nextRun);
        bumps.push({ cash: null, change: null, dodged: true, dog, item: minor });
        return;
      }
      const bump = bumpDog(data, dog, countBump(nextRun));
      nextRun = countLandedBump(kind, bump.state);
      bumps.push({ cash: bump.cash, change: bump.change, dodged: false, dog, item: minor });
      modifiedAt(item, bump.modified);
    } else {
      const affected = affectedDogs(run);
      if (!opensCard(affected, run, kind)) {
        const immunity =
          affected.length === 0
            ? undefined
            : run.immunities.find(({ encounter }) => encounter === kind);
        if (immunity !== undefined) {
          const by = [modifierCause(-1, immunity.source)];
          modifiedAt(item, [modifiedValue({ encounter: kind, kind: "immune" }, 1, by)]);
        }
        return;
      }
      const { resolution } = data.encounters[kind];
      if (resolution.kind === "instant" || resolution.kind === "contact") {
        const outcome = applyInstantEncounter(data, nextRun, kind, affected);
        nextRun = outcome.state;
        if (resolution.kind === "instant") {
          nextRun = countTally(resolution.tally, nextRun);
          instants.push({ encounter: kind, outcome });
        } else {
          contacts.push({ dog, encounter: kind, item, outcome });
        }
        modifiedAt(item, outcome.modified);
      } else if (resolution.kind === "card") {
        cards.push({ affected, encounter: kind, kind: "encounter" });
      }
    }
  };
  const meetAll = (met: readonly { dog: DogId; item: WalkItem }[]): void => {
    for (const each of met) {
      if (nextRun.phase.kind === "ended") {
        break;
      }
      meet(each);
    }
  };
  // The hits land first. An owner they left at 0 hearts fires you before the pickups, so a
  // treat cannot save them; with no dogs left the walk ends.
  meetAll(hits);
  const firing = fireOwnersAtZero(nextRun);
  nextRun =
    firing.fired.length > 0 && packDogs(firing.state).length === 0
      ? { ...firing.state, phase: { kind: "ended", reason: "noDogs" } }
      : firing.state;
  meetAll(pickupsHit);
  // A card met this step affects only the dogs still walking after its hits.
  const walking = packDogs(nextRun);
  const stepCards = cards.map((card): EncounterCard => ({
    ...card,
    affected: card.affected.filter((dog) => walking.includes(dog)),
  }));
  const encounterHits = stepCards.filter(
    (card) => hitLabel(data.encounters[card.encounter]) !== null,
  );
  const hitStop = startHitStop(
    false,
    hitStopLength(
      {
        encounter: read(data.tuning, "seconds", "hitStopSeconds"),
        minor: read(data.tuning, "seconds", "minorHitStopSeconds"),
      },
      {
        encounters: encounterHits.length,
        minors: bumps.filter(({ dodged }) => !dodged).length + contacts.length,
      },
    ),
    { cards: stepCards, zoneEnded },
  );
  return {
    bumps,
    cards: hitStop === null ? stepCards : [],
    collected,
    contacts,
    encounterHits,
    fired: firing.fired,
    instants,
    modified,
    tips,
    treats,
    walk: {
      road: {
        ...road,
        control,
        hitStop,
        invulnerableSeconds,
        items: [
          ...remaining,
          ...passing,
          ...cues,
          ...(pickupsHit.length === 0
            ? pickups
            : pickups.filter((item) => !pickupsHit.some((hit) => hit.item === item))),
        ],
        nextItemId,
        pending: due.pending,
      },
      run: nextRun,
    },
    zoneEnded: hitStop === null && zoneEnded,
  };
}

interface SortedItems {
  readonly cues: WalkItem[];
  readonly pickups: WalkItem[];
  readonly solid: WalkItem[];
}

// The road's items, in order, after the road scrolls travel, then the items arriving: each
// moved down by travel, each mover moved on by it, and the crossers that have left the road
// and whatever has scrolled wholly past its bottom dropped. They are sorted into the movers
// that are still only a cue, which cannot be hit, the pickups, and the solid items, which can.
function scrolledItems(
  geometry: RoadGeometry,
  travel: number,
  items: readonly WalkItem[],
  arrived: readonly WalkItem[],
): SortedItems {
  const { laneCount, roadBottom, roadTop } = geometry;
  const sorted: SortedItems = { cues: [], pickups: [], solid: [] };
  for (const item of items) {
    const { mover } = item;
    if (mover === undefined) {
      const y = item.y + travel;
      if (y < roadBottom) {
        sortItem(laneCount, sorted, { ...item, y });
      }
      continue;
    }
    const since = mover.since + travel;
    const place = moverPlace(laneCount, mover.path, since);
    const y = roadTop - item.height + place.travel;
    if (!hasLeftRoad(laneCount, place) && y < roadBottom) {
      const lane = laneAt(place.lanePosition);
      sortItem(laneCount, sorted, { ...item, lane, mover: { ...mover, since }, y });
    }
  }
  for (const item of arrived) {
    if (item.y < roadBottom) {
      sortItem(laneCount, sorted, item);
    }
  }
  return sorted;
}

function sortItem(laneCount: number, sorted: SortedItems, item: WalkItem): void {
  const cue = isWarning(laneCount, item);
  if (cue) {
    sorted.cues.push(item);
  }
  if (isPickup(item.kind)) {
    sorted.pickups.push(item);
  } else if (!cue) {
    sorted.solid.push(item);
  }
}

function opensFor(run: RunState, encounter: EncounterId): boolean {
  return opensCard(affectedDogs(run), run, encounter);
}

// Obstacles are graced. A hit that opens no card is scenery: it counts no bump and starts no
// grace window.
function collisionRules(data: WalkData, run: RunState): CollisionRules<WalkItem> {
  return {
    graced: (item) => isObstacle(data, item.kind),
    invulnerabilitySeconds: read(data.tuning, "seconds", "collisionGrace"),
    startsInvulnerability: ({ kind }) =>
      isMinorObstacle(data, kind) || opensFor(run, kind as EncounterId),
  };
}

const NOTHING_HELD: HeldStep = { cards: [], zoneEnded: false };

// A step in which the walk does not move, giving out only what it held.
function stillStep(held: HeldStep, walk: Walk): WalkStep {
  return {
    bumps: [],
    cards: [...held.cards],
    collected: [],
    contacts: [],
    encounterHits: [],
    fired: [],
    instants: [],
    modified: [],
    tips: [],
    treats: [],
    walk,
    zoneEnded: held.zoneEnded,
  };
}

// The end of a zone: every dog still walking is paid, each debuff
// on counts the zone, the effects that lasted the zone expire, then the run moves to the next
// position, whose zone the fork picks, or ends once the walk's last zone is done.
export function finishZone(data: WalkData, run: RunState): ZoneEnd {
  const { changes, state: paid } = payZone(data, run);
  const expired = expireAtZoneEnd(run.zoneIndex, paid);
  if (run.zoneIndex >= walkLength(data) - 1) {
    const bonus = fullPackBonus(data, expired);
    return {
      fees: [...changes, ...bonus.changes],
      run: { ...bonus.state, phase: { kind: "ended", reason: "finished" } },
    };
  }
  return {
    fees: changes,
    run: {
      ...expired,
      cardsThisZone: 0,
      heartsForgiven: 0,
      skipUsed: false,
      zoneDistance: pixels(0),
      zoneIndex: run.zoneIndex + 1,
    },
  };
}

// Heading home keeps the money banked; the current zone pays nothing.
export function headHome(run: RunState): RunState {
  return { ...run, phase: { kind: "ended", reason: "wentHome" } };
}
