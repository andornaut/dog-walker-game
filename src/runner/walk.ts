import type { EncounterId, ForcedStopId, GameData } from "../data/types";
import type { LaneDirection } from "../layout/lanes";
import type { MoneyChange } from "../rules/causes";
import { applyInstantEncounter, type ChoiceOutcome } from "../rules/choices";
import { affectedDogs, opensCard } from "../rules/encounters";
import { modifiedStat } from "../rules/modifiers";
import { payZoneFees, tipValue } from "../rules/run";
import { addCents, type Pixels, pixels, read } from "../rules/units";
import { zoneStats } from "../rules/zones";
import { packDogs } from "../state/pack";
import type { CardSource, RunState } from "../state/runState";
import { collideWithPack, type PackFootprint, tickInvulnerability, touchesPack } from "./collision";
import { advanceLaneControl, type LaneControl, laneControlIn, steerLane } from "./laneControl";
import { type LaneMotionConfig, occupiedLanes, stillInLane } from "./laneMotion";
import { type Random, randomInt, randomPick } from "./random";
import { itemsOnRoad, type RoadItem, scrollRoadItems } from "./roadItems";
import { planSpawns, type SpawnEvent, type SpawnQuota, takeDueSpawns } from "./spawning";
import { advanceZones } from "./zones";

export type WalkData = Pick<
  GameData,
  "debuffs" | "dogs" | "encounters" | "forcedStops" | "shopGear" | "tuning" | "upgrades" | "world"
>;

export type PickupKind = "tip" | "treat";
export type WalkItemKind = EncounterId | PickupKind;
export type WalkItem = RoadItem<WalkItemKind>;
// What a road item is to the rules: an obstacle hit by accident, a lucky encounter, or a pickup.
export type ItemCategory = "lucky" | "obstacle" | PickupKind;

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
// not yet in view, at zone distances.
export interface Road {
  control: LaneControl;
  forcedStopAhead: ForcedStopAhead | null;
  forcedStopOnRoad: ForcedStopOnRoad | null;
  forcedStopsSeen: readonly ForcedStopId[];
  invulnerableSeconds: number;
  items: readonly WalkItem[];
  nextItemId: number;
  pending: readonly SpawnEvent<WalkItemKind>[];
}

export interface Walk {
  road: Road;
  run: RunState;
}

// Screen pixels. packBand is the current pack's; tallestPackBand is any pack's, so spawns
// stay avoidable whoever walks.
export interface RoadGeometry {
  itemHeights: Readonly<Record<ItemCategory | "forcedStop", number>>;
  laneCount: number;
  packBand: { bottom: number; top: number };
  roadBottom: number;
  roadTop: number;
  tallestPackBand: number;
}

// A lucky encounter that applied on contact, with no card.
export interface InstantFind {
  encounter: EncounterId;
  outcome: ChoiceOutcome;
}

