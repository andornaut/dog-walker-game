import { itemAt } from "../arrays";
import { ROAD_HIT_SIZE } from "../assets/spriteKeys";
import type {
  DogId,
  EncounterId,
  GameData,
  MinorObstacleId,
  Movement,
  ObstacleEncounterId,
} from "../data/types";
import type { LaneDirection } from "../layout/lanes";
import { dogHitCentre, hitPackPlacements } from "../layout/packFormation";
import { countBump } from "../rules/achievements";
import type { HeartChange, MoneyChange } from "../rules/causes";
import { applyInstantEncounter, type ChoiceOutcome } from "../rules/choices";
import { expireAtZoneEnd, tickDebuffs } from "../rules/durations";
import { changeHearts } from "../rules/effects";
import { affectedDogs, hitLabel, opensCard } from "../rules/encounters";
import { modifiedStat } from "../rules/modifiers";
import { currentZone, walkLength } from "../rules/route";
import {
  debuffModifiers,
  fireOwnersAtZero,
  fullPackBonus,
  packModifiers,
  payZone,
  tipValue,
} from "../rules/run";
import { addCents, type Pixels, pixels, read } from "../rules/units";
import { packAgility, slowestAgility } from "../rules/walkers";
import { zoneScrollSpeed, zoneStats } from "../rules/zones";
import { packDogs } from "../state/pack";
import type { CardSource, RunState } from "../state/runState";
import {
  type Box,
  collideWithPack,
  type CollisionRules,
  type DogBox,
  dogsTouching,
  itemBox,
  tickInvulnerability,
} from "./collision";
import { STEP_SECONDS } from "./fixedStep";
import { type HeldStep, type HitStop, hitStopLength, startHitStop, tickHitStop } from "./hitStop";
import { advanceLaneControl, type LaneControl, laneControlIn, steerLane } from "./laneControl";
import { type LaneMotion, type LaneMotionConfig, laneMotionX, stillInLane } from "./laneMotion";
import {
  hasLeftRoad,
  isWarning,
  laneAt,
  moveMovers,
  type MoverFootprint,
  type MoverItem,
  type MoverMotion,
  moverPlace,
  type MoverSpec,
  type StepShape,
} from "./movers";
import { chance, type Random, randomPick } from "./random";
import {
  type Footprint,
  hitLength,
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
  | "minorObstacles"
  | "runText"
  | "shopGear"
  | "tuning"
  | "upgrades"
  | "walkerPerks"
  | "walkers"
  | "world"
>;

export type PickupKind = "tip" | "treat";
export type WalkItemKind = EncounterId | MinorObstacleId | PickupKind;
export type WalkItem = MoverItem<WalkItemKind>;
// What a road item is to the rules: an obstacle hit by accident, a minor obstacle that opens
// no card, a lucky encounter, or a pickup.
export type ItemCategory = "lucky" | "minor" | "obstacle" | PickupKind;

// Everything on the road that the run state does not hold. pending is this zone's spawns
// not yet in view, at zone distances. speedFactor scales the scroll speed, for testing.
// hitStop is set while an obstacle hit holds the walk still. tipCredit is the share of a tip
// owed toward the next tip due: a tipSpawns debuff owes less than a whole tip for each one, so
// only some come into view.
export interface Road {
  control: LaneControl;
  hitStop: HitStop | null;
  invulnerableSeconds: number;
  items: readonly WalkItem[];
  nextItemId: number;
  pending: readonly SpawnEvent<WalkItemKind>[];
  speedFactor: number;
  tipCredit: number;
}

export interface Walk {
  road: Road;
  run: RunState;
}

// Flat road pixels, where y grows toward the walker and the pack stands at scale 1, before
// the pseudo-3D projection draws them. packBand is the current pack's; tallestPackBand is any
// pack's, so spawns stay avoidable whoever walks. An obstacle's footprint is cell.length per
// lane and row, and its hit box the footprint less cell.inset at each end; itemHeights are
// everything else's. roadTop is the far edge of the road in view, where spawns come into
// view, and sightLength the road in view above the tallest pack.
export interface RoadGeometry {
  cell: { inset: number; length: number };
  itemHeights: Readonly<Record<"lucky" | PickupKind, number>>;
  laneCount: number;
  packBand: { bottom: number; top: number };
  roadBottom: number;
  roadTop: number;
  sightLength: number;
  tallestPackBand: number;
  walkerFootY: number;
}

// A lucky encounter that applied on contact, with no card.
export interface InstantFind {
  encounter: EncounterId;
  outcome: ChoiceOutcome;
}

// A minor obstacle the pack bumped: the dog it landed on, and the hearts its owner lost, or
// null with none to lose. A small dog it would land on dodges it at
// probability.smallDodgeChance, and loses nothing.
export interface MinorBump {
  change: HeartChange | null;
  dodged: boolean;
  dog: DogId;
  item: WalkItem;
}

// A treat a dog grabbed: the hearts its owner gained, or null at their max.
export interface TreatGrab {
  change: HeartChange | null;
  dog: DogId;
  item: WalkItem;
}

export type EncounterCard = Extract<CardSource, { kind: "encounter" }>;

// bumps, cards, instants and treats are in the order the pack met them; tips are the money
// changes of the tips collected; fired the owners a bump left at 0 hearts; zoneEnded is set on
// the step that reaches the end of the zone. encounterHits are the obstacles met this step,
// which play a hit moment. A hit stop holds the step's cards and zone end back to the step it
// ends on.
export interface WalkStep {
  bumps: MinorBump[];
  cards: CardSource[];
  collected: WalkItem[];
  encounterHits: EncounterCard[];
  fired: readonly DogId[];
  instants: InstantFind[];
  tips: MoneyChange[];
  treats: TreatGrab[];
  walk: Walk;
  zoneEnded: boolean;
}

// A zone's end: fees are the zone's pay, banked, and after the last zone the Full pack bonus;
// run is the run after it.
export interface ZoneEnd {
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
  if (kind === "tip" || kind === "treat") {
    return kind;
  }
  return isMinorObstacle(data, kind) ? "minor" : data.encounters[kind].kind;
}

// The lanes and rows an item covers: an obstacle's shape, or one cell.
export function footprintOf(
  data: Pick<GameData, "encounters" | "minorObstacles">,
  kind: WalkItemKind,
): Footprint {
  if (kind === "tip" || kind === "treat") {
    return SINGLE_CELL;
  }
  if (isMinorObstacle(data, kind)) {
    return data.minorObstacles[kind].shape;
  }
  const encounter = data.encounters[kind];
  return encounter.kind === "obstacle" ? encounter.shape : SINGLE_CELL;
}

// What the pack steers around: obstacles, minor or not.
export function blocksLane(
  data: Pick<GameData, "encounters" | "minorObstacles">,
  kind: WalkItemKind,
): boolean {
  const category = itemCategory(data, kind);
  return category === "minor" || category === "obstacle";
}

// The last lane move time, scroll speed and zone length worked out, with the data groups and
// run fields they were worked out from. A walk asks for the same ones every step until its
// pack, zone or modifiers or the data change; data and run states are never changed in place.
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

// How long one lane move takes: seconds.laneMove over the pack's agility, then the laneMove
// modifiers.
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
    last.runDebuffs === run.debuffs &&
    last.runModifiers === run.modifiers
  ) {
    return last.seconds;
  }
  const base = read(data.tuning, "seconds", "laneMove") / packAgility(data, run);
  const seconds = modifiedStat(data.tuning, packModifiers(data, run), "laneMove", base);
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
    pending: [],
    speedFactor,
    tipCredit: 0,
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

