import type { EncounterId, ForcedStopId, GameData, MinorObstacleId } from "../data/types";
import type { LaneDirection } from "../layout/lanes";
import { countBump, countDebuffZones } from "../rules/achievements";
import type { MoneyChange } from "../rules/causes";
import { applyInstantEncounter, type ChoiceOutcome } from "../rules/choices";
import { expireAtZoneEnd } from "../rules/durations";
import { affectedDogs, opensCard } from "../rules/encounters";
import { modifiedStat } from "../rules/modifiers";
import { minorBump, payZoneFees, tipValue } from "../rules/run";
import { addCents, type Pixels, pixels, read } from "../rules/units";
import { zoneStats } from "../rules/zones";
import { packDogs } from "../state/pack";
import type { CardSource, RunState } from "../state/runState";
import { collideWithPack, type PackFootprint, tickInvulnerability, touchesPack } from "./collision";
import { type HeldStep, type HitStop, hitStopLength, startHitStop, tickHitStop } from "./hitStop";
import {
  advanceLaneControl,
  type LaneControl,
  laneControlIn,
  lockSteering,
  steerLane,
} from "./laneControl";
import { type LaneMotionConfig, occupiedLanes, stillInLane } from "./laneMotion";
import { type Random, randomInt, randomPick } from "./random";
import { itemsOnRoad, type RoadItem, scrollRoadItems } from "./roadItems";
import {
  type Footprint,
  hitLength,
  planSpawns,
  SINGLE_CELL,
  type SpawnEvent,
  type SpawnQuota,
  takeDueSpawns,
} from "./spawning";
import { advanceZones } from "./zones";

export type WalkData = Pick<
  GameData,
  | "debuffs"
  | "dogs"
  | "encounters"
  | "forcedStops"
  | "minorObstacles"
  | "shopGear"
  | "tuning"
  | "upgrades"
  | "world"
>;

export type PickupKind = "tip" | "treat";
export type WalkItemKind = EncounterId | MinorObstacleId | PickupKind;
export type WalkItem = RoadItem<WalkItemKind>;
// What a road item is to the rules: an obstacle hit by accident, a minor obstacle that opens
// no card, a lucky encounter, or a pickup.
export type ItemCategory = "lucky" | "minor" | "obstacle" | PickupKind;

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
// hitStop is set while an obstacle hit holds the walk still.
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
  itemHeights: Readonly<Record<"forcedStop" | "lucky" | PickupKind, number>>;
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

// bumps, cards and instants are in the order the pack met them; tips are the money changes of
// the tips collected; zoneEnded is set on the step that reaches the end of the zone.
// encounterHits are the obstacle encounters hit this step. A hit stop holds the step's cards
// and zone end back to the step it ends on.
export interface WalkStep {
  bumps: MinorBump[];
  cards: CardSource[];
  collected: WalkItem[];
  encounterHits: EncounterCard[];
  instants: InstantFind[];
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

export function laneMotionConfig(
  data: Pick<GameData, "tuning">,
  laneCount: number,
): LaneMotionConfig {
  return { laneCount, moveDuration: read(data.tuning, "seconds", "laneMove") };
}

// Pixels per second in the run's current zone, read from the live tuning.
export function walkScrollSpeed(data: Pick<GameData, "tuning">, run: RunState): Pixels {
  return zoneStats(data.tuning, run.zoneIndex).scrollSpeed;
}

// The minor obstacles that may appear in the run's current zone.
export function minorObstaclesIn(
  data: Pick<GameData, "minorObstacles" | "world">,
  zoneIndex: number,
): MinorObstacleId[] {
  const zone = data.world.zones[zoneIndex]?.id;
  return (Object.keys(data.minorObstacles) as MinorObstacleId[]).filter((id) => {
    const { zones } = data.minorObstacles[id] as { zones?: readonly string[] };
    return zones === undefined || (zone !== undefined && zones.includes(zone));
  });
}

// Every zone is the distance the base speed covers in zoneAtBaseSpeed, before upgrades.
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
  };
}

