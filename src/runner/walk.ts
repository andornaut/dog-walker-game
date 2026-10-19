import type {
  DogId,
  EncounterId,
  ForcedStopId,
  GameData,
  MinorObstacleId,
  NeedSpotId,
  ObstacleEncounterId,
  QuirkId,
} from "../data/types";
import type { LaneDirection } from "../layout/lanes";
import { countBump, countDebuffZones } from "../rules/achievements";
import type { MoneyChange } from "../rules/causes";
import { applyInstantEncounter, type ChoiceOutcome } from "../rules/choices";
import { expireAtZoneEnd, tickDebuffs } from "../rules/durations";
import { affectedDogs, hitLabel, hoppingDogs, opensCard } from "../rules/encounters";
import { modifiedStat } from "../rules/modifiers";
import { currentZone, walkLength } from "../rules/route";
import { debuffModifiers, minorBump, packModifiers, payZoneFees, tipValue } from "../rules/run";
import { addCents, type Pixels, pixels, read, readTable } from "../rules/units";
import { zoneScrollSpeed, zoneStats } from "../rules/zones";
import { packDogs } from "../state/pack";
import type { CardSource, RunState } from "../state/runState";
import {
  collideWithPack,
  type CollisionRules,
  type PackFootprint,
  tickInvulnerability,
  touchesPack,
} from "./collision";
import { STEP_SECONDS } from "./fixedStep";
import { type HeldStep, type HitStop, hitStopLength, startHitStop, tickHitStop } from "./hitStop";
import {
  advanceLaneControl,
  type LaneControl,
  laneControlIn,
  lockOnArrival,
  lockSteering,
  steerLane,
} from "./laneControl";
import { type LaneMotionConfig, occupiedLanes, stillInLane } from "./laneMotion";
import {
  isMoverObstacle,
  isWarning,
  moveMovers,
  MOVER_CONTACTS,
  type MoverItem,
  type MoverKind,
  type MoverObstacleId,
  type MoverSpec,
} from "./movers";
import { isNeedSpot } from "./needs";
import { chance, type Random, randomInt, randomPick } from "./random";
import { itemsOnRoad, scrollRoadItems } from "./roadItems";
import {
  type Footprint,
  hitLength,
  planSpawns,
  rowSpacing,
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
  | "forcedStops"
  | "minorObstacles"
  | "needCards"
  | "needs"
  | "needSpots"
  | "quirks"
  | "runText"
  | "shopGear"
  | "tuning"
  | "upgrades"
  | "walkers"
  | "world"
>;

export type PickupKind = "tip" | "treat";
export type WalkItemKind =
  EncounterId | MinorObstacleId | MoverObstacleId | NeedSpotId | PickupKind;
export type WalkItem = MoverItem<WalkItemKind>;
// What a road item is to the rules: an obstacle hit by accident, a minor obstacle that opens
// no card, a lucky encounter, a spot that meets a need, or a pickup.
export type ItemCategory = "lucky" | "minor" | "needSpot" | "obstacle" | PickupKind;

// distance is the zone distance at which the stop comes into view at the top of the road.
export interface ForcedStopAhead {
  distance: number;
  stop: ForcedStopId;
}

// A forced stop spans the whole road, so the pack meets it whatever lane it is in.
export interface ForcedStopOnRoad {
  stop: ForcedStopId;
  y: number;
}

// Everything on the road that the run state does not hold. pending is this zone's spawns
// not yet in view, at zone distances. speedFactor scales the scroll speed, for testing.
// hitStop is set while an obstacle hit holds the walk still. tipCredit is the share of a tip
// owed toward the next tip due: a tipSpawns debuff owes less than a whole tip for each one, so
// only some come into view.
export interface Road {
  control: LaneControl;
  forcedStopAhead: ForcedStopAhead | null;
  forcedStopOnRoad: ForcedStopOnRoad | null;
  forcedStopsSeen: readonly ForcedStopId[];
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
  itemHeights: Readonly<Record<"forcedStop" | "lucky" | "needSpot" | PickupKind, number>>;
  laneCount: number;
  packBand: { bottom: number; top: number };
  roadBottom: number;
  roadTop: number;
  sightLength: number;
  tallestPackBand: number;
}

// A lucky encounter that applied on contact, with no card.
export interface InstantFind {
  encounter: EncounterId;
  outcome: ChoiceOutcome;
}

// A minor obstacle the pack bumped: the tips it dropped, or null with nothing to drop.
export interface MinorBump {
  change: MoneyChange | null;
  item: WalkItem;
}

export type EncounterCard = Extract<CardSource, { kind: "encounter" }>;

// An area effect (skunk, puddle) the pack touched with no immunity keeping it off: the dogs it
// caught, and the dogs that hopped over it. One that caught no dog opens no card.
export interface AreaContact {
  caught: readonly DogId[];
  encounter: EncounterId;
  hopped: readonly DogId[];
}

// bumps, cards and instants are in the order the pack met them; tips are the money changes of
// the tips collected; spots the need spots steered into, which stepNeeds meets; zoneEnded is
// set on the step that reaches the end of the zone.
// encounterHits are the encounters met this step that play a hit moment: obstacles, and lucky
// cards with a hit label. areaContacts are the area effects the pack touched, caught or
// hopped. A hit stop holds the step's cards and zone end back to the step it ends on.
export interface WalkStep {
  areaContacts: AreaContact[];
  bumps: MinorBump[];
  cards: CardSource[];
  collected: WalkItem[];
  encounterHits: EncounterCard[];
  instants: InstantFind[];
  spots: WalkItem[];
  tips: MoneyChange[];
  walk: Walk;
  zoneEnded: boolean;
}

// A zone's end: the fee each dog was paid, and the run after it.
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
  data: Pick<GameData, "encounters" | "minorObstacles" | "needSpots">,
  kind: WalkItemKind,
): ItemCategory {
  if (kind === "tip" || kind === "treat") {
    return kind;
  }
  if (isNeedSpot(data, kind)) {
    return "needSpot";
  }
  if (isMoverObstacle(kind)) {
    return "minor";
  }
  return isMinorObstacle(data, kind) ? "minor" : data.encounters[kind].kind;
}