// cards and instants are in the order the pack met them; tips are the money changes of the
// tips collected; zoneEnded is set on the step that reaches the end of the zone.
export interface WalkStep {
  cards: CardSource[];
  collected: WalkItem[];
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

export function itemCategory(data: Pick<GameData, "encounters">, kind: WalkItemKind): ItemCategory {
  return kind === "tip" || kind === "treat" ? kind : data.encounters[kind].kind;
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

// Every zone is the distance the base speed covers in zoneAtBaseSpeed, before upgrades.
export function zoneLength(data: Pick<GameData, "tuning">, run: RunState): Pixels {
  const base =
    read(data.tuning, "pixels", "roadScrollSpeed") *
    read(data.tuning, "seconds", "zoneAtBaseSpeed");
  return pixels(modifiedStat(data.tuning, run.modifiers, "zoneLength", base));
}

export function startRoad(laneCount: number): Road {
  return {
    control: laneControlIn(stillInLane(Math.floor(laneCount / 2))),
    forcedStopAhead: null,
    forcedStopOnRoad: null,
    forcedStopsSeen: [],
    invulnerableSeconds: 0,
    items: [],
    nextItemId: 0,
    pending: [],
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

type SpawnGroup = "lucky" | "obstacle" | PickupKind;

function spawnQuotas(data: WalkData, run: RunState): SpawnQuota<SpawnGroup>[] {
  const stats = zoneStats(data.tuning, run.zoneIndex);
  const scaled = (stat: "obstacleSpawns" | "tipSpawns", base: number) =>
    Math.round(modifiedStat(data.tuning, run.modifiers, stat, base));
  return [
    { blocksLane: true, count: scaled("obstacleSpawns", stats.obstacles), kind: "obstacle" },
    { blocksLane: false, count: scaled("tipSpawns", stats.tips), kind: "tip" },
    { blocksLane: false, count: stats.treats, kind: "treat" },
    { blocksLane: false, count: stats.luckyEncounters, kind: "lucky" },
  ];
}

// Plans the run's current zone: its spawns, each obstacle and lucky encounter drawn, and
// its forced stop, drawn from those not yet met this run and placed midway between two
// rows in the middle third of the zone.
export function planZone(
  data: WalkData,
  geometry: Pick<RoadGeometry, "itemHeights" | "laneCount" | "tallestPackBand">,
  random: Random,
  walk: Walk,
): Walk {
  const { road, run } = walk;
  const length = zoneLength(data, run);
  const spacing = read(data.tuning, "pixels", "spawnRowSpacing");
  const plan = planSpawns(random, {
    blockingLength: geometry.tallestPackBand + geometry.itemHeights.obstacle,
    laneCount: geometry.laneCount,
    laneMoveSeconds: read(data.tuning, "seconds", "laneMove"),
    minSpacing: spacing,
    quotas: spawnQuotas(data, run),
    scrollSpeed: walkScrollSpeed(data, run),
    zoneLength: length,
  });
  const weights = obstacleWeights(data, run);
  const lucky = (Object.keys(data.encounters) as EncounterId[]).filter(
    (id) => data.encounters[id].kind === "lucky",
  );
  const pending = plan.map((event): SpawnEvent<WalkItemKind> => {
    switch (event.kind) {
      case "obstacle":
        return { ...event, kind: pickWeighted(random, weights) };
      case "lucky":
        return { ...event, kind: randomPick(random, lucky) };
      default:
        return { ...event, kind: event.kind };
    }
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

export function steerWalk(
  data: Pick<GameData, "tuning">,
  laneCount: number,
  direction: LaneDirection,
  walk: Walk,
): Walk {
  const control = steerLane(laneMotionConfig(data, laneCount), direction, walk.road.control);
  return { ...walk, road: { ...walk.road, control } };
}

function heightOf(
  data: Pick<GameData, "encounters">,
  geometry: Pick<RoadGeometry, "itemHeights">,
  kind: WalkItemKind,
): number {
  return geometry.itemHeights[itemCategory(data, kind)];
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
function collect(
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
// moves the pack, then collides: pickups are collected into the run, obstacles (outside
// the grace window) and lucky encounters become cards for the dogs they affect or, for an
// instant lucky find, apply at once, and a forced stop that reaches the pack always becomes
// a card. Does nothing unless walking.
export function stepWalk(
  data: WalkData,
  geometry: RoadGeometry,
  random: Random,
  stepSeconds: number,
  walk: Walk,
): WalkStep {
  const { road, run } = walk;
  if (run.phase.kind !== "walking") {
    return { cards: [], collected: [], instants: [], tips: [], walk, zoneEnded: false };
  }
  const length = zoneLength(data, run);
  const zone = advanceZones(
    { baseSpeed: walkScrollSpeed(data, run), zones: [{ length, speedMultiplier: 1 }] },
    stepSeconds,
    { distance: run.zoneDistance, finished: false, zoneDistance: run.zoneDistance, zoneIndex: 0 },
  );
  const zoneDistance = zone.progress.zoneDistance;
  const travel = zoneDistance - run.zoneDistance;

  const due = takeDueSpawns(zoneDistance, road.pending);
  let nextItemId = road.nextItemId;
  const arrived = due.due.map((event): WalkItem => {
    const height = heightOf(data, geometry, event.kind);
    return {
      height,
      id: nextItemId++,
      kind: event.kind,
      lane: event.lane,
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

  const control = advanceLaneControl(
    laneMotionConfig(data, geometry.laneCount),
    stepSeconds,
    road.control,
  );
  const lanes = occupiedLanes(control.motion);
  const footprint: PackFootprint = { ...geometry.packBand, lanes };
  const isObstacle = (item: WalkItem) => itemCategory(data, item.kind) === "obstacle";
  const { hits, invulnerableSeconds, remaining } = collideWithPack(
    {
      invulnerabilitySeconds: read(data.tuning, "seconds", "collisionGrace"),
      startsInvulnerability: isObstacle,
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
  const cards: CardSource[] = [];
  const collected: WalkItem[] = [];
  const instants: InstantFind[] = [];
  const tips: MoneyChange[] = [];
  for (const item of [...hits, ...treatsHit]) {
    if (item.kind === "tip" || item.kind === "treat") {
      const pickup = collect(data, item.kind, nextRun);
      nextRun = pickup.run;
      if (pickup.tip !== null) {
        tips.push(pickup.tip);
      }
      collected.push(item);
    } else {
      const affected = affectedDogs(data, random, nextRun, item.kind);
      if (!opensCard(data, affected, nextRun, item.kind)) {
        continue;
      }
      if (data.encounters[item.kind].resolution.kind === "instant") {
        const outcome = applyInstantEncounter(data, random, nextRun, item.kind, affected);
        nextRun = outcome.state;
        instants.push({ encounter: item.kind, outcome });
      } else {
        cards.push({ affected, encounter: item.kind, kind: "encounter" });
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

  return {
    cards,
    collected,
    instants,
    tips,
    walk: {
      road: {
        ...road,
        control,
        forcedStopAhead,
        forcedStopOnRoad,
        invulnerableSeconds,
        items: [...remaining, ...treats.filter((item) => !treatsHit.includes(item))],
        nextItemId,
        pending: due.pending,
      },
      run: nextRun,
    },
    zoneEnded: zone.completedZones.length > 0,
  };
}

// The end of a zone: every dog still walking is paid, then the run moves to the next zone,
// or ends once the last zone is done.
export function finishZone(data: WalkData, run: RunState): ZoneEnd {
  const { changes, state: paid } = payZoneFees(data, run);
  if (run.zoneIndex >= data.world.zones.length - 1) {
    return { fees: changes, run: { ...paid, phase: { kind: "ended", reason: "finished" } } };
  }
  return {
    fees: changes,
    run: { ...paid, zoneDistance: pixels(0), zoneIndex: run.zoneIndex + 1 },
  };
}

// Heading home keeps what was earned, but the current zone pays nothing.
export function headHome(run: RunState): RunState {
  return { ...run, phase: { kind: "ended", reason: "wentHome" } };
}