// The movement a drawn spawn moves with: an obstacle, minor or not, with a movement comes as a
// mover at a chance of share. Other spawns never move and draw nothing, as does any spawn at a
// share of 0.
export function moverMovement(
  data: Pick<GameData, "encounters" | "minorObstacles">,
  random: Random,
  share: number,
  kind: WalkItemKind,
): MovingMovement | null {
  const category = itemCategory(data, kind);
  if ((category !== "minor" && category !== "obstacle") || share <= 0) {
    return null;
  }
  const entry = isMinorObstacle(data, kind)
    ? data.minorObstacles[kind]
    : data.encounters[kind as EncounterId];
  const movement = "movement" in entry ? entry.movement : undefined;
  if (movement === undefined || movement.kind === "still") {
    return null;
  }
  return chance(random, share) ? movement : null;
}

// A movement that moves.
type MovingMovement = Exclude<Movement, { kind: "still" }>;

// A step: a lane to either side, or a row toward the pack or away.
const STEPS: readonly StepShape[] = [
  { lanes: -1, travel: 0 },
  { lanes: 1, travel: 0 },
  { lanes: 0, travel: 1 },
  { lanes: 0, travel: -1 },
];

// How a mover moves, by its movement and the tuning. A stepper's steps are drawn here, with
// their mirror image as the other way it may go: the planner takes whichever keeps the road
// passable.
export function moverSpec(
  data: Pick<GameData, "tuning">,
  random: Random,
  footprint: MoverFootprint,
  movement: MovingMovement,
): MoverSpec {
  const { tuning } = data;
  let motion: MoverMotion;
  if (movement.kind === "dart") {
    motion = {
      kind: "cross",
      lanesPerSecond: read(tuning, "counts", "dartLanesPerSecond"),
      tilt: movement.tilt ?? 0,
    };
  } else if (movement.kind === "inLane") {
    motion = { kind: "ride", speedMultiplier: movement.factor };
  } else {
    const steps = Array.from({ length: movement.steps }, () => randomPick(random, STEPS));
    const mirrored = steps.map(({ lanes, travel }) => ({ lanes: -lanes as -1 | 0 | 1, travel }));
    motion = {
      kind: "steps",
      sequences: [steps, mirrored],
      stepSeconds: read(tuning, "seconds", "moverStepSeconds"),
    };
  }
  return {
    footprint,
    motion,
    movement: movement.kind,
    warningSeconds: read(tuning, "seconds", "moverWarningSeconds"),
  };
}