// The chance weights of the obstacles: each small dog draws other dogs more often and
// each big dog less.
export function obstacleWeights(
  data: Pick<GameData, "dogs" | "encounters" | "tuning">,
  run: RunState,
): [EncounterId, number][] {
  const sizes = packDogs(run).map((dog) => data.dogs[dog].size);
  const count = (size: string) => sizes.filter((candidate) => candidate === size).length;
  const otherDog =
    1 +
    count("small") * read(data.tuning, "multipliers", "otherDogChangePerSmallDog") +
    count("big") * read(data.tuning, "multipliers", "otherDogChangePerBigDog");
  return (Object.keys(data.encounters) as EncounterId[])
    .filter((id) => data.encounters[id].kind === "obstacle")
    .map((id): [EncounterId, number] => [id, id === "otherDog" ? Math.max(0, otherDog) : 1]);
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

// Each obstacle kind is drawn first, weighted, so its shape is known when it is placed; a
// zone's minor obstacles are drawn evenly from those allowed in it. Rush hour and the like
// scale both counts.
function spawnQuotas(data: WalkData, random: Random, run: RunState): SpawnQuota<WalkItemKind>[] {
  const stats = zoneStats(data.tuning, run.zoneIndex);
  const scaled = (stat: "obstacleSpawns" | "tipSpawns", base: number) =>
    Math.round(modifiedStat(data.tuning, run.modifiers, stat, base));
  const weights = obstacleWeights(data, run);
  const minors = minorObstaclesIn(data, run.zoneIndex);
  const lucky = (Object.keys(data.encounters) as EncounterId[]).filter(
    (id) => data.encounters[id].kind === "lucky",
  );
  const drawn = <Kind extends WalkItemKind>(count: number, draw: () => Kind) =>
    Array.from({ length: count }, draw);
  const kinds: WalkItemKind[] = [
    ...drawn(scaled("obstacleSpawns", stats.obstacles), () => pickWeighted(random, weights)),
    ...(minors.length === 0
      ? []
      : drawn(scaled("obstacleSpawns", stats.minorObstacles), () => randomPick(random, minors))),
    ...drawn(stats.luckyEncounters, () => randomPick(random, lucky)),
  ];
  const quotas = new Map<WalkItemKind, number>();
  kinds.forEach((kind) => quotas.set(kind, (quotas.get(kind) ?? 0) + 1));
  return [
    ...[...quotas].map(([kind, count]) => ({
      blocksLane: blocksLane(data, kind),
      count,
      footprint: footprintOf(data, kind),
      kind,
    })),
    { blocksLane: false, count: scaled("tipSpawns", stats.tips), kind: "tip" },
    { blocksLane: false, count: stats.treats, kind: "treat" },
  ];
}

// Plans the run's current zone: its spawns, each obstacle and lucky encounter drawn, and
// its forced stop, drawn from those not yet met this run and placed midway between two
// rows in the middle third of the zone.
export function planZone(
  data: WalkData,
  geometry: Pick<
    RoadGeometry,
    "cell" | "itemHeights" | "laneCount" | "sightLength" | "tallestPackBand"
  >,
  random: Random,
  walk: Walk,
): Walk {
  const { road, run } = walk;
  const length = zoneLength(data, run);
  const spacing = read(data.tuning, "pixels", "spawnRowSpacing");
  const pending = planSpawns(random, {
    cellInset: geometry.cell.inset,
    cellLength: geometry.cell.length,
    laneCount: geometry.laneCount,
    laneMoveSeconds: read(data.tuning, "seconds", "laneMove"),
    minOpenLanes: read(data.tuning, "counts", "openLanesPerRowMin"),
    minSpacing: spacing,
    packLength: geometry.tallestPackBand,
    quotas: spawnQuotas(data, random, run),
    scrollSpeed: walkScrollSpeed(data, run),
    sightLength: geometry.sightLength,
    zoneLength: length,
  });

  const stops = Object.keys(data.forcedStops) as ForcedStopId[];
  const unseen = stops.filter((stop) => !road.forcedStopsSeen.includes(stop));
  const stop = randomPick(random, unseen.length > 0 ? unseen : stops);
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
    },
    run,
  };
}