// The lanes and rows an item covers: an obstacle's shape, or one cell.
export function footprintOf(
  data: Pick<GameData, "encounters" | "minorObstacles" | "needSpots">,
  kind: WalkItemKind,
): Footprint {
  if (kind === "tip" || kind === "treat" || isMoverObstacle(kind) || isNeedSpot(data, kind)) {
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
  data: Pick<GameData, "encounters" | "minorObstacles" | "needSpots">,
  kind: WalkItemKind,
): boolean {
  const category = itemCategory(data, kind);
  return category === "minor" || category === "obstacle";
}

// Whether a walking dog in the run has the quirk.
export function packHasQuirk(
  data: Pick<GameData, "dogs">,
  run: Pick<RunState, "pack">,
  quirk: QuirkId,
): boolean {
  return packDogs(run).some((dog) => data.dogs[dog].quirk === quirk);
}

// How long one lane move takes: seconds.laneMove, sledDogLaneSpeed times faster while a sled
// dog walks, then the laneMove modifiers, such as Spooked's.
export function laneMoveSeconds(
  data: Pick<GameData, "debuffs" | "dogs" | "tuning">,
  run: Pick<RunState, "debuffs" | "modifiers" | "pack">,
): number {
  const move = read(data.tuning, "seconds", "laneMove");
  const base = packHasQuirk(data, run, "sledDog")
    ? move / read(data.tuning, "multipliers", "sledDogLaneSpeed")
    : move;
  return modifiedStat(data.tuning, packModifiers(data, run), "laneMove", base);
}

// How long lane input stays locked once a lane change the player made arrives, such as
// Tangled's: 0 without a laneChangeLock modifier.
export function laneChangeLockSeconds(
  data: Pick<GameData, "debuffs" | "tuning">,
  run: Pick<RunState, "debuffs" | "modifiers">,
): number {
  return Math.max(0, modifiedStat(data.tuning, packModifiers(data, run), "laneChangeLock", 0));
}

export function laneMotionConfig(
  data: Pick<GameData, "debuffs" | "dogs" | "tuning">,
  laneCount: number,
  run: Pick<RunState, "debuffs" | "modifiers" | "pack">,
): LaneMotionConfig {
  return { laneCount, moveDuration: laneMoveSeconds(data, run) };
}

// Pixels per second in the run's current zone, read from the live data, after the run's
// modifiers, such as the walker's pace.
export function walkScrollSpeed(data: Pick<GameData, "tuning" | "world">, run: RunState): Pixels {
  const base = zoneScrollSpeed(data.tuning, currentZone(data, run), run.zoneIndex);
  return pixels(modifiedStat(data.tuning, run.modifiers, "scrollSpeed", base));
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

// Every zone is the distance the base speed covers in zoneAtBaseSpeed, before modifiers such as
// an upgrade or the walker's pace.
export function zoneLength(data: Pick<GameData, "tuning">, run: RunState): Pixels {
  const base =
    read(data.tuning, "pixels", "roadScrollSpeed") *
    read(data.tuning, "seconds", "zoneAtBaseSpeed");
  return pixels(modifiedStat(data.tuning, run.modifiers, "zoneLength", base));
}

export function startRoad(laneCount: number, speedFactor = 1): Road {
  return {
    control: laneControlIn(stillInLane(Math.floor(laneCount / 2))),
    forcedStopAhead: null,
    forcedStopOnRoad: null,
    forcedStopsSeen: [],
    hitStop: null,
    invulnerableSeconds: 0,
    items: [],
    nextItemId: 0,
    pending: [],
    speedFactor,
    tipCredit: 0,
  };
}

// The chance weights of the obstacles: the current zone's, where each small dog draws other
// dogs more often and each big dog less.
export function obstacleWeights(
  data: Pick<GameData, "dogs" | "tuning" | "world">,
  run: RunState,
): [ObstacleEncounterId, number][] {
  const sizes = packDogs(run).map((dog) => data.dogs[dog].size);
  const count = (size: string) => sizes.filter((candidate) => candidate === size).length;
  const otherDog =
    1 +
    count("small") * read(data.tuning, "multipliers", "otherDogChangePerSmallDog") +
    count("big") * read(data.tuning, "multipliers", "otherDogChangePerBigDog");
  const { obstacles } = currentZone(data, run).weights;
  return positiveWeights({
    ...obstacles,
    otherDog: obstacles.otherDog * Math.max(0, otherDog),
  });
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

// The kinds that always come as a mover, whatever the zone's mover share.
export const ALWAYS_MOVERS: Readonly<Partial<Record<WalkItemKind, MoverKind>>> = {
  goose: "goose",
};

// The mover a drawn spawn comes as: a goose always, drawing nothing; otherwise at a chance of
// share, a squirrel darts, an other dog runs loose, and a minor obstacle is a ball or a
// cyclist, evenly. Other spawns never move, and draw nothing, as does any spawn at a share of 0.
export function moverFor(
  data: Pick<GameData, "minorObstacles">,
  random: Random,
  share: number,
  kind: WalkItemKind,
): MoverKind | null {
  const always = ALWAYS_MOVERS[kind];
  if (always !== undefined) {
    return always;
  }
  const minor = kind !== "tip" && kind !== "treat" && isMinorObstacle(data, kind);
  if (
    !(kind === "squirrel" || kind === "otherDog" || minor) ||
    share <= 0 ||
    !chance(random, share)
  ) {
    return null;
  }
  if (kind === "squirrel") {
    return "squirrel";
  }
  return kind === "otherDog" ? "looseDog" : randomPick(random, ["ball", "cyclist"] as const);
}

export function moverSpec(data: Pick<GameData, "tuning">, mover: MoverKind): MoverSpec {
  const { tuning } = data;
  const cross = (lanesPerSecond: number) => ({ kind: "cross", lanesPerSecond }) as const;
  const motions = {
    ball: () => cross(read(tuning, "counts", "ballLanesPerSecond")),
    cyclist: () =>
      ({
        kind: "ride",
        speedMultiplier: read(tuning, "multipliers", "cyclistSpeedMultiplier"),
      }) as const,
    goose: () => cross(read(tuning, "counts", "gooseLanesPerSecond")),
    looseDog: () => cross(read(tuning, "counts", "looseDogLanesPerSecond")),
    squirrel: () => cross(read(tuning, "counts", "squirrelDartLanesPerSecond")),
  };
  return {
    motion: motions[mover](),
    mover,
    warningSeconds: read(tuning, "seconds", "moverWarningSeconds"),
  };
}

// The weights the zone's need spots are drawn by: the zone's, for the spots that meet a need
// in the pack, so none is wasted on a need nobody has. A crowd pleaser in the pack multiplies
// the stranger spots' weights by crowdPleaserStrangerWeight.
export function needSpotWeights(
  data: Pick<GameData, "dogs" | "needSpots" | "tuning" | "world">,
  run: RunState,
): [NeedSpotId, number][] {
  const needs = new Set(packDogs(run).map((dog) => data.dogs[dog].need));
  const crowd = packHasQuirk(data, run, "crowdPleaser")
    ? read(data.tuning, "multipliers", "crowdPleaserStrangerWeight")
    : 1;
  return positiveWeights(currentZone(data, run).weights.needSpots)
    .filter(([spot]) => needs.has(data.needSpots[spot].need))
    .map(([spot, weight]) => [
      spot,
      data.needSpots[spot].stranger === true ? weight * crowd : weight,
    ]);
}

// Each obstacle, minor obstacle, lucky find and need spot is drawn first by the zone's
// weights, so its shape is known when it is placed. Rush hour and the like scale both obstacle
// counts, the walker's pace scales the obstacles, tips and need spots, and the pack's size and
// the like scale the tips. Then each squirrel, other dog and minor obstacle comes as a mover at
// the zone's mover share, and each goose as a mover always.
function spawnQuotas(data: WalkData, random: Random, run: RunState): SpawnQuota<WalkItemKind>[] {
  const zone = currentZone(data, run);
  const stats = zoneStats(data.tuning, zone, run.zoneIndex);
  const tipSpawnsBySize = readTable(
    data.tuning,
    "multipliers",
    "tipSpawnsByPackSize",
    packDogs(run).length as keyof WalkData["tuning"]["multipliers"]["tipSpawnsByPackSize"],
  );
  const scaled = (stat: "needSpotSpawns" | "obstacleSpawns" | "tipSpawns", base: number) =>
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
    ...drawn(
      scaled("needSpotSpawns", read(data.tuning, "counts", "needSpotsPerZone")),
      needSpotWeights(data, run),
    ),
  ];
  const quotas = new Map<WalkItemKind, number>();
  const movers = new Map<MoverKind, number>();
  const count = <Key>(map: Map<Key, number>, key: Key) => map.set(key, (map.get(key) ?? 0) + 1);
  for (const kind of kinds) {
    const mover = moverFor(data, random, zone.moverShare, kind);
    if (mover === null) {
      count(quotas, kind);
    } else {
      count(movers, mover);
    }
  }
  return [
    ...[...movers].map(([mover, moverCount]) => ({
      blocksLane: true,
      count: moverCount,
      kind: MOVER_CONTACTS[mover],
      mover: moverSpec(data, mover),
    })),
    ...[...quotas].map(([kind, kindCount]) => ({
      blocksLane: blocksLane(data, kind),
      count: kindCount,
      footprint: footprintOf(data, kind),
      kind,
    })),
    { blocksLane: false, count: scaled("tipSpawns", stats.tips * tipSpawnsBySize), kind: "tip" },
    { blocksLane: false, count: stats.treats, kind: "treat" },
  ];
}

// Plans the run's current zone: its spawns, each obstacle and lucky encounter drawn, and
// its forced stop, drawn by the zone's weights from those not yet met this run (from all of
// them once every one has been met) and placed midway between two
// rows in the middle third of the zone.
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
  const length = zoneLength(data, run);
  const plan = {
    cellInset: geometry.cell.inset,
    cellLength: geometry.cell.length,
    laneCount: geometry.laneCount,
    laneMoveSeconds: read(data.tuning, "seconds", "laneMove"),
    minOpenLanes: read(data.tuning, "counts", "openLanesPerRowMin"),
    minSpacing: read(data.tuning, "pixels", "spawnRowSpacing"),
    packLength: geometry.tallestPackBand,
    quotas: spawnQuotas(data, random, run),
    roadLength: geometry.roadBottom - geometry.roadTop,
    scrollSpeed: walkScrollSpeed(data, run),
    sightLength: geometry.sightLength,
    stepSeconds: STEP_SECONDS,
    zoneLength: length,
  };
  const pending = planSpawns(random, plan);
  const spacing = rowSpacing(plan);

  const stops = positiveWeights(currentZone(data, run).weights.forcedStops);
  const unseen = stops.filter(([stop]) => !road.forcedStopsSeen.includes(stop));
  const stop = pickWeighted(random, unseen.length > 0 ? unseen : stops);
  // Rows are at spacing x 1..rows; the stop goes after row `after`, before the next row.
  const rows = Math.max(2, Math.floor(length / spacing) - 1);
  const first = Math.floor(rows / 3);
  const after = randomInt(random, first, Math.max(first + 1, Math.ceil((2 * rows) / 3))) + 1;
  return {
    road: {
      ...road,
      forcedStopAhead: { distance: (Math.min(after, rows - 1) + 0.5) * spacing, stop },
      forcedStopsSeen: [...road.forcedStopsSeen, stop],
      pending,
      tipCredit: 0,
    },
    run,
  };
}

// Steering during a hit stop is dropped, not queued. A lane change that takes starts the
// laneChangeLock once the pack arrives, as a pull's lock does.
export function steerWalk(
  data: Pick<GameData, "debuffs" | "dogs" | "tuning">,
  laneCount: number,
  direction: LaneDirection,
  walk: Walk,
): Walk {
  if (walk.road.hitStop !== null) {
    return walk;
  }
  const config = laneMotionConfig(data, laneCount, walk.run);
  const steered = steerLane(config, direction, walk.road.control);
  const lock = steered === walk.road.control ? 0 : laneChangeLockSeconds(data, walk.run);
  const control = lock > 0 ? lockOnArrival(lock, steered) : steered;
  return { ...walk, road: { ...walk.road, control } };
}

// An obstacle's hit box is as long as its rows less the inset at each end.
export function itemHeight(
  data: Pick<GameData, "encounters" | "minorObstacles" | "needSpots">,
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

// How many lanes beside the pack's a pickup is collected from: treatReach modifiers, such as
// Treat magnet, reach for treats, and a scent hound in the pack reaches scentHoundLanes for
// tips.
export function pickupReach(
  data: Pick<GameData, "dogs" | "tuning">,
  run: Pick<RunState, "modifiers" | "pack">,
  kind: PickupKind,
): number {
  if (kind === "treat") {
    return Math.round(modifiedStat(data.tuning, run.modifiers, "treatReach", 0));
  }
  return packHasQuirk(data, run, "scentHound") ? read(data.tuning, "counts", "scentHoundLanes") : 0;
}

// The scent hounds walking when the step collected a tip from beside the pack's lanes, which
// only their reach collects.
export function sniffersOf(
  data: Pick<GameData, "dogs">,
  walk: Walk,
  collected: readonly WalkItem[],
): DogId[] {
  const lanes = occupiedLanes(walk.road.control.motion);
  const beside = collected.some(
    (item) =>
      item.kind === "tip" &&
      !lanes.some((lane) => lane >= item.lane && lane < item.lane + item.laneSpan),
  );
  return beside ? packDogs(walk.run).filter((dog) => data.dogs[dog].quirk === "scentHound") : [];
}

// Lanes within reach of the pack's, clamped to the road.
function widenLanes(laneCount: number, reach: number, lanes: readonly number[]): number[] {
  const widened = new Set<number>();
  for (const lane of lanes) {
    for (let offset = -reach; offset <= reach; offset++) {
      const target = lane + offset;
      if (target >= 0 && target < laneCount) {
        widened.add(target);
      }
    }
  }
  return [...widened];
}

// A tip pays what tips are worth now, with its causes; a treat is carried, up to the carry
// limit.
export function collect(
  data: WalkData,
  kind: PickupKind,
  run: RunState,
): { readonly run: RunState; readonly tip: MoneyChange | null } {
  if (kind === "tip") {
    const tip = tipValue(data, run);
    return { run: { ...run, money: addCents(run.money, tip.amount) }, tip };
  }
  return {
    run: {
      ...run,
      treats: Math.min(read(data.tuning, "counts", "treatCarryMax"), run.treats + 1),
    },
    tip: null,
  };
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
// moves the pack, then collides: pickups are collected into the run, minor obstacles drop
// tips and lock lane input, obstacles (outside the grace window) and lucky encounters become
// cards for the dogs they affect or, for an instant lucky find, apply at once, and a forced
// stop that reaches the pack always becomes a card. An obstacle that opens no card is
// scenery: it is removed, and nothing else happens. A minor bump or an encounter with a hit
// moment starts a hit stop, and the steps it lasts hold everything still. random draws only
// for an instant find's effects. Does nothing unless walking.
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
  const length = zoneLength(data, run);
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
  const items = itemsOnRoad(geometry.roadBottom, [
    ...moveMovers(geometry, travel, scrollRoadItems(travel, road.items)),
    ...moveMovers(geometry, 0, arrived),
  ]);

  let forcedStopAhead = road.forcedStopAhead;
  let forcedStopOnRoad =
    road.forcedStopOnRoad === null
      ? null
      : { ...road.forcedStopOnRoad, y: road.forcedStopOnRoad.y + travel };
  if (forcedStopAhead !== null && forcedStopAhead.distance <= zoneDistance) {
    forcedStopOnRoad = {
      stop: forcedStopAhead.stop,
      y:
        geometry.roadTop -
        geometry.itemHeights.forcedStop +
        (zoneDistance - forcedStopAhead.distance),
    };
    forcedStopAhead = null;
  }

  let control = advanceLaneControl(
    laneMotionConfig(data, geometry.laneCount, run),
    stepSeconds,
    road.control,
  );
  const lanes = occupiedLanes(control.motion);
  const footprint: PackFootprint = { ...geometry.packBand, lanes };
  // A mover is only a cue until it moves, and cannot be hit.
  const cues = items.filter((item) => isWarning(geometry.laneCount, item));
  const solid = items.filter((item) => !isPickup(item.kind) && !cues.includes(item));
  const invulnerable = tickInvulnerability(stepSeconds, road.invulnerableSeconds);
  // With nothing touching the pack, nothing is hit and the window only ticks.
  const { hits, invulnerableSeconds, remaining } = solid.some((item) =>
    touchesPack(footprint, item),
  )
    ? collideWithPack(collisionRules(data, run), footprint, invulnerable, solid)
    : { hits: [], invulnerableSeconds: invulnerable, remaining: solid };
  const pickups = items.filter((item) => isPickup(item.kind));
  const pickupsHit =
    pickups.length === 0 ? [] : pickupsReached(data, geometry, run, footprint, pickups);

  // Timed debuffs count down on walking steps only, so a hit stop or a card holds them.
  let nextRun: RunState = { ...tickDebuffs(stepSeconds, run), zoneDistance: pixels(zoneDistance) };
  const areaContacts: AreaContact[] = [];
  const bumps: MinorBump[] = [];
  const cards: CardSource[] = [];
  const collected: WalkItem[] = [];
  const encounterHits: EncounterCard[] = [];
  const instants: InstantFind[] = [];
  const spots: WalkItem[] = [];
  const tips: MoneyChange[] = [];
  for (const item of [...hits, ...pickupsHit]) {
    const { kind } = item;
    if (isNeedSpot(data, kind)) {
      spots.push(item);
    } else if (kind === "tip" || kind === "treat") {
      const pickup = collect(data, kind, nextRun);
      nextRun = pickup.run;
      if (pickup.tip !== null) {
        tips.push(pickup.tip);
      }
      collected.push(item);
    } else if (isMinorObstacle(data, kind) || isMoverObstacle(kind)) {
      const bump = minorBump(data, countBump(nextRun));
      nextRun = bump.state;
      control = lockSteering(read(data.tuning, "seconds", "minorStumble"), control);
      bumps.push({ change: bump.change, item });
    } else {
      const affected = affectedDogs(data, run, kind);
      const contact = areaContact(data, affected, nextRun, kind);
      if (contact !== null) {
        areaContacts.push(contact);
      }
      if (!opensFor(data, run, kind)) {
        continue;
      }
      if (data.encounters[kind].kind === "obstacle") {
        nextRun = countBump(nextRun);
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
  if (
    forcedStopOnRoad !== null &&
    forcedStopOnRoad.y + geometry.itemHeights.forcedStop > geometry.packBand.top
  ) {
    cards.push({ kind: "forcedStop", stop: forcedStopOnRoad.stop });
    forcedStopOnRoad = null;
  }

  const hitStop = startHitStop(
    hitStopLength(
      {
        encounter: read(data.tuning, "seconds", "hitStopSeconds"),
        minor: read(data.tuning, "seconds", "minorHitStopSeconds"),
      },
      { encounters: encounterHits.length, minors: bumps.length },
    ),
    { cards, zoneEnded },
  );
  return {
    areaContacts,
    bumps,
    cards: hitStop === null ? cards : [],
    collected,
    encounterHits,
    instants,
    spots,
    tips,
    walk: {
      road: {
        ...road,
        control,
        forcedStopAhead,
        forcedStopOnRoad,
        hitStop,
        invulnerableSeconds,
        items: [
          ...remaining,
          ...cues,
          ...(pickupsHit.length === 0
            ? pickups
            : pickups.filter((item) => !pickupsHit.includes(item))),
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

function opensFor(data: WalkData, run: RunState, encounter: EncounterId): boolean {
  return opensCard(data, affectedDogs(data, run, encounter), run, encounter);
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
      isMoverObstacle(kind) ||
      isNeedSpot(data, kind) ||
      opensFor(data, run, kind),
  };
}

// The pickups within reach of the pack's lanes.
function pickupsReached(
  data: WalkData,
  geometry: RoadGeometry,
  run: RunState,
  footprint: PackFootprint,
  pickups: readonly WalkItem[],
): WalkItem[] {
  const reaches = {
    tip: reachFootprint(data, geometry, run, footprint, "tip"),
    treat: reachFootprint(data, geometry, run, footprint, "treat"),
  };
  return pickups.filter((item) => isPickup(item.kind) && touchesPack(reaches[item.kind], item));
}

function reachFootprint(
  data: WalkData,
  geometry: RoadGeometry,
  run: RunState,
  footprint: PackFootprint,
  kind: PickupKind,
): PackFootprint {
  return {
    ...footprint,
    lanes: widenLanes(geometry.laneCount, pickupReach(data, run, kind), footprint.lanes),
  };
}

// The pack's contact with an area effect, or null for any other encounter or one an immunity
// keeps off.
function areaContact(
  data: Pick<GameData, "dogs" | "encounters">,
  caught: readonly DogId[],
  run: RunState,
  encounter: EncounterId,
): AreaContact | null {
  if (
    data.encounters[encounter].affects.kind !== "caught" ||
    run.immunities.some((immunity) => immunity.encounter === encounter)
  ) {
    return null;
  }
  return { caught, encounter, hopped: hoppingDogs(data, run, encounter) };
}

const NOTHING_HELD: HeldStep = { cards: [], zoneEnded: false };

// A step in which the walk does not move, giving out only what it held.
function stillStep(held: HeldStep, walk: Walk): WalkStep {
  return {
    areaContacts: [],
    bumps: [],
    cards: [...held.cards],
    collected: [],
    encounterHits: [],
    instants: [],
    spots: [],
    tips: [],
    walk,
    zoneEnded: held.zoneEnded,
  };
}

// The end of a zone: every dog still walking is paid at the zone's fee multiplier, each debuff
// on counts the zone, the effects that lasted the zone expire, then the run moves to the next
// position, whose zone the fork picks, with every need starting again, or ends once the walk's
// last zone is done.
export function finishZone(data: WalkData, run: RunState): ZoneEnd {
  const { changes, state: paid } = payZoneFees(data, countDebuffZones(run));
  const expired = expireAtZoneEnd(run.zoneIndex, paid);
  if (run.zoneIndex >= walkLength(data) - 1) {
    return { fees: changes, run: { ...expired, phase: { kind: "ended", reason: "finished" } } };
  }
  return {
    fees: changes,
    run: { ...expired, needSeconds: {}, zoneDistance: pixels(0), zoneIndex: run.zoneIndex + 1 },
  };
}

// Heading home keeps what was earned, but the current zone pays nothing.
export function headHome(run: RunState): RunState {
  return { ...run, phase: { kind: "ended", reason: "wentHome" } };
}