// Each obstacle, minor obstacle and lucky find is drawn first by the zone's weights, so its
// shape is known when it is placed. Rush hour and the like scale both obstacle counts, and the
// pack's size and the like scale the tips. Then each obstacle whose look moves comes as a mover at the zone's
// mover share: one quota per kind, and one per stepper, whose steps are its own.
function spawnQuotas(data: WalkData, random: Random, run: RunState): SpawnQuota<WalkItemKind>[] {
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
  const movers = new Map<WalkItemKind, number>();
  const steppers: SpawnQuota<WalkItemKind>[] = [];
  const count = <Key>(map: Map<Key, number>, key: Key) => map.set(key, (map.get(key) ?? 0) + 1);
  const moverQuota = (kind: WalkItemKind, movement: MovingMovement, moverCount: number) => ({
    blocksLane: true,
    count: moverCount,
    kind,
    mover: moverSpec(data, random, footprintOf(data, kind), movement),
  });
  const movements = new Map<WalkItemKind, MovingMovement>();
  for (const kind of kinds) {
    const movement = moverMovement(data, random, zone.moverShare, kind);
    if (movement === null) {
      count(quotas, kind);
    } else if (movement.kind === "step") {
      steppers.push(moverQuota(kind, movement, 1));
    } else {
      movements.set(kind, movement);
      count(movers, kind);
    }
  }
  return [
    ...[...movers].flatMap(([kind, moverCount]) => {
      const movement = movements.get(kind);
      return movement === undefined ? [] : [moverQuota(kind, movement, moverCount)];
    }),
    ...steppers,
    ...[...quotas].map(([kind, kindCount]) => ({
      blocksLane: blocksLane(data, kind),
      count: kindCount,
      footprint: footprintOf(data, kind),
      kind,
    })),
    { blocksLane: false, count: scaled("tipSpawns", stats.tips), kind: "tip" },
    { blocksLane: false, count: scaled("treatSpawns", stats.treats), kind: "treat" },
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
    | "roadBottom"
    | "roadTop"
    | "sightLength"
    | "tallestPackBand"
  >,
  random: Random,
  walk: Walk,
): Walk {
  const { road, run } = walk;
  const length = zoneLength(data);
  const plan = {
    cellInset: geometry.cell.inset,
    cellLength: geometry.cell.length,
    laneCount: geometry.laneCount,
    // The slowest walker's lane move sets the row spacing, so every walker fits every gap:
    // big dogs never slow the pack below it.
    laneMoveSeconds: read(data.tuning, "seconds", "laneMove") / slowestAgility(data),
    minOpenLanes: read(data.tuning, "counts", "openLanesPerRowMin"),
    minSpacing: read(data.tuning, "pixels", "spawnRowSpacing"),
    moverCaps: {
      darts: read(data.tuning, "counts", "maxDartMovers"),
      slowVehicles: read(data.tuning, "counts", "maxSlowVehicles"),
      total: read(data.tuning, "counts", "maxMovers"),
    },
    packLength: geometry.tallestPackBand,
    quotas: spawnQuotas(data, random, run),
    reactionSeconds: read(data.tuning, "seconds", "pathReactionMargin"),
    roadLength: geometry.roadBottom - geometry.roadTop,
    scrollSpeed: walkScrollSpeed(data, run),
    sightLength: geometry.sightLength,
    stepSeconds: STEP_SECONDS,
    zoneLength: length,
  };
  return { road: { ...road, pending: planSpawns(random, plan), tipCredit: 0 }, run };
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

// An obstacle's hit box is as long as its rows less the inset at each end.
export function itemHeight(
  data: Pick<GameData, "encounters" | "minorObstacles">,
  geometry: Pick<RoadGeometry, "cell" | "itemHeights">,
  kind: WalkItemKind,
): number {
  const category = itemCategory(data, kind);
  return category === "minor" || category === "obstacle"
    ? hitLength(
        { cellInset: geometry.cell.inset, cellLength: geometry.cell.length },
        footprintOf(data, kind).rows,
      )
    : geometry.itemHeights[category];
}

export function isPickup(kind: WalkItemKind): kind is PickupKind {
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
export function grabTreat(
  data: WalkData,
  dog: DogId,
  run: RunState,
): ReturnType<typeof changeHearts> {
  return changeHearts(
    data,
    [{ amount: read(data.tuning, "hearts", "treat"), kind: "treat" }],
    dog,
    run,
  );
}

// A minor bump costs the dog's owner hearts.bump, changed by bumpHearts modifiers such as
// Muddy's.
export function bumpDog(
  data: WalkData,
  dog: DogId,
  run: RunState,
): ReturnType<typeof changeHearts> {
  const hearts = modifiedStat(
    data.tuning,
    packModifiers(data, run),
    "bumpHearts",
    read(data.tuning, "hearts", "bump"),
  );
  return changeHearts(data, [{ amount: -hearts, kind: "bump" }], dog, run);
}

// The pack's place across the road, in road pixels from its left edge: the walker's lane
// centre, moving linearly between lanes.
function packX(cellLength: number, laneCount: number, motion: LaneMotion): number {
  const centres = Array.from({ length: laneCount }, (_, lane) => (lane + 0.5) * cellLength);
  return laneMotionX(centres, motion);
}

// Each walking dog's hit box, in pack order: a ROAD_HIT_SIZE square centred on its place in the
// hit formation around the pack's place on the road.
export function dogBoxes(
  geometry: Pick<RoadGeometry, "cell" | "laneCount" | "walkerFootY">,
  motion: LaneMotion,
  run: Pick<RunState, "pack">,
): DogBox<DogId>[] {
  const dogs = packDogs(run);
  const placements = hitPackPlacements(dogs.length);
  const x = packX(geometry.cell.length, geometry.laneCount, motion);
  const half = ROAD_HIT_SIZE / 2;
  return dogs.map((dog, index): DogBox<DogId> => {
    const centre = dogHitCentre(itemAt(placements, index));
    const cx = x + centre.dx;
    const cy = geometry.walkerFootY + centre.dy;
    return { bottom: cy + half, dog, left: cx - half, right: cx + half, top: cy - half };
  });
}

// An item's hit box on the road: a mover's from its continuous place across the lanes, so one
// between lanes touches what is beside it in both, and anything else's from its lane.
function walkItemBox(geometry: Pick<RoadGeometry, "cell" | "laneCount">, item: WalkItem): Box {
  const { mover } = item;
  if (mover === undefined) {
    return itemBox(geometry.cell, item);
  }
  const place = moverPlace(geometry.laneCount, mover.path, mover.since);
  return itemBox(geometry.cell, { ...item, lane: place.lanePosition });
}

// Whether a small dog dodges the hit landing on it, at probability.smallDodgeChance.
function dodges(data: Pick<GameData, "dogs" | "tuning">, random: Random, dog: DogId): boolean {
  return (
    data.dogs[dog].size === "small" &&
    chance(random, read(data.tuning, "probability", "smallDodgeChance"))
  );
}

// The dog a hit or a grab lands on. While the pack changes lanes, a side hit lands on the dog
// touching it, the front one of those touching; otherwise, head-on, on the front dog, the
// first walking dog in pack order. touching is in pack order.
function landsOn(motion: LaneMotion, run: RunState, touching: readonly DogId[]): DogId {
  const [front] = motion.kind === "moving" && touching.length > 0 ? touching : packDogs(run);
  if (front === undefined) {
    throw new Error("A hit needs a walking dog");
  }
  return front;
}

// The share of the tips due that come into view while the pack's debuffs change tipSpawns,
// such as half while Stinky. Other tipSpawns modifiers set the zone's tip count when it is
// planned.
function tipSpawnsShare(data: WalkData, run: RunState): number {
  if (run.debuffs.length === 0) {
    return 1;
  }
  return modifiedStat(data.tuning, debuffModifiers(data, run), "tipSpawns", 1);
}

// Each due tip adds share to the credit, and comes into view only once a whole tip is owed.
// Other spawns always come into view.
export function thinTips<Kind extends string>(
  share: number,
  credit: number,
  events: readonly SpawnEvent<Kind>[],
): { readonly credit: number; readonly events: SpawnEvent<Kind>[] } {
  let owed = credit;
  const kept = events.filter((event) => {
    if (event.kind !== "tip") {
      return true;
    }
    owed += share;
    // A whole tip less a rounding error, so a share such as 0.1 still adds up to one.
    if (owed < 1 - 1e-9) {
      return false;
    }
    owed -= 1;
    return true;
  });
  return { credit: owed, events: kept };
}

// One frame of walking. Scrolls the road at the zone's speed, brings spawns into view,
// moves the pack, then collides: tips and treats are grabbed, a plain obstacle costs the
// owner of the dog it lands on a heart unless a small dog dodges it, card obstacles (outside
// the grace window) become cards for the pack, and lucky finds apply at once. An obstacle the
// pack is immune to is harmless: it is removed, and nothing else happens. A plain hit or an
// obstacle with a hit moment starts a hit stop, and the steps it lasts hold everything still.
// random draws for dodges and instant finds' effects. Does nothing unless walking.
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
  const thinned = thinTips(tipSpawnsShare(data, run), road.tipCredit, due.due);
  let nextItemId = road.nextItemId;
  const arrived = thinned.events.map((event): WalkItem => {
    const height = itemHeight(data, geometry, event.kind);
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
  const { cues, pickups, solid } = scrolledItems(
    geometry,
    travel,
    road.items,
    moveMovers(geometry, 0, arrived),
  );

  const control = advanceLaneControl(
    laneMotionConfig(data, geometry.laneCount, run),
    stepSeconds,
    road.control,
  );
  const boxes = dogBoxes(geometry, control.motion, run);
  const touching = (item: WalkItem) => dogsTouching(boxes, walkItemBox(geometry, item));
  const invulnerable = tickInvulnerability(stepSeconds, road.invulnerableSeconds);
  const { hits, invulnerableSeconds, remaining } = collideWithPack(
    collisionRules(data, run),
    touching,
    invulnerable,
    solid,
  );
  // A pickup reached past its lanes, by Long reach, goes to the front dog: its dogs are only
  // those touching it in its own lanes.
  const pickupsHit = pickups.flatMap((item): { dogs: DogId[]; item: WalkItem }[] => {
    const reach = pickupReach(data, run, item.kind as PickupKind) * geometry.cell.length;
    const box: Box = walkItemBox(geometry, item);
    const reached = dogsTouching(boxes, {
      ...box,
      left: box.left - reach,
      right: box.right + reach,
    });
    return reached.length === 0 ? [] : [{ dogs: touching(item), item }];
  });

  // Timed debuffs count down on walking steps only, so a hit stop or a card holds them.
  let nextRun: RunState = { ...tickDebuffs(stepSeconds, run), zoneDistance: pixels(zoneDistance) };
  const bumps: MinorBump[] = [];
  const cards: CardSource[] = [];
  const collected: WalkItem[] = [];
  const encounterHits: EncounterCard[] = [];
  const instants: InstantFind[] = [];
  const tips: MoneyChange[] = [];
  const treats: TreatGrab[] = [];
  for (const { dogs, item } of [...hits, ...pickupsHit]) {
    const { kind } = item;
    if (kind === "tip") {
      const pickup = collectTip(data, nextRun);
      nextRun = pickup.run;
      tips.push(pickup.tip);
      collected.push(item);
    } else if (kind === "treat") {
      const dog = landsOn(control.motion, nextRun, dogs);
      const grab = grabTreat(data, dog, nextRun);
      nextRun = grab.state;
      treats.push({ change: grab.change, dog, item });
      collected.push(item);
    } else if (isMinorObstacle(data, kind)) {
      const dog = landsOn(control.motion, nextRun, dogs);
      if (dodges(data, random, dog)) {
        bumps.push({ change: null, dodged: true, dog, item });
        continue;
      }
      const bump = bumpDog(data, dog, countBump(nextRun));
      nextRun = bump.state;
      bumps.push({ change: bump.change, dodged: false, dog, item });
    } else {
      const affected = affectedDogs(run);
      if (!opensCard(affected, run, kind)) {
        continue;
      }
      if (data.encounters[kind].resolution.kind === "instant") {
        const outcome = applyInstantEncounter(data, random, nextRun, kind, affected);
        nextRun = outcome.state;
        instants.push({ encounter: kind, outcome });
      } else {
        const card: EncounterCard = { affected, encounter: kind, kind: "encounter" };
        if (hitLabel(data.encounters[kind]) !== null) {
          encounterHits.push(card);
        }
        cards.push(card);
      }
    }
  }
  // An owner a bump left at 0 hearts fires you; with no dogs left the walk ends.
  const firing = fireOwnersAtZero(nextRun);
  nextRun =
    firing.fired.length > 0 && packDogs(firing.state).length === 0
      ? { ...firing.state, phase: { kind: "ended", reason: "noDogs" } }
      : firing.state;
  const hitStop = startHitStop(
    hitStopLength(
      {
        encounter: read(data.tuning, "seconds", "hitStopSeconds"),
        minor: read(data.tuning, "seconds", "minorHitStopSeconds"),
      },
      { encounters: encounterHits.length, minors: bumps.filter(({ dodged }) => !dodged).length },
    ),
    { cards, zoneEnded },
  );
  return {
    bumps,
    cards: hitStop === null ? cards : [],
    collected,
    encounterHits,
    fired: firing.fired,
    instants,
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
          ...cues,
          ...(pickupsHit.length === 0
            ? pickups
            : pickups.filter((item) => !pickupsHit.some((hit) => hit.item === item))),
        ],
        nextItemId,
        pending: due.pending,
        tipCredit: thinned.credit,
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
    graced: (item) => blocksLane(data, item.kind),
    invulnerabilitySeconds: read(data.tuning, "seconds", "collisionGrace"),
    startsInvulnerability: ({ kind }) =>
      kind === "tip" ||
      kind === "treat" ||
      isMinorObstacle(data, kind) ||
      opensFor(run, kind as EncounterId),
  };
}

const NOTHING_HELD: HeldStep = { cards: [], zoneEnded: false };

// A step in which the walk does not move, giving out only what it held.
function stillStep(held: HeldStep, walk: Walk): WalkStep {
  return {
    bumps: [],
    cards: [...held.cards],
    collected: [],
    encounterHits: [],
    fired: [],
    instants: [],
    tips: [],
    treats: [],
    walk,
    zoneEnded: held.zoneEnded,
  };
}

// The end of a zone: every dog still walking is paid at the zone's fee multiplier, each debuff
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