// Steering during a hit stop is dropped, not queued.
export function steerWalk(
  data: Pick<GameData, "tuning">,
  laneCount: number,
  direction: LaneDirection,
  walk: Walk,
): Walk {
  if (walk.road.hitStop !== null) {
    return walk;
  }
  const control = steerLane(laneMotionConfig(data, laneCount), direction, walk.road.control);
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

// One frame of walking. Scrolls the road at the zone's speed, brings spawns into view,
// moves the pack, then collides: pickups are collected into the run, minor obstacles drop
// tips and lock lane input, obstacles (outside the grace window) and lucky encounters become
// cards for the dogs they affect or, for an instant lucky find, apply at once, and a forced
// stop that reaches the pack always becomes a card. A minor bump or an obstacle encounter
// starts a hit stop, and the steps it lasts hold everything still. Does nothing unless
// walking.
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
  const zone = advanceZones(
    {
      baseSpeed: walkScrollSpeed(data, run) * road.speedFactor,
      zones: [{ length, speedMultiplier: 1 }],
    },
    stepSeconds,
    { distance: run.zoneDistance, finished: false, zoneDistance: run.zoneDistance, zoneIndex: 0 },
  );
  const zoneDistance = zone.progress.zoneDistance;
  const travel = zoneDistance - run.zoneDistance;

  const due = takeDueSpawns(zoneDistance, road.pending);
  let nextItemId = road.nextItemId;
  const arrived = due.due.map((event): WalkItem => {
    const height = itemHeight(data, geometry, event.kind);
    return {
      height,
      id: nextItemId++,
      kind: event.kind,
      lane: event.lane,
      laneSpan: footprintOf(data, event.kind).lanes,
      y: geometry.roadTop - height + (zoneDistance - event.distance),
    };
  });
  const items = itemsOnRoad(geometry.roadBottom, [
    ...scrollRoadItems(travel, road.items),
    ...arrived,
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
    laneMotionConfig(data, geometry.laneCount),
    stepSeconds,
    road.control,
  );
  const lanes = occupiedLanes(control.motion);
  const footprint: PackFootprint = { ...geometry.packBand, lanes };
  const { hits, invulnerableSeconds, remaining } = collideWithPack(
    {
      invulnerabilitySeconds: read(data.tuning, "seconds", "collisionGrace"),
      startsInvulnerability: (item: WalkItem) => blocksLane(data, item.kind),
    },
    footprint,
    tickInvulnerability(stepSeconds, road.invulnerableSeconds),
    items.filter((item) => item.kind !== "treat"),
  );
  const treatReach = Math.round(modifiedStat(data.tuning, run.modifiers, "treatReach", 0));
  const treatFootprint = { ...footprint, lanes: widenLanes(geometry.laneCount, treatReach, lanes) };
  const treats = items.filter((item) => item.kind === "treat");
  const treatsHit = treats.filter((item) => touchesPack(treatFootprint, item));

  let nextRun: RunState = { ...run, zoneDistance: pixels(zoneDistance) };
  const bumps: MinorBump[] = [];
  const cards: CardSource[] = [];
  const collected: WalkItem[] = [];
  const encounterHits: EncounterCard[] = [];
  const instants: InstantFind[] = [];
  const tips: MoneyChange[] = [];
  for (const item of [...hits, ...treatsHit]) {
    const { kind } = item;
    if (kind === "tip" || kind === "treat") {
      const pickup = collect(data, kind, nextRun);
      nextRun = pickup.run;
      if (pickup.tip !== null) {
        tips.push(pickup.tip);
      }
      collected.push(item);
    } else if (isMinorObstacle(data, kind)) {
      const bump = minorBump(data, countBump(nextRun));
      nextRun = bump.state;
      control = lockSteering(read(data.tuning, "seconds", "minorStumble"), control);
      bumps.push({ change: bump.change, item });
    } else {
      if (data.encounters[kind].kind === "obstacle") {
        nextRun = countBump(nextRun);
      }
      const affected = affectedDogs(data, random, nextRun, kind);
      if (!opensCard(data, affected, nextRun, kind)) {
        continue;
      }
      if (data.encounters[kind].resolution.kind === "instant") {
        const outcome = applyInstantEncounter(data, random, nextRun, kind, affected);
        nextRun = outcome.state;
        instants.push({ encounter: kind, outcome });
      } else {
        const card: EncounterCard = { affected, encounter: kind, kind: "encounter" };
        if (data.encounters[kind].kind === "obstacle") {
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

  const zoneEnded = zone.completedZones.length > 0;
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
    bumps,
    cards: hitStop === null ? cards : [],
    collected,
    encounterHits,
    instants,
    tips,
    walk: {
      road: {
        ...road,
        control,
        forcedStopAhead,
        forcedStopOnRoad,
        hitStop,
        invulnerableSeconds,
        items: [...remaining, ...treats.filter((item) => !treatsHit.includes(item))],
        nextItemId,
        pending: due.pending,
      },
      run: nextRun,
    },
    zoneEnded: hitStop === null && zoneEnded,
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
    instants: [],
    tips: [],
    walk,
    zoneEnded: held.zoneEnded,
  };
}

// The end of a zone: every dog still walking is paid, each debuff on counts the zone, the
// effects that lasted the zone expire, then the run moves to the next zone, or ends once the
// last zone is done.
export function finishZone(data: WalkData, run: RunState): ZoneEnd {
  const { changes, state: paid } = payZoneFees(data, countDebuffZones(run));
  const expired = expireAtZoneEnd(run.zoneIndex, paid);
  if (run.zoneIndex >= data.world.zones.length - 1) {
    return { fees: changes, run: { ...expired, phase: { kind: "ended", reason: "finished" } } };
  }
  return {
    fees: changes,
    run: { ...expired, zoneDistance: pixels(0), zoneIndex: run.zoneIndex + 1 },
  };
}

// Heading home keeps what was earned, but the current zone pays nothing.
export function headHome(run: RunState): RunState {
  return { ...run, phase: { kind: "ended", reason: "wentHome" } };
}
