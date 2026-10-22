import { describe, expect, it } from "vitest";

import { ACHIEVEMENTS } from "../data/achievements";
import { DEBUFFS } from "../data/debuffs";
import { DOGS } from "../data/dogs";
import { DOG_SLOTS } from "../data/dogSlots";
import { ENCOUNTERS } from "../data/encounters";
import { HOME_TEXT } from "../data/homeText";
import { MINOR_OBSTACLES } from "../data/minorObstacles";
import { RUN_TEXT } from "../data/runText";
import { LANE_COUNT, ROAD_CAMERA, SCREEN_CONFIG } from "../data/screen";
import { SHOP_GEAR } from "../data/shop";
import { TUNING } from "../data/tuning";
import type {
  DogId,
  Effect,
  EncounterId,
  GearId,
  MinorObstacleId,
  Movement,
  ObstacleEncounterId,
  Size,
  WalkerId,
  World,
  Zone,
  ZoneId,
} from "../data/types";
import { UPGRADES } from "../data/upgrades";
import { DEFAULT_WALKER, WALKER_PERKS, WALKERS } from "../data/walkers";
import { WORLD } from "../data/world";
import {
  type CardChoice,
  recordInput,
  replayInputs,
  startInputLog,
  type StepInput,
  takeDueInputs,
} from "../dev/inputLog";
import type { LaneDirection } from "../layout/lanes";
import type { PackSprites } from "../layout/packFormation";
import { screenLayout } from "../layout/screenLayout";
import { itemAt } from "../lib/arrays";
import { seededRandom } from "../lib/random";
import { earnedByRun, runCountersOf } from "../rules/achievements";
import { causeLabel } from "../rules/causes";
import { cardFor, type CardView, chooseOption, openCard } from "../rules/choices";
import { modifiersOf, modifierValue } from "../rules/modifiers";
import { tipValue } from "../rules/run";
import { clampHearts, pixels, read } from "../rules/units";
import { slowestAgility } from "../rules/walkers";
import { mapPack, packDogs } from "../state/pack";
import { type ModifierSource, newRun, type PackDogs, type RunState } from "../state/runState";
import { packOf, runFactsFor } from "../testing/achievements";
import { type BlockingSpan, laneChangesBehind, lanesReachedAtEnd } from "../testing/avoidable";
import { type HopMovement, hoppingInstead, plannerStreams, sharedWorld } from "../testing/movers";
import { testPack } from "../testing/packGeometry";
import { activeModifier, heartsByDog } from "../testing/runState";
import { TEST_TUNING, withNeutralWalkers } from "../testing/tuning";
import { TEST_WALKER_DATA } from "../testing/walkers";
import { TEST_WORLD } from "../testing/world";
import { approachOutcomes } from "./approach";
import { STEP_SECONDS } from "./fixedStep";
import { stillInLane } from "./laneMotion";
import { hasLeftRoad, hopShapes, laneAt, type MoverPath, moverPlace, onScreenOf } from "./movers";
import {
  blocksLane,
  collectTip,
  finishZone,
  footprintOf,
  headHome,
  hopSeconds,
  itemCategory,
  itemHeight,
  laneMoveSeconds,
  minorObstacleWeights,
  moverMovement,
  obstacleWeights,
  opensACard,
  pickWeighted,
  plannedCellInset,
  planZone,
  type RoadGeometry,
  spawnQuotas,
  startRoad,
  steerWalk,
  stepWalk,
  type Walk,
  type WalkItem,
  walkScrollSpeed,
  zoneLength,
} from "./walk";
import { walkGeometry, walkProjection } from "./walkGeometry";

// 80px/s for 30s is a 2400px zone: 14 rows of spawns 160px apart.
const tuning = {
  ...TEST_TUNING,
  counts: {
    ...TEST_TUNING.counts,
    luckyEncountersPerZone: 2,
    minorObstaclesFirstZone: 4,
    minorObstaclesGainPerZone: 1,
    obstaclesFirstZone: 6,
    obstaclesGainPerZone: 1,
    tipsFirstZone: 8,
    tipsGainPerZone: 1,
    treatsPerZone: 2,
  },
  pixels: { ...TUNING.pixels, roadScrollSpeed: 80, spawnRowSpacing: 160 },
  seconds: {
    ...TEST_TUNING.seconds,
    collisionGrace: 1,
    hitStopSeconds: 1,
    laneMove: 0.18,
    minorHitStopSeconds: 0.6,
    zoneAtBaseSpeed: 30,
  },
};
const data = {
  debuffs: DEBUFFS,
  dogs: DOGS,
  encounters: ENCOUNTERS,
  homeText: HOME_TEXT,
  minorObstacles: MINOR_OBSTACLES,
  runText: RUN_TEXT,
  shopGear: SHOP_GEAR,
  ...TEST_WALKER_DATA,
  tuning,
  upgrades: UPGRADES,
  world: TEST_WORLD,
};
// The real world, as the integrity tests read it.
const REAL = { ...data, tuning: TUNING, world: WORLD };
type Real = Omit<typeof REAL, "world"> & { world: World };
const ZONE_IDS = WORLD.zones.map(({ id }) => id);
// The game's road, as RunScene lays it out for realRun's pack.
const GAME_ROAD = (() => {
  const road = screenLayout(SCREEN_CONFIG).road;
  const pack: PackSprites = { dogs: ["duchess", "biscuit", "koda"], walker: DEFAULT_WALKER };
  return walkGeometry(LANE_COUNT, pack, walkProjection(ROAD_CAMERA, road), road);
})();
const ROAD_LENGTH = GAME_ROAD.roadBottom - GAME_ROAD.roadTop;
// A pack half again as tall as the game's three, as a taller pack box would make it.
const TALLER = Math.round(GAME_ROAD.tallestPackBand / 2);
const TALL_PACK_ROAD: RoadGeometry = {
  ...GAME_ROAD,
  packBand: { ...GAME_ROAD.packBand, top: GAME_ROAD.packBand.top - TALLER },
  sightLength: GAME_ROAD.sightLength - TALLER,
  tallestPackBand: GAME_ROAD.tallestPackBand + TALLER,
};
// The data with spawn rows spaced wider by this much.
const widerRows = (tuned: Real, wider: number): Real => ({
  ...tuned,
  tuning: {
    ...tuned.tuning,
    pixels: {
      ...tuned.tuning.pixels,
      spawnRowSpacing: tuned.tuning.pixels.spawnRowSpacing + wider,
    },
  },
});
const realRun = (tuned: Real, walker: WalkerId = DEFAULT_WALKER) =>
  newRun(tuned, 3, { dogs: ["duchess", "biscuit", "koda"], gear: null, walker });
// The world with every zone's weights changed by reweigh.
function reweighed(reweigh: (weights: Zone["weights"]) => Zone["weights"]): World {
  const [first, ...rest] = WORLD.zones;
  const zoned = (zone: Zone): Zone => ({ ...zone, weights: reweigh(zone.weights) });
  return { ...WORLD, zones: [zoned(first), ...rest.map(zoned)] };
}
// The weights with each of ids weighed one higher.
function raised<Id extends string>(
  weights: Readonly<Record<Id, number>>,
  ids: readonly Id[],
): Record<Id, number> {
  const entries = (Object.keys(weights) as Id[]).map((id) => [
    id,
    ids.includes(id) ? weights[id] + 1 : weights[id],
  ]);
  return Object.fromEntries(entries) as Record<Id, number>;
}
const OBSTACLE_IDS = Object.keys(WORLD.zones[0].weights.obstacles) as ObstacleEncounterId[];
const MINOR_OBSTACLE_IDS = Object.keys(MINOR_OBSTACLES) as MinorObstacleId[];
const LANES = Array.from({ length: LANE_COUNT }, (_, lane) => lane);
// The run in zone, walked at position zoneIndex.
const inZone = (run: RunState, zone: ZoneId, zoneIndex: number): RunState => ({
  ...run,
  route: Array.from({ length: zoneIndex + 1 }, () => zone),
  zoneIndex,
});
// The slowest pack's lane move: the slowest walker's, which big dogs never slow a pack below.
const slowestLaneMove = read(TUNING, "seconds", "laneMove") / slowestAgility(REAL);
const walkwayOf = (tuned: Real, run: RunState) => ({
  laneCount: LANE_COUNT,
  laneMoveSeconds: slowestLaneMove,
  scrollSpeed: walkScrollSpeed(tuned, run),
  zoneLength: zoneLength(tuned),
});
// The walker whose pace scrolls the road fastest.
const FASTEST_WALKER = (Object.keys(WALKERS) as WalkerId[]).reduce((fastest, walker) => {
  const speed = (id: WalkerId) => walkScrollSpeed(REAL, realRun(REAL, id));
  return speed(walker) > speed(fastest) ? walker : fastest;
});
// The walkers whose lane move covers the least and the most road: a lane move takes the same
// time whoever walks, over road that a walker's pace scrolls faster or slower.
const LANE_MOVE_WALKERS = (() => {
  const road = (walker: WalkerId) => {
    const run = realRun(REAL, walker);
    return laneMoveSeconds(REAL, run) * walkScrollSpeed(REAL, run);
  };
  const walkers = (Object.keys(WALKERS) as WalkerId[]).sort((a, b) => road(a) - road(b));
  return [itemAt(walkers, 0), itemAt(walkers, walkers.length - 1)];
})();
// The greatest common divisor: the row spacing, of distances on rows.
const gcdOf = (values: readonly number[]): number =>
  values.reduce((a, b) => {
    let [x, y] = [a, b];
    while (y !== 0) {
      [x, y] = [y, x % y];
    }
    return x;
  }, 0);
// The length the planner gives a spawn's hit box: its rows less the planned inset at each end,
// which covers its drawn hit box (itemHeight) whatever obstacle it is.
const plannedHeight = (
  tuned: Real,
  road: RoadGeometry,
  zone: ZoneId,
  kind: WalkItem["kind"],
): number =>
  blocksLane(tuned, kind)
    ? footprintOf(tuned, kind).rows * road.cell.length - 2 * plannedCellInset(tuned, road)
    : itemHeight(tuned, road, kind, false);
// A standing spawn's span on the game's road.
const standingSpan = (
  tuned: Real,
  road: RoadGeometry,
  zone: ZoneId,
  { distance, kind, lane }: { distance: number; kind: WalkItem["kind"]; lane: number },
): BlockingSpan => ({
  distance,
  lane,
  laneSpan: footprintOf(tuned, kind).lanes,
  length: plannedHeight(tuned, road, zone, kind) + road.tallestPackBand,
});
// A pixel-long span for each pixel of scroll a mover overlaps the pack in each lane of the
// game's road it covers.
function moverSpans(
  tuned: Real,
  road: RoadGeometry,
  zone: ZoneId,
  event: { distance: number; kind: WalkItem["kind"]; mover: MoverPath },
): BlockingSpan[] {
  const sight = road.sightLength;
  const window = plannedHeight(tuned, road, zone, event.kind) + road.tallestPackBand;
  const across = footprintOf(tuned, event.kind).lanes;
  // A stalker's every way of choosing its steps.
  const paths = event.mover.motion === "approach" ? approachOutcomes(event.mover) : [event.mover];
  return paths.flatMap((path) =>
    Array.from({ length: Math.ceil(4 * ROAD_LENGTH) }, (_, since) => {
      const place = moverPlace(LANE_COUNT, path, since);
      const first = laneAt(place.lanePosition);
      const overlaps = place.solid && place.travel >= sight && place.travel < sight + window;
      return Array.from({ length: across }, (_unused, i) => first + i)
        .filter((lane) => overlaps && lane >= 0 && lane < LANE_COUNT)
        .map((lane) => ({
          distance: event.distance + since - sight,
          lane,
          laneSpan: 1,
          length: 1,
        }));
    }).flat(),
  );
}
// Every lane-blocking spawn's spans on the game's road: a standing one's, or a mover's as it
// passes the pack.
const blockingSpans = (
  tuned: Real,
  road: RoadGeometry,
  zone: ZoneId,
  pending: Walk["road"]["pending"],
): BlockingSpan[] =>
  pending
    .filter((event) => blocksLane(tuned, event.kind))
    .flatMap((event) =>
      event.mover === undefined
        ? [standingSpan(tuned, road, zone, event)]
        : moverSpans(tuned, road, zone, { ...event, mover: event.mover }),
    );
// The scroll over which a mover is on the game's road: from its cue until it has left the road
// or passed the bottom.
function onScreen(distance: number, mover: MoverPath): readonly [number, number] {
  let since = 0;
  while (since < 10_000) {
    const place = moverPlace(LANE_COUNT, mover, since);
    if (hasLeftRoad(LANE_COUNT, place) || place.travel > ROAD_LENGTH) {
      break;
    }
    since += 1;
  }
  return [distance, distance + since];
}
// No more movers on screen than each cap of the game's allows, of those it counts, at the start
// of any of them, where the counts peak.
function expectCapsOnScreen(movers: readonly { distance: number; mover: MoverPath }[]): void {
  const screens = movers.map(({ distance, mover }) => onScreenOf(mover, onScreen(distance, mover)));
  const caps: [number, (screen: (typeof screens)[number]) => boolean][] = [
    [read(TUNING, "counts", "maxMovers"), () => true],
    [read(TUNING, "counts", "maxDartMovers"), (screen) => screen.dart],
    [read(TUNING, "counts", "maxSlowVehicles"), (screen) => screen.slowVehicle],
  ];
  for (const {
    interval: [start],
  } of screens) {
    for (const [cap, counted] of caps) {
      const atOnce = screens.filter(
        (screen) => counted(screen) && screen.interval[0] <= start && start < screen.interval[1],
      ).length;
      expect(atOnce).toBeLessThanOrEqual(cap);
    }
  }
}
const geometry: RoadGeometry = {
  cell: { inset: 12, length: 56 },
  itemHeights: { lucky: 20, tip: 12, treat: 12 },
  laneCount: 5,
  ...testPack(634),
  roadBottom: 640,
  roadTop: 40,
  sightLength: 514,
  tallestPackBand: 76,
  walkerFootY: 634,
};

const walkWith = (dogs: PackDogs, items: WalkItem[] = []): Walk => ({
  road: { ...startRoad(5), items, nextItemId: items.length },
  run: newRun(data, 3, { dogs, gear: null, walker: "casey" }),
});
const RAINCOATS = { kind: "upgrade", upgrade: "raincoats" } as const;
// An item in the middle lane, its bottom just inside the pack's band.
const atPack = (kind: WalkItem["kind"], id = 0, lane = 2, laneSpan = 1): WalkItem => ({
  height: 12,
  id,
  kind,
  lane,
  laneSpan,
  y: 560,
});
// The walk with the pack standing still in lane.
const inLane = (lane: number, walk: Walk): Walk => ({
  ...walk,
  road: {
    ...walk.road,
    control: { ...walk.road.control, motion: stillInLane(lane), target: lane },
  },
});
// The walk with every owner at hearts.
const withHearts = (hearts: number, walk: Walk): Walk => ({
  ...walk,
  run: {
    ...walk.run,
    pack: mapPack(
      (slot) =>
        slot.status === "walking" ? { ...slot, hearts: clampHearts(hearts, hearts) } : slot,
      walk.run.pack,
    ),
  },
});
const graced = (walk: Walk): Walk => ({
  ...walk,
  road: { ...walk.road, invulnerableSeconds: 0.5 },
});
const step = (walk: Walk, seconds = 0.01) =>
  stepWalk(data, geometry, seededRandom(1), seconds, walk);
const FRAME = 1 / 60;
// A crosser 2.5 lanes in from the left edge 32px of scroll after its cue's 50px, its hit
// box then just inside the pack's band.
const crossing: MoverPath = {
  direction: 1,
  enterTravel: 500,
  lanesPerPixel: 2.5 / 32,
  motion: "cross",
  movement: "dart",
  tilt: 0,
  warning: 50,
};
const moverAt = (kind: WalkItem["kind"], path: MoverPath, since: number): WalkItem => ({
  ...atPack(kind),
  mover: { path, since },
});

// The spawn planner takes tens of milliseconds a zone, so a loop over the game's road can pass
// vitest's 5 s default on an oversubscribed machine.
describe("planZone", { timeout: 15_000 }, () => {
  const planned = planZone(data, geometry, plannerStreams(3), walkWith(["koda"]));
  const countOf = (category: string) =>
    planned.road.pending.filter((event) => itemCategory(data, event.kind) === category).length;

  it("plans the zone's counts of each kind of spawn", () => {
    expect(countOf("obstacle")).toBe(6);
    expect(countOf("minor")).toBe(4);
    expect(countOf("tip")).toBe(tuning.counts.tipsFirstZone);
    expect(countOf("treat")).toBe(tuning.counts.treatsPerZone);
    expect(countOf("lucky")).toBe(2);
  });

  // Rush hour's and Treat finder's treatSpawns factors, at the live tuning's values.
  it("plans Rush hour's and Treat finder's treatSpawns factor of treats", () => {
    for (const [, effects, source] of [
      ["Rush hour", UPGRADES.rushHour.effects, { kind: "upgrade", upgrade: "rushHour" }],
      ["Treat finder", WALKER_PERKS.treatFinder.effects, { kind: "walker", walker: "ben" }],
    ] satisfies readonly [string, readonly Effect[], ModifierSource][]) {
      const live = { ...data, tuning: { ...tuning, multipliers: TUNING.multipliers } };
      const factors = modifiersOf(effects).filter(({ stat }) => stat === "treatSpawns");
      expect(factors).toHaveLength(1);
      const walk = walkWith(["koda"]);
      const run = {
        ...walk.run,
        modifiers: factors.map((factor) => activeModifier(source, factor)),
      };
      const treats = planZone(live, geometry, plannerStreams(3), {
        ...walk,
        run,
      }).road.pending.filter(({ kind }) => kind === "treat");
      const factor = factors.reduce(
        (product, modifier) => product * modifierValue(live.tuning, modifier),
        1,
      );
      expect(treats).toHaveLength(Math.round(tuning.counts.treatsPerZone * factor));
    }
  });

  it("draws only the minor obstacles the current zone weighs above 0", () => {
    const walk = walkWith(["koda"]);
    const real = { ...data, world: WORLD };
    for (const zone of ZONE_IDS) {
      const run = inZone(walk.run, zone, 0);
      const allowed = minorObstacleWeights(real, run).map(([kind]) => kind as string);
      for (const seed of [1, 2, 3]) {
        const kinds = planZone(real, geometry, plannerStreams(seed), { ...walk, run })
          .road.pending.filter((event) => event.mover === undefined)
          .map((event) => event.kind as string)
          .filter((kind) => itemCategory(real, kind as WalkItem["kind"]) === "minor");
        expect(
          kinds.filter((kind) => !allowed.includes(kind)),
          zone,
        ).toEqual([]);
      }
    }
  });

  it("weighs the obstacles by the zone the route is in", () => {
    const { run } = walkWith(["koda"]);
    const zones: [Zone, ...Zone[]] = [
      {
        ...TEST_WORLD.zones[0],
        weights: {
          ...TEST_WORLD.zones[0].weights,
          obstacles: {
            otherDog: 0,
            puddle: 2,
            skunk: 0,
            squirrel: 0,
            thief: 0,
          },
        },
      },
      ...TEST_WORLD.zones.slice(1),
    ];
    const weighed = { ...data, world: { ...TEST_WORLD, zones } };
    const first = inZone(run, zones[0].id as ZoneId, 0);
    expect(obstacleWeights(weighed, first)).toEqual([["puddle", 2]]);
    const other = inZone(run, zones[1]?.id as ZoneId, 0);
    expect(obstacleWeights(weighed, other).map(([id]) => id)).toContain("thief");
  });

  // Cards are placed first: none is skipped while a plain obstacle got a place in the zone. Every
  // zone at each walk position it can take, its quotas drawn as planZone draws them first.
  const POSITIONS = ZONE_IDS.flatMap((zone): { position: number; zone: ZoneId }[] =>
    zone === WORLD.firstZone
      ? [{ position: 0, zone }]
      : zone === WORLD.lastZone
        ? [{ position: WORLD.walkLength - 1, zone }]
        : Array.from({ length: WORLD.walkLength - 2 }, (_, i) => ({ position: i + 1, zone })),
  );
  it("skips no card for a plain obstacle in any zone at any walk position", () => {
    for (const { position, zone } of POSITIONS) {
      const zoned = inZone(realRun(REAL), zone, position);
      for (const seed of [1, 2, 3]) {
        const asked = spawnQuotas(REAL, plannerStreams(seed), zoned)
          .filter(({ kind }) => opensACard(REAL, kind))
          .reduce((sum, { count }) => sum + count, 0);
        const { pending } = planZone(REAL, GAME_ROAD, plannerStreams(seed), {
          road: startRoad(LANE_COUNT),
          run: zoned,
        }).road;
        const cards = pending.filter(({ kind }) => opensACard(REAL, kind)).length;
        const plain = pending.filter(
          ({ kind }) => blocksLane(REAL, kind) && !opensACard(REAL, kind),
        );
        expect(plain.length, `seed ${seed}`).toBeGreaterThan(0);
        expect(cards, `seed ${seed}`).toBe(asked);
      }
    }
  });

  // planZone throws when a tuned spawn finds no room, so this also proves none is dropped. At
  // the road's base speed, which a walker's pace scales.
  it("plans every zone of the game's road, first walk and last, with a way past every obstacle from any lane", () => {
    const base = { ...REAL, tuning: withNeutralWalkers(TUNING) };
    for (const zone of ZONE_IDS) {
      for (const zoneIndex of [0, WORLD.walkLength - 1]) {
        const zoned = inZone(realRun(base), zone, zoneIndex);
        for (const seed of [1]) {
          const walk = planZone(base, GAME_ROAD, plannerStreams(seed), {
            road: startRoad(LANE_COUNT),
            run: zoned,
          });
          const spans = blockingSpans(base, GAME_ROAD, zone, walk.road.pending);
          for (const start of [0, 2, 4]) {
            expect(lanesReachedAtEnd(walkwayOf(base, zoned), spans, start)).not.toEqual([]);
          }
        }
      }
    }
  });

  // Each zone at the latest place the route can put it, where the road is fastest: the first
  // zone only starts a walk, the last zone only ends one, and the rest come between.
  const latestIndex = (zone: ZoneId) =>
    zone === WORLD.firstZone
      ? 0
      : zone === WORLD.lastZone
        ? WORLD.walkLength - 1
        : WORLD.walkLength - 2;

  it("shows each row of the game's road in time to cross the whole road for it, in every zone, at every pace", () => {
    const acrossRoad = (LANE_COUNT - 1) * slowestLaneMove;
    for (const walker of Object.keys(WALKERS) as WalkerId[]) {
      for (const zone of ZONE_IDS) {
        const zoned = inZone(realRun(REAL, walker), zone, latestIndex(zone));
        const lookAhead = GAME_ROAD.sightLength / walkScrollSpeed(REAL, zoned);
        expect(lookAhead, `${walker} in ${zone}`).toBeGreaterThan(acrossRoad + 1);
      }
    }
  });

  // Every obstacle's and every minor obstacle's weight raised at once, at the fastest pace in
  // the last zone, where the road is fastest.
  it("plans a way past every row from any lane with every obstacle or minor obstacle weighed higher", () => {
    for (const { world } of [
      {
        name: "every obstacle",
        world: reweighed((weights) => ({
          ...weights,
          obstacles: raised(weights.obstacles, OBSTACLE_IDS),
        })),
      },
      {
        name: "every minor obstacle",
        world: reweighed((weights) => ({
          ...weights,
          minorObstacles: raised(weights.minorObstacles, MINOR_OBSTACLE_IDS),
        })),
      },
    ] satisfies readonly { name: string; world: World }[]) {
      const tuned = { ...REAL, world };
      for (const zone of ZONE_IDS) {
        const zoned = inZone(realRun(tuned, FASTEST_WALKER), zone, WORLD.walkLength - 1);
        for (const seed of [1]) {
          const walk = planZone(tuned, GAME_ROAD, plannerStreams(seed), {
            road: startRoad(LANE_COUNT),
            run: zoned,
          });
          const spans = blockingSpans(tuned, GAME_ROAD, zone, walk.road.pending);
          for (const start of LANES) {
            const reached = lanesReachedAtEnd(walkwayOf(tuned, zoned), spans, start);
            expect(reached, `${zone}, seed ${seed}, from lane ${start}`).not.toEqual([]);
          }
        }
      }
    }
  });

  // Two standing obstacles: a pack passing the nearer one in a lane the farther one blocks, that
  // gets out of it by stepping in behind the nearer one, changes lanes between the two from the
  // first lane the nearer one blocks to the nearest lane the farther one leaves open. Road
  // between them is at least the tallest pack, those lane moves in whole walk steps and the
  // reaction margin, on every way out. Two obstacles two or more lanes wide have a row between
  // them. At the road's speed in the last neighborhood, for the walkers whose lane moves cover
  // the least and the most road.
  it("spaces obstacles for the pack to change lanes between them, at the shortest and longest lane move", () => {
    for (const { walker, zone } of LANE_MOVE_WALKERS.flatMap((walker) =>
      ZONE_IDS.map((zone) => ({ walker, zone })),
    )) {
      const zoned = inZone(realRun(REAL, walker), zone, WORLD.walkLength - 1);
      const speed = walkScrollSpeed(REAL, zoned);
      const steps = Math.ceil(slowestLaneMove / STEP_SECONDS - 1e-9);
      const laneMove = steps * STEP_SECONDS * speed;
      const margin = read(TUNING, "seconds", "pathReactionMargin") * speed;
      const lanesOf = (kind: WalkItem["kind"], lane: number) =>
        new Set(Array.from({ length: footprintOf(REAL, kind).lanes }, (_, i) => lane + i));
      for (const seed of [1, 2]) {
        const walk = planZone(REAL, GAME_ROAD, plannerStreams(seed), {
          road: startRoad(LANE_COUNT),
          run: zoned,
        });
        const standing = walk.road.pending.filter(
          (event) => event.mover === undefined && blocksLane(REAL, event.kind),
        );
        for (const near of standing) {
          const nearLanes = lanesOf(near.kind, near.lane);
          for (const far of standing.filter(({ distance }) => distance > near.distance)) {
            const changes = laneChangesBehind(LANE_COUNT, nearLanes, lanesOf(far.kind, far.lane));
            const gap =
              far.distance - near.distance - plannedHeight(REAL, GAME_ROAD, zone, near.kind);
            if (changes > 0 && gap > 0) {
              const fit = GAME_ROAD.tallestPackBand + changes * laneMove + margin;
              expect(gap, `seed ${seed}: ${near.kind} then ${far.kind}`).toBeGreaterThanOrEqual(
                fit - 1e-6,
              );
            }
          }
        }
        const spacing = gcdOf(walk.road.pending.flatMap((e) => (e.mover ? [] : [e.distance])));
        const wide = standing.filter(({ kind }) => footprintOf(REAL, kind).lanes >= 2);
        wide.forEach((near, i) => {
          for (const far of wide.slice(i + 1)) {
            const rowsApart = Math.abs(far.distance - near.distance) / spacing;
            expect(rowsApart, `seed ${seed}: ${near.kind} and ${far.kind}`).toBeGreaterThanOrEqual(
              2,
            );
          }
        });
      }
    }
  });
});

describe("stepWalk", () => {
  const stinkyRun = (walk: Walk): Walk => ({
    ...walk,
    run: { ...walk.run, debuffs: [{ debuff: "stinky", secondsLeft: 20, untilZone: 0 }] },
  });

  it("brings every tip due into view, clean or Stinky", () => {
    for (const [, debuffed] of [
      ["clean", (walk: Walk) => walk],
      ["Stinky", stinkyRun],
    ] as const) {
      const walk = walkWith(["koda"]);
      const pending = [0, 1, 3, 4].map((lane) => ({ distance: 0.5, kind: "tip", lane }) as const);
      const due = debuffed({ ...walk, road: { ...walk.road, pending } });
      const tips = step(due, 0.05).walk.road.items.filter(({ kind }) => kind === "tip");
      expect(tips).toHaveLength(pending.length);
    }
  });

  it("pays a tip grabbed its value, labelled, clean or Stinky", () => {
    for (const [, debuffed, amount, label] of [
      [
        "clean",
        (walk: Walk) => walk,
        read(tuning, "money", "tip"),
        `+$${TEST_TUNING.money.tip} tip`,
      ],
      ["Stinky", stinkyRun, 0, `+$0 ${DEBUFFS.stinky.name}`],
    ] as const) {
      const { run } = debuffed(walkWith(["koda"]));
      const { tip } = collectTip(data, run);
      expect(tip.amount).toBe(amount);
      expect(causeLabel(data, tip)).toBe(label);
    }
  });

  it("brings a due spawn into view at the top of the road", () => {
    const walk = walkWith(["koda"]);
    const due: Walk = {
      ...walk,
      road: { ...walk.road, pending: [{ distance: 0.5, kind: "tip", lane: 1 }] },
    };
    const { walk: after } = step(due, 0.05);
    expect(after.road.items).toEqual([
      { height: 12, id: 0, kind: "tip", lane: 1, laneSpan: 1, y: 40 - 12 + (4 - 0.5) },
    ]);
    expect(after.road.pending).toEqual([]);
    expect(after.run.zoneDistance).toBeCloseTo(4);
  });

  it("collects a tip the pack walks into, worth what tips pay now", () => {
    const walk = walkWith(["koda"], [atPack("tip")]);
    const { collected, tips, walk: after } = step(walk);
    expect(collected.map(({ kind }) => kind)).toEqual(["tip"]);
    expect(after.run.money).toBe(walk.run.money + tipValue(data, walk.run).amount);
    expect(tips).toEqual([tipValue(data, walk.run)]);
    expect(after.road.items).toEqual([]);
  });

  it("gives a treat the pack walks into to its dog's owner, up to their max", () => {
    const walk = withHearts(1, walkWith(["koda"], [atPack("treat")]));
    const { collected, treats, walk: after } = step(walk);
    expect(collected.map(({ kind }) => kind)).toEqual(["treat"]);
    expect(treats.map(({ dog }) => dog)).toEqual(["koda"]);
    expect(heartsByDog(after.run).koda).toBe(1 + read(tuning, "hearts", "treat"));
    const full = walkWith(["koda"], [atPack("treat")]);
    expect(step(full).treats.map(({ change }) => change)).toEqual([null]);
  });

  // Long reach grabs a tip or a treat its lanes reach past the pack's own, and no further.
  const longReach = (Object.keys(WALKERS) as WalkerId[]).find(
    (walker) => WALKERS[walker].perk === "longReach",
  );
  it.each([
    [0, 3, false],
    [1, 3, true],
    [1, 4, false],
  ] as const)(
    "with %i lanes of reach, the pack in lane 2 takes a pickup in lane %i: %s",
    (lanes, lane, reached) => {
      const reaching = {
        ...data,
        tuning: { ...tuning, counts: { ...tuning.counts, longReachLanes: lanes } },
      };
      for (const kind of ["tip", "treat"] as const) {
        const walk: Walk = {
          road: { ...startRoad(5), items: [atPack(kind, 0, lane)], nextItemId: 1 },
          run: newRun(reaching, 3, { dogs: ["koda"], gear: null, walker: longReach ?? "casey" }),
        };
        const { collected } = stepWalk(reaching, geometry, seededRandom(1), 0.01, walk);
        expect(
          collected.map((item) => item.kind),
          kind,
        ).toEqual(reached ? [kind] : []);
      }
    },
  );

  it("counts a treat grabbed in the treats tally whatever the owners' hearts", () => {
    for (const [, hearts] of [
      ["below their max", (walk) => withHearts(1, walk)],
      ["at their max, as every walk starts", (walk) => walk],
    ] satisfies readonly [string, (walk: Walk) => Walk][]) {
      const walk = hearts(walkWith(["koda", "biscuit"], [atPack("treat")]));
      const before = walk.run.tallies.treats ?? 0;
      expect(step(walk).walk.run.tallies.treats).toBe(before + 1);
    }
  });

  it("gives a treat the front dog grabs at its owner's max to the hurt owner behind", () => {
    const walk = walkWith(["koda", "biscuit"], [atPack("treat")]);
    const hurt: Walk = {
      ...walk,
      run: {
        ...walk.run,
        pack: mapPack(
          (slot) =>
            slot.dog === "biscuit" && slot.status === "walking"
              ? { ...slot, hearts: clampHearts(slot.hearts, 1) }
              : slot,
          walk.run.pack,
        ),
      },
    };
    const { treats, walk: after } = step(hurt);
    expect(treats.map(({ dog }) => dog)).toEqual(["biscuit"]);
    expect(heartsByDog(after.run).biscuit).toBe(1 + read(tuning, "hearts", "treat"));
  });

  // Every treat that reaches the pack's band before the zone ends: one planned less than the
  // road from the far edge to the band before the end comes into view too late to reach it.
  it("grabs every treat of a planned zone that reaches the pack", () => {
    // The pack stands in the lane of the lowest treat in view, ignoring obstacles.
    let walk = planZone(data, geometry, plannerStreams(4), walkWith(["koda"]));
    const toBand = geometry.packBand.top - geometry.roadTop;
    const reaching = walk.road.pending.filter(
      ({ distance, kind }) => kind === "treat" && distance + toBand < zoneLength(data),
    );
    let carried = 0;
    for (let i = 0; i < 2000; i++) {
      const treat = walk.road.items
        .filter((item) => item.kind === "treat")
        .sort((a, b) => b.y - a.y)[0];
      const moved = inLane(treat?.lane ?? 2, walk);
      walk = { ...moved, road: { ...moved.road, invulnerableSeconds: 99 } };
      const stepped = step(walk, FRAME);
      carried += stepped.treats.length;
      walk = stepped.walk;
    }
    expect(reaching.length).toBeGreaterThan(0);
    expect(carried).toBe(reaching.length);
  });

  it("hits an obstacle, holding its card for the dogs it affects, and starts the grace window", () => {
    const { cards, encounterHits, walk } = step(
      walkWith(["koda", "duchess"], [atPack("otherDog")]),
    );
    const card = { affected: ["koda", "duchess"], encounter: "otherDog", kind: "encounter" };
    expect(encounterHits).toEqual([card]);
    expect(cards).toEqual([]);
    expect(walk.road.hitStop?.cards).toEqual([card]);
    expect(walk.road.items).toEqual([]);
    expect(walk.road.invulnerableSeconds).toBe(1);
  });

  it("hits an obstacle across several lanes from any of them, and misses it from the others", () => {
    const hedge = walkWith(["koda"], [atPack("hedge", 0, 1, 3)]);
    const bumps = [0, 1, 2, 3, 4].map((lane) => step(inLane(lane, hedge)).bumps.length);
    expect(bumps).toEqual([0, 1, 1, 1, 0]);
  });

  it("costs a plain hit's dog's owner a heart, with no money, and starts the grace window", () => {
    const walk = walkWith(["koda", "duchess"], [atPack("cone"), atPack("otherDog", 1)]);
    const { bumps, cards, walk: after } = step(walk);
    const bump = read(tuning, "hearts", "bump");
    expect(bumps.map(({ change, dodged, dog }) => [dog, dodged, change?.causes])).toEqual([
      ["koda", false, [{ amount: -bump, kind: "bump" }]],
    ]);
    expect(after.run.money).toBe(walk.run.money);
    expect(heartsByDog(after.run).koda).toBe((heartsByDog(walk.run).koda ?? 0) - bump);
    expect(cards).toEqual([]);
    expect(after.road.invulnerableSeconds).toBe(1);
    expect(after.road.items.map(({ kind }) => kind)).toEqual(["otherDog"]);
  });

  it("costs muddyBumpHearts times as much while Muddy", () => {
    const walk = walkWith(["koda"], [atPack("cone")]);
    const muddy = {
      ...walk,
      run: { ...walk.run, debuffs: [{ debuff: "muddy", secondsLeft: 20, untilZone: 0 }] },
    } as const;
    const bump = read(tuning, "hearts", "bump") * read(tuning, "multipliers", "muddyBumpHearts");
    expect(heartsByDog(step(muddy).walk.run).koda).toBe((heartsByDog(walk.run).koda ?? 0) - bump);
  });

  // The game sets the pack's formation: the biggest dog leads, ties in roster order, whatever
  // order the dogs were picked in, and a head-on hit lands on the lead.
  it("lands a plain hit head-on on the biggest dog, ties in roster order", () => {
    for (const [, dogs, dog] of [
      ["on the front dog", ["koda", "biscuit"], "koda"],
      ["on the bigger dog, picked second", ["biscuit", "koda"], "koda"],
      ["on the first in roster order of two of a size", ["pierre", "archie"], "archie"],
    ] satisfies readonly [string, PackDogs, string][]) {
      const { bumps } = step(walkWith(dogs, [atPack("cone")]));
      expect(bumps.map((bump) => bump.dog)).toEqual([dog]);
    }
  });

  // Two quick taps carry the pack from lane 2 to lane 0 within one long step: it ends the step
  // clear of lane 1, and starts it clear too, so only its sweep across lane 1 meets what is there.
  it("meets a tip or a cone in a lane it crosses within one step", () => {
    for (const [, kind, met] of [
      ["collects a tip", "tip", (step) => step.tips.length],
      ["bumps into a cone", "cone", (step) => step.bumps.length],
    ] satisfies readonly [
      string,
      WalkItem["kind"],
      (step: ReturnType<typeof stepWalk>) => number,
    ][]) {
      const walk = walkWith(["koda", "biscuit"], [atPack(kind, 0, 1)]);
      const steered = steerWalk(data, 5, -1, steerWalk(data, 5, -1, walk));
      const step = stepWalk(
        data,
        geometry,
        () => 0.99,
        2.5 * laneMoveSeconds(data, walk.run),
        steered,
      );
      expect(step.walk.road.control.motion).toEqual(stillInLane(0));
      expect(met(step)).toBe(1);
    }
  });

  // Each size's chance to dodge a plain hit, without and with the Dog whistle in the Pocket, at
  // the game's chances, which the test tuning pins to 0: a small dog's own chance, plus the
  // whistle's for the sizes it names.
  const { probability } = TUNING;
  const [whistle] = SHOP_GEAR.dogWhistle.effects;
  const whistleSizes: readonly Size[] = whistle.sizes;
  const dodgeCases = (["big", "medium", "small"] as const).flatMap((size) =>
    ([null, "dogWhistle"] as const).map((gear: GearId | null) => ({
      chance:
        (size === "small" ? probability.smallDodgeChance : 0) +
        (gear !== null && whistleSizes.includes(size) ? probability[whistle.chance] : 0),
      gear,
      size,
    })),
  );

  it.each(dodgeCases)(
    "dodges a hit on a $size dog with gear $gear at $chance",
    ({ chance, gear, size }) => {
      const dodging = { ...data, tuning: { ...tuning, probability } };
      const dog = (Object.keys(DOGS) as DogId[]).find((id) => DOGS[id].size === size) ?? "koda";
      const walk: Walk = {
        road: { ...startRoad(5), items: [atPack("cone")], nextItemId: 1 },
        run: newRun(dodging, 3, { dogs: [dog], gear, walker: "casey" }),
      };
      // Each draw just under the chance, and at it; a dog with no chance draws nothing.
      const stepAt = (draw: number) => {
        let draws = 0;
        const random = () => {
          draws += 1;
          return draw;
        };
        const stepped = stepWalk(dodging, geometry, random, 0.01, walk);
        return { draws, stepped };
      };
      const under = stepAt(Math.max(0, chance - 1e-9));
      const at = stepAt(chance);
      const dodged = chance > 0;
      expect(under.draws).toBe(dodged ? 1 : 0);
      expect(under.stepped.bumps.map((bump) => [bump.dodged, bump.change === null])).toEqual([
        [dodged, dodged],
      ]);
      expect(under.stepped.walk.run.bumpsByZone).toEqual(dodged ? [] : [1]);
      expect(under.stepped.walk.road.hitStop === null).toBe(dodged);
      // Only a small dog's dodge counts toward the dodges tally.
      expect(under.stepped.walk.run.tallies.dodges ?? 0).toBe(dodged && size === "small" ? 1 : 0);
      expect(at.stepped.bumps.map((bump) => bump.dodged)).toEqual([false]);
    },
  );

  it("counts only a plain hit as a bump in the zone, not a card obstacle or a lucky find", () => {
    const walk = walkWith(["koda"], [atPack("cone")]);
    const zoned = { ...walk, run: { ...walk.run, zoneIndex: 1 } };
    expect(step(zoned).walk.run.bumpsByZone).toEqual([0, 1]);
    expect(step(walkWith(["koda"], [atPack("otherDog")])).walk.run.bumpsByZone).toEqual([]);
    expect(step(walkWith(["koda"], [atPack("lostWallet")])).walk.run.bumpsByZone).toEqual([]);
  });

  it("opens an encounter's card for the whole pack", () => {
    for (const encounter of ["otherDog", "skunk", "thief"] as const) {
      const walk = walkWith(["koda", "duchess", "pierre"], [atPack(encounter)]);
      expect(step(walk).encounterHits).toEqual([
        { affected: packDogs(walk.run), encounter, kind: "encounter" },
      ]);
    }
  });

  it("muddies the whole pack on a puddle, with no card or heart and a plain obstacle's stop", () => {
    const dogs: PackDogs = ["koda", "duchess"];
    const walk = walkWith(dogs, [atPack("puddle")]);
    const after = step(walk);
    const { resolution } = ENCOUNTERS.puddle;
    const debuffs = resolution.effects.flatMap((effect) =>
      effect.kind === "debuff" ? [effect.debuff] : [],
    );
    expect(after.cards).toEqual([]);
    expect(after.encounterHits).toEqual([]);
    expect(after.contacts.map(({ encounter }) => encounter)).toEqual(["puddle"]);
    // The touching dog, as a plain obstacle in its place would land on.
    const cone = step(walkWith(dogs, [atPack("cone")]));
    expect(after.contacts.map(({ dog }) => dog)).toEqual(cone.bumps.map(({ dog }) => dog));
    expect(after.walk.run.debuffs.map(({ debuff }) => debuff)).toEqual(debuffs);
    expect(heartsByDog(after.walk.run)).toEqual(heartsByDog(walk.run));
    expect(after.walk.road.hitStop?.seconds).toBe(read(tuning, "seconds", "minorHitStopSeconds"));
  });

  describe("a hit that opens no card", () => {
    const raincoats = (walk: Walk): Walk => ({
      ...walk,
      run: { ...walk.run, immunities: [{ encounter: "puddle", source: RAINCOATS }] },
    });
    const scenery: [string, Walk][] = [
      ["a puddle Raincoats keep off", raincoats(walkWith(["koda"], [atPack("puddle")]))],
    ];

    it("is harmless for scenery: removed, with no card, heart, grace or hit stop", () => {
      for (const [, walk] of scenery) {
        const after = step(walk);
        expect(after.cards).toEqual([]);
        expect(after.encounterHits).toEqual([]);
        expect(heartsByDog(after.walk.run)).toEqual(heartsByDog(walk.run));
        expect(after.walk.road.items).toEqual([]);
        expect(after.walk.road.hitStop).toBeNull();
        expect(after.walk.road.invulnerableSeconds).toBe(0);
        expect(after.walk.run.bumpsByZone).toEqual([]);
      }
    });

    it("opens no grace window, so an obstacle met with it is still hit", () => {
      const after = step(
        raincoats(walkWith(["koda"], [atPack("puddle", 0), { ...atPack("otherDog", 2), y: 550 }])),
      );
      expect(after.encounterHits.map(({ encounter }) => encounter)).toEqual(["otherDog"]);
    });

    it("leaves a zone clean for Clean Paws, and a walk for Not a Scratch", () => {
      // Every other fact comes from the badges' goals; the bumps come from the walk.
      const badges = ["cleanPaws", "notAScratch"] as const;
      const awardData = { ...data, achievements: ACHIEVEMENTS, dogSlots: DOG_SLOTS };
      const goal = runFactsFor(awardData, badges);
      let walk = raincoats(walkWith(packOf(data, goal.packSize)));
      for (let zone = 0; zone < data.world.walkLength; zone++) {
        const met = step({ ...walk, road: { ...walk.road, items: [atPack("puddle")] } }).walk;
        walk = { ...met, run: finishZone(data, met.run).run };
      }
      const { bumpsByZone, firstZone } = runCountersOf(walk.run);
      const facts = { ...goal, bumpsByZone, firstZone, zonesFinished: data.world.walkLength };
      expect(earnedByRun(awardData, facts)).toEqual(expect.arrayContaining([...badges]));
    });
  });

  it("in the grace window ignores obstacles and counts no bump, but collects pickups and opens lucky finds", () => {
    const items = [
      atPack("otherDog", 0),
      atPack("cone", 1),
      atPack("tip", 2),
      atPack("lostWallet", 3),
    ];
    const { bumps, cards, collected, encounterHits, instants, walk } = step(
      graced(walkWith(["koda"], items)),
    );
    expect(instants.map(({ encounter }) => encounter)).toEqual(["lostWallet"]);
    expect(encounterHits).toEqual([]);
    expect(bumps).toEqual([]);
    expect(walk.run.bumpsByZone).toEqual([]);
    expect(collected.map(({ kind }) => kind)).toEqual(["tip"]);
    expect(cards).toEqual([]);
    expect(walk.road.items.map(({ kind }) => kind)).toEqual(["otherDog", "cone"]);
  });

  it("applies an instant lucky find at once, with no card", () => {
    const walk = walkWith(["koda", "snowball"], [atPack("lostWallet")]);
    const { cards, instants, walk: after } = step(walk);
    expect(cards).toEqual([]);
    expect(instants.map(({ encounter }) => encounter)).toEqual(["lostWallet"]);
    expect(instants[0]?.outcome.quips).toEqual([]);
    expect(after.run.money).toBe(walk.run.money + read(tuning, "money", "lostWalletKeep"));
    expect(after.run.phase).toEqual({ kind: "walking" });
  });

  // A lucky find touches the pack's outline as a pickup does, so one reaching a pixel into the
  // outline's top is found, though it is above every dog's and the walker's rectangle.
  const LUCKY = (Object.keys(ENCOUNTERS) as EncounterId[]).filter(
    (kind) => ENCOUNTERS[kind].kind === "lucky",
  );
  const { outline } = geometry.packParts;
  it("finds a pickup or lucky find only once it reaches into the pack's outline", () => {
    for (const { found, into, kind } of LUCKY.flatMap((kind) => [
      { found: true, into: 1, kind },
      { found: false, into: 0, kind },
    ])) {
      const parts = [geometry.packParts.walker, ...geometry.packParts.dogs];
      expect(Math.min(...parts.map(({ top }) => top))).toBeGreaterThan(outline.top + into);
      const height = geometry.itemHeights.lucky;
      const item = { ...atPack(kind), height, y: outline.top + into - height };
      const after = step(inLane(2, walkWith(["koda", "snowball"], [item])), 0);
      expect(after.walk.road.items.some(({ id }) => id === item.id)).toBe(!found);
    }
  });

  it("ends the zone at its length and goes no further", () => {
    const walk = walkWith(["koda"]);
    const length = zoneLength(data);
    const nearEnd = { ...walk, run: { ...walk.run, zoneDistance: pixels(length - 1) } };
    const { walk: after, zoneEnded } = step(nearEnd, 1);
    expect(zoneEnded).toBe(true);
    expect(after.run.zoneDistance).toBe(length);
  });

  it("takes the zone's length over its speed at any speed, in 1/60 s steps", () => {
    for (const [speedFactor, seconds] of [
      [1, 30],
      [2, 15],
    ] as const) {
      const walk = walkWith(["koda"]);
      let current: Walk = { ...walk, road: { ...walk.road, speedFactor } };
      let steps = 0;
      for (let ended = false; !ended; steps++) {
        const next = step(current, 1 / 60);
        current = next.walk;
        ended = next.zoneEnded;
      }
      expect(Math.abs(steps - seconds * 60)).toBeLessThanOrEqual(1);
    }
  });

  it("stands still while a card is open", () => {
    const walk = walkWith(["koda"], [atPack("tip")]);
    const carded: Walk = {
      ...walk,
      run: {
        ...walk.run,
        phase: {
          kind: "card",
          source: { affected: ["koda"], encounter: "thief", kind: "encounter" },
        },
      },
    };
    expect(step(carded).walk).toBe(carded);
  });
});

describe("stepWalk's modified values", () => {
  const withTuning = (overrides: (live: typeof tuning) => typeof tuning) => ({
    ...data,
    tuning: overrides(tuning),
  });
  const forgiving = withTuning((live) => ({
    ...live,
    hearts: { ...live.hearts, kindWordsForgiven: TUNING.hearts.kindWordsForgiven },
  }));
  const calming = withTuning((live) => ({
    ...live,
    multipliers: {
      ...live.multipliers,
      calmVoiceDebuffFactor: TUNING.multipliers.calmVoiceDebuffFactor,
    },
  }));
  const reaching = withTuning((live) => ({
    ...live,
    counts: { ...live.counts, longReachLanes: TUNING.counts.longReachLanes },
  }));
  const walkerWith = (perk: keyof typeof WALKER_PERKS): WalkerId => {
    const walker = (Object.keys(WALKERS) as WalkerId[]).find((id) => WALKERS[id].perk === perk);
    if (walker === undefined) {
      throw new Error(`No walker has ${perk}`);
    }
    return walker;
  };
  // A lone koda walking with walker, meeting item at the pack.
  const meeting = (walker: WalkerId, item: WalkItem, run: Partial<Walk["run"]> = {}): Walk => ({
    road: { ...startRoad(5), items: [item], nextItemId: 1 },
    run: { ...newRun(data, 3, { dogs: ["koda"], gear: null, walker }), ...run },
  });
  const by = (amount: number, source: ModifierSource) => [
    { amount, kind: "modifier" as const, source },
  ];
  const koda = { dog: "koda", kind: "hearts" } as const;
  const muddy = { debuff: "muddy", kind: "debuff" } as const;
  const stinky = { debuff: "stinky", kind: "debuff" } as const;
  const bump = read(tuning, "hearts", "bump");
  const muddied = bump * read(tuning, "multipliers", "muddyBumpHearts");
  const tip = read(tuning, "money", "tip");
  const bonus = read(tuning, "money", "bigTipperTipBonus");
  const reach = read(reaching.tuning, "counts", "longReachLanes");
  const muddySeconds = read(tuning, "seconds", DEBUFFS.muddy.seconds);
  const calmedSeconds = muddySeconds * read(calming.tuning, "multipliers", "calmVoiceDebuffFactor");
  const bigTipper = { kind: "upgrade", upgrade: "bigTipper" } as const;
  const debuffed = (debuff: "muddy" | "stinky") => ({
    debuffs: [{ debuff, secondsLeft: 20, untilZone: 0 }],
  });

  it.each([
    [
      "Muddy raises a bump's loss",
      data,
      meeting("casey", atPack("cone"), debuffed("muddy")),
      [{ after: -muddied, before: -bump, by: by(bump - muddied, muddy), subject: koda }],
    ],
    [
      "Second chance forgives a bump",
      forgiving,
      meeting(walkerWith("kindWords"), atPack("cone")),
      [
        {
          after: 0,
          before: -bump,
          by: by(bump, { kind: "walker", walker: walkerWith("kindWords") }),
          subject: koda,
        },
      ],
    ],
    [
      "Big tipper raises a tip",
      data,
      meeting("casey", atPack("tip"), {
        modifiers: [
          activeModifier(bigTipper, {
            by: "bigTipperTipBonus",
            operation: "add",
            stat: "tipValue",
          }),
        ],
      }),
      [{ after: tip + bonus, before: tip, by: by(bonus, bigTipper), subject: { kind: "money" } }],
    ],
    [
      "Stinky takes a tip's pay",
      data,
      meeting("casey", atPack("tip"), debuffed("stinky")),
      [{ after: 0, before: tip, by: by(-tip, stinky), subject: { kind: "money" } }],
    ],
    ...(["tip", "treat"] as const).map(
      (pickup) =>
        [
          `Long reach grabs a ${pickup} a lane over`,
          reaching,
          meeting(walkerWith("longReach"), atPack(pickup, 0, 3)),
          [
            {
              after: reach,
              before: 0,
              by: by(reach, { kind: "walker", walker: walkerWith("longReach") }),
              subject: { kind: "reach", pickup },
            },
          ],
        ] as const,
    ),
    [
      "Raincoats keep a puddle off",
      data,
      meeting("casey", atPack("puddle"), {
        immunities: [{ encounter: "puddle", source: RAINCOATS }],
      }),
      [
        {
          after: 0,
          before: 1,
          by: by(-1, RAINCOATS),
          subject: { encounter: "puddle", kind: "immune" },
        },
      ],
    ],
    [
      "Calm voice shortens a puddle's Muddy",
      calming,
      meeting(walkerWith("calmVoice"), atPack("puddle")),
      [
        {
          after: calmedSeconds,
          before: muddySeconds,
          by: by(calmedSeconds - muddySeconds, { kind: "walker", walker: walkerWith("calmVoice") }),
          subject: { debuff: "muddy", kind: "debuffSeconds" },
        },
      ],
    ],
    ["nothing changes a plain bump", data, meeting("casey", atPack("cone")), []],
  ] as const)("%s", (_, walkData, walk, expected) => {
    const { modified } = stepWalk(walkData, geometry, seededRandom(1), 0.01, walk);
    // Each at the step's one item, by its id: the step scrolls it.
    expect(modified.map(({ item, value }) => ({ id: item.id, value }))).toEqual(
      expected.map((value) => ({ id: walk.road.items[0]?.id, value })),
    );
  });
});

describe("hit stop", () => {
  // A walk with a spawn due just ahead, so a moving road would bring it into view.
  const withSpawnAhead = (walk: Walk): Walk => ({
    ...walk,
    road: { ...walk.road, pending: [{ distance: 3, kind: "tip", lane: 0 }] },
  });

  it("holds the walk the hit stop's frames for each kind of hit", () => {
    for (const { bumpsByZone, dogs, frames, item, opens } of [
      {
        bumpsByZone: [],
        dogs: ["koda"],
        frames: 60,
        item: "otherDog",
        name: "an obstacle encounter, then opens its card",
        opens: true,
      },
      {
        bumpsByZone: [1],
        dogs: ["koda"],
        frames: 36,
        item: "cone",
        name: "a minor bump",
        opens: false,
      },
    ] satisfies readonly {
      bumpsByZone: number[];
      dogs: PackDogs;
      frames: number;
      item: WalkItem["kind"];
      name: string;
      opens: boolean;
    }[]) {
      const card = { affected: dogs, encounter: item, kind: "encounter" };
      const met = step(walkWith(dogs, [atPack(item)]), FRAME);
      expect(met.encounterHits).toEqual(opens ? [card] : []);
      expect(met.cards).toEqual([]);
      expect(met.walk.run.bumpsByZone).toEqual(bumpsByZone);
      let walk = met.walk;
      for (let frame = 1; frame < frames; frame++) {
        const held = step(walk, FRAME);
        expect(held.cards).toEqual([]);
        expect(held.walk.road.hitStop).not.toBeNull();
        walk = held.walk;
      }
      const released = step(walk, FRAME);
      expect(released.cards).toEqual(opens ? [card] : []);
      expect(released.walk.road.hitStop).toBeNull();
    }
  });

  it("stops for the longer hit when a minor bump and an encounter meet on one step", () => {
    // With no grace window, both obstacles touching the pack are hit.
    const graceless = {
      ...data,
      tuning: { ...tuning, seconds: { ...tuning.seconds, collisionGrace: 0 } },
    };
    const both = walkWith(["koda"], [atPack("cone"), atPack("otherDog", 1)]);
    const hit = stepWalk(graceless, geometry, seededRandom(1), FRAME, both);
    expect(hit.encounterHits).toHaveLength(1);
    expect(hit.bumps).toHaveLength(1);
    expect(hit.walk.road.hitStop?.seconds).toBe(1);
  });

  it("never stops for a lucky find without a hit label", () => {
    expect(step(walkWith(["koda"], [atPack("lostWallet")])).walk.road.hitStop).toBeNull();
    expect(step(walkWith(["koda"], [atPack("pettingNeighbor")])).walk.road.hitStop).toBeNull();
  });

  it("advances neither distance, the spawn plan, the road nor the pack during the stop", () => {
    const hit = step(withSpawnAhead(walkWith(["koda"], [atPack("cone"), atPack("tip", 1, 0)])));
    let walk = hit.walk;
    while (walk.road.hitStop !== null) {
      const held = step(walk, FRAME).walk;
      expect(held.run).toBe(hit.walk.run);
      expect(held.road).toEqual({ ...hit.walk.road, hitStop: held.road.hitStop });
      walk = held;
    }
    expect(walk.run.zoneDistance).toBe(hit.walk.run.zoneDistance);
    expect(walk.road.pending).toHaveLength(1);
    expect(step(walk, FRAME).walk.run.zoneDistance).toBeGreaterThan(walk.run.zoneDistance);
  });

  it("keeps the grace window and the steering for after the stop", () => {
    const hit = step(walkWith(["koda"], [atPack("cone")]), FRAME);
    const { control, invulnerableSeconds } = hit.walk.road;
    const after = step(hit.walk, FRAME).walk.road;
    expect(after.invulnerableSeconds).toBe(invulnerableSeconds);
    expect(after.control).toBe(control);
  });

  it("drops steering during the stop rather than queuing it", () => {
    const hit = step(walkWith(["koda"], [atPack("cone")]), FRAME).walk;
    const steered = steerWalk(data, 5, 1, hit);
    expect(steered).toBe(hit);
    let walk = steered;
    while (walk.road.hitStop !== null) {
      walk = step(walk, FRAME).walk;
    }
    expect(walk.road.control.target).toBe(2);
    expect(step(walk, 1).walk.road.control.motion).toEqual(stillInLane(2));
  });

  it("holds a zone end met on the hit's step until the stop ends", () => {
    const walk = walkWith(["koda"], [atPack("otherDog")]);
    const length = zoneLength(data);
    const nearEnd = { ...walk, run: { ...walk.run, zoneDistance: pixels(length - 1) } };
    const hit = step(nearEnd, FRAME);
    expect(hit.zoneEnded).toBe(false);
    let released = step(hit.walk, FRAME);
    while (released.walk.road.hitStop !== null) {
      expect(released.zoneEnded).toBe(false);
      released = step(released.walk, FRAME);
    }
    expect(released.zoneEnded).toBe(true);
    expect(released.cards).toHaveLength(1);
  });

  it("replays a run with hit stops exactly from its input log", () => {
    const setup = { dev: true, seed: 5, speed: 1, zone: 1 };
    const start = planZone(data, geometry, plannerStreams(5), walkWith(["koda", "duchess"]));
    const steps = 60 * 30;
    // As RunScene steps: the moves due now, each logged at the run time it is applied, then the
    // walk. A move every 13 frames, alternating sides, runs into obstacles.
    const play = (movesAt: (frame: number, timeMs: number) => LaneDirection[]) => {
      const rolls = seededRandom(9);
      let log = startInputLog(setup);
      let walk = start;
      let stops = 0;
      let movesInStops = 0;
      const cards: unknown[] = [];
      for (let frame = 0; frame < steps; frame++) {
        const timeMs = frame * FRAME * 1000;
        for (const direction of movesAt(frame, timeMs)) {
          movesInStops += walk.road.hitStop === null ? 0 : 1;
          walk = steerWalk(data, 5, direction, walk);
          log = recordInput({ direction, kind: "lane", timeMs }, log);
        }
        const stepped = stepWalk(data, geometry, rolls, FRAME, walk);
        stops += walk.road.hitStop === null && stepped.walk.road.hitStop !== null ? 1 : 0;
        cards.push(...stepped.cards);
        walk = stepped.walk;
      }
      return { cards, log, movesInStops, stops, walk };
    };
    const recorded = play((frame) =>
      frame % 13 === 0 ? [Math.floor(frame / 13) % 4 < 2 ? -1 : 1] : [],
    );
    expect(recorded.stops).toBeGreaterThan(0);
    expect(recorded.movesInStops).toBeGreaterThan(0);

    const events = [...replayInputs(recorded.log)];
    let next = 0;
    const replayed = play((_, timeMs) => {
      const due: LaneDirection[] = [];
      for (let event = events[next]; event?.kind === "lane" && event.timeMs <= timeMs;) {
        due.push(event.direction);
        next += 1;
        event = events[next];
      }
      return due;
    });
    expect(replayed.walk).toEqual(recorded.walk);
    expect(replayed.cards).toEqual(recorded.cards);
  });

  it("replays lane moves, card choices and heading home to the same final state", () => {
    const setup = { dev: true, seed: 1, speed: 1, zone: 1 };
    const start = planZone(data, geometry, plannerStreams(1), walkWith(["koda", "duchess"]));
    const homeFrame = 60 * 25;
    // As RunScene steps: the inputs due now, each logged at the run time it is applied, then
    // the walk, then each card it opened, chosen and logged at the run time after the step.
    // Heading home applies before a step, at the run time the pause menu was opened.
    const play = (inputs: {
      choose: (view: CardView) => CardChoice;
      due: (frame: number, timeMs: number) => StepInput[];
    }) => {
      const rolls = seededRandom(9);
      const cardRolls = seededRandom(10);
      let log = startInputLog(setup);
      let walk: Walk = start;
      let cardsChosen = 0;
      for (let frame = 0; frame <= homeFrame && walk.run.phase.kind === "walking"; frame++) {
        const timeMs = frame * FRAME * 1000;
        for (const input of inputs.due(frame, timeMs)) {
          walk =
            input.kind === "lane"
              ? steerWalk(data, 5, input.direction, walk)
              : { ...walk, run: headHome(walk.run) };
          log = recordInput(input, log);
        }
        if (walk.run.phase.kind !== "walking") {
          break;
        }
        const stepped = stepWalk(data, geometry, rolls, FRAME, walk);
        walk = stepped.walk;
        for (const source of stepped.cards) {
          const run = openCard(source, walk.run);
          const view = cardFor(data, run, source);
          const choice = inputs.choose(view);
          walk = { ...walk, run: chooseOption(data, cardRolls, run, view, choice).state };
          log = recordInput({ choice, kind: "card", timeMs: (frame + 1) * FRAME * 1000 }, log);
          cardsChosen += 1;
        }
      }
      return { cardsChosen, log, walk };
    };
    const recorded = play({
      // The last option the run can pay for.
      choose: (view) => {
        const enabled = view.options.filter((option) => option.availability.enabled);
        return itemAt(enabled, enabled.length - 1).index;
      },
      due: (frame, timeMs) => {
        const inputs: StepInput[] = [];
        if (frame % 13 === 0) {
          inputs.push({ direction: Math.floor(frame / 13) % 4 < 2 ? -1 : 1, kind: "lane", timeMs });
        }
        if (frame === homeFrame) {
          inputs.push({ kind: "home", timeMs });
        }
        return inputs;
      },
    });
    expect(recorded.cardsChosen).toBeGreaterThan(0);
    expect(recorded.walk.run.phase).toEqual({ kind: "ended", reason: "wentHome" });

    const events = [...replayInputs(recorded.log)];
    let next = 0;
    const replayed = play({
      choose: () => {
        const event = events[next];
        next += 1;
        if (event?.kind !== "card") {
          throw new Error(`Expected a card choice at event ${next - 1}`);
        }
        return event.choice;
      },
      due: (_, timeMs) => {
        const taken = takeDueInputs(events, next, timeMs);
        next = taken.next;
        return taken.due;
      },
    });
    expect(replayed.walk).toEqual(recorded.walk);
    expect(replayed.log).toEqual(recorded.log);
  });
});

describe("walkScrollSpeed", () => {
  it("walks every walker on the same road at the same speed", () => {
    const speeds = (Object.keys(WALKERS) as WalkerId[]).map((walker) =>
      walkScrollSpeed(REAL, realRun(REAL, walker)),
    );
    expect(new Set(speeds).size).toBe(1);
  });
});

describe("finishZone", () => {
  const pay = read(tuning, "money", "payPerDog");

  it("banks every walking dog's pay and moves on to the next zone", () => {
    const { run } = walkWith(["koda", "duchess"]);
    const { fees, run: next } = finishZone(data, { ...run, zoneDistance: zoneLength(data) });
    expect(next.money).toBe(run.money + 2 * pay);
    expect(fees.map(({ amount, dog }) => ({ amount, dog }))).toEqual([
      { amount: pay, dog: "koda" },
      { amount: pay, dog: "duchess" },
    ]);
    expect(next.zoneIndex).toBe(1);
    expect(next.zoneDistance).toBe(0);
    expect(next.phase).toEqual({ kind: "walking" });
  });

  it("starts the next zone with Hall pass's Skip and Second chance back and no cards counted", () => {
    const { run } = walkWith(["koda"]);
    const skipPass = { gear: "hallPass", kind: "gear" } as const;
    const used = { ...run, cardsThisZone: 2, heartsForgiven: 1, skipPass, skipUsed: true };
    expect(finishZone(data, used).run).toMatchObject({
      cardsThisZone: 0,
      heartsForgiven: 0,
      skipPass,
      skipUsed: false,
    });
  });

  it("ends the zone's effects, keeping run-long ones", () => {
    const { run } = walkWith(["koda"]);
    const withEffects = {
      ...run,
      debuffs: [{ debuff: "stinky" as const, secondsLeft: 20, untilZone: 0 }],
      immunities: [
        { encounter: "puddle" as const, source: RAINCOATS },
        { encounter: "thief" as const, source: RAINCOATS, untilZone: 0 },
      ],
    };
    const { run: next } = finishZone(data, withEffects);
    expect(next.debuffs).toEqual([]);
    expect(next.immunities).toEqual([{ encounter: "puddle", source: RAINCOATS }]);
  });

  it("ends the run, finished, after the last zone, banking its pay and the full pack bonus", () => {
    const { run } = walkWith(["koda", "duchess"]);
    const end = finishZone(data, { ...run, zoneIndex: WORLD.walkLength - 1 });
    const bonus = 2 * read(tuning, "money", "fullPackBonusPerDog");
    expect(end.run.phase).toEqual({ kind: "ended", reason: "finished" });
    expect(end.run.money).toBe(run.money + 2 * pay + bonus);
    expect(end.fees.map(({ causes }) => causes[0]?.kind)).toEqual(["pay", "pay", "bonus"]);
  });

  it("pays no full pack bonus once an owner has fired you", () => {
    const { run } = walkWith(["koda", "duchess"]);
    const fired = {
      ...run,
      pack: mapPack(
        (slot) =>
          slot.dog === "duchess" ? { dog: slot.dog, status: "fired" as const, zoneIndex: 0 } : slot,
        run.pack,
      ),
      zoneIndex: WORLD.walkLength - 1,
    };
    const end = finishZone(data, fired);
    expect(end.run.money).toBe(run.money + pay);
    expect(end.fees.map(({ causes }) => causes[0]?.kind)).toEqual(["pay"]);
  });
});

describe("headHome", () => {
  it("keeps the money banked and pays nothing for the current zone", () => {
    const { run } = walkWith(["koda", "duchess"]);
    const banked = finishZone(data, run).run;
    const home = headHome(banked);
    expect(home.money).toBe(banked.money);
    expect(home.phase).toEqual({ kind: "ended", reason: "wentHome" });
  });
});

describe("obstacleWeights", () => {
  it("weighs every obstacle encounter, and no lucky one", () => {
    const ids = obstacleWeights(data, walkWith(["biscuit"]).run).map(([id]) => id as string);
    const obstacles = Object.entries(ENCOUNTERS)
      .filter(([, encounter]) => encounter.kind === "obstacle")
      .map(([id]) => id);
    expect(ids.sort()).toEqual(obstacles.sort());
  });
});

describe("pickWeighted", () => {
  it("picks each entry in proportion to its weight", () => {
    const random = seededRandom(5);
    const picks = Array.from({ length: 4000 }, () =>
      pickWeighted(random, [
        ["a", 3],
        ["b", 1],
        ["c", 0],
      ]),
    );
    const share = picks.filter((pick) => pick === "a").length / picks.length;
    expect(share).toBeGreaterThan(0.7);
    expect(share).toBeLessThan(0.8);
    expect(picks).not.toContain("c");
  });
});

describe("movers", { timeout: 60_000 }, () => {
  const OBSTACLE_KINDS = [...OBSTACLE_IDS, ...MINOR_OBSTACLE_IDS] as WalkItem["kind"][];
  // The rulebook's obstacles that never move: barriers, benches, bins, cones, hedges and puddles.
  const NEVER_MOVE: readonly WalkItem["kind"][] = [
    "barrier2",
    "barrier3",
    "bench",
    "bin",
    "cone",
    "hedge",
    "puddle",
  ];
  const movementOf = (kind: WalkItem["kind"], tuned: Real = REAL) => {
    const entry = Object.hasOwn(MINOR_OBSTACLES, kind)
      ? tuned.minorObstacles[kind as MinorObstacleId]
      : tuned.encounters[kind as ObstacleEncounterId];
    const movement = ("movement" in entry ? entry.movement : undefined) as Movement | undefined;
    return movement === undefined || movement.kind === "still" ? null : movement;
  };

  it("never moves an obstacle the rulebook keeps still", () => {
    for (const kind of NEVER_MOVE) {
      expect(movementOf(kind)).toBeNull();
    }
  });

  it("moves every obstacle at the share only when it has a movement", () => {
    for (const kind of OBSTACLE_KINDS) {
      let draws = 0;
      const counted = (value: number) => () => {
        draws += 1;
        return value;
      };
      expect(moverMovement(REAL, counted(0), 1, kind)).toEqual(movementOf(kind));
      expect(moverMovement(REAL, counted(0.99), 0.5, kind)).toBeNull();
      const before = draws;
      expect(moverMovement(REAL, counted(0), 0, kind)).toBeNull();
      expect(draws).toBe(before);
    }
  });

  it("never moves a pickup or lucky find, drawing nothing", () => {
    for (const kind of ["tip", "treat", "lostWallet"] as const) {
      const never = () => {
        throw new Error("drew");
      };
      expect(moverMovement(REAL, never, 1, kind)).toBeNull();
    }
  });

  // Movement values the planner can build: a dart is one cell, its tilt keeps it coming down
  // the road, and an in-lane mover moves at another speed than the road.
  it("gives every obstacle a movement the planner can build", () => {
    for (const kind of OBSTACLE_KINDS) {
      const movement = movementOf(kind);
      if (movement?.kind === "dart") {
        expect(footprintOf(REAL, kind)).toEqual({ lanes: 1, rows: 1 });
        expect(Math.abs(movement.tilt ?? 0)).toBeLessThan(1);
      } else if (movement?.kind === "inLane") {
        expect(movement.factor).toBeGreaterThan(0);
        expect(movement.factor).not.toBe(1);
      }
    }
  });

  // Every zone at the fastest pace in the last zone, at the zones' shares and with every
  // obstacle that can move moving: a way past every lane-blocking spawn from every lane, at
  // most the caps of movers on screen, the pack-fit gap wherever the path changes lanes between
  // two obstacles, and each mover moving as its kind does.
  const everyMover: Real = { ...REAL, world: sharedWorld(WORLD, 1) };
  // Every stepper and hopper hopping alike, each hop up to 2 spots any way, or sideways only.
  const HOPS: readonly HopMovement[] = [
    { kind: "hop", most: 2, times: { max: 2, min: 1 } },
    { kind: "hop", most: 2, sideways: true, times: { max: 2, min: 1 } },
  ];
  const hopping = HOPS.map((hop) => ({
    hop,
    name: `1 or 2 hops of up to ${hop.most} spots${hop.sideways === true ? ", sideways" : ""}`,
    tuned: hoppingInstead(everyMover, hop),
  }));
  const worlds = [
    { name: "the zones' shares", tuned: REAL },
    { name: "a share of 1", tuned: everyMover },
    ...hopping.slice(0, 1),
  ];
  // The game's pack, and a taller one on rows spaced wider by as much.
  const packs = [
    { pack: "the game's pack", road: GAME_ROAD, taller: 0 },
    { pack: "a taller pack", road: TALL_PACK_ROAD, taller: TALLER },
  ];
  it("keeps every move passable in every zone, at the shares, at a share of 1 and hopping", () => {
    for (const { road, tuned, zone } of worlds.flatMap(({ name, tuned }, i) =>
      packs
        .slice(0, i === 1 ? 2 : 1)
        .flatMap(({ pack, road, taller }) =>
          ZONE_IDS.map((zone) => ({ name, pack, road, tuned: widerRows(tuned, taller), zone })),
        ),
    )) {
      const zoned = inZone(realRun(tuned, FASTEST_WALKER), zone, WORLD.walkLength - 1);
      const steps = Math.ceil(slowestLaneMove / STEP_SECONDS - 1e-9);
      const fit = road.tallestPackBand + steps * STEP_SECONDS * walkScrollSpeed(tuned, zoned);
      for (const seed of [1]) {
        const walk = planZone(tuned, road, plannerStreams(seed), {
          road: startRoad(LANE_COUNT),
          run: zoned,
        });
        const blocking = walk.road.pending.filter((event) => blocksLane(tuned, event.kind));
        const spans = blockingSpans(tuned, road, zone, blocking);
        for (const start of LANES) {
          const reached = lanesReachedAtEnd(walkwayOf(tuned, zoned), spans, start);
          expect(reached, `seed ${seed}, from lane ${start}`).not.toEqual([]);
        }
        const movers = blocking.flatMap(({ distance, kind, mover }) =>
          mover === undefined ? [] : [{ distance, kind, mover }],
        );
        for (const { kind, mover } of movers) {
          expect(mover.movement).toBe(movementOf(kind, tuned)?.kind);
        }
        expectCapsOnScreen(movers);
        // Each obstacle's contact with the pack: its hit box's extent and its lanes.
        const contacts = blocking.map((event) => {
          if (event.mover === undefined) {
            const { lanes } = footprintOf(tuned, event.kind);
            return {
              end: event.distance + plannedHeight(tuned, road, zone, event.kind),
              kind: event.kind,
              lanes: new Set(Array.from({ length: lanes }, (_, i) => event.lane + i)),
              start: event.distance,
            };
          }
          const touched = moverSpans(tuned, road, zone, { ...event, mover: event.mover });
          const from = Math.min(...touched.map(({ distance }) => distance));
          const to = Math.max(...touched.map(({ distance }) => distance + 1));
          return {
            end: to - road.tallestPackBand,
            kind: event.kind,
            lanes: new Set(touched.map(({ lane }) => lane)),
            start: from,
          };
        });
        for (const near of contacts.filter(({ lanes }) => lanes.size > 0)) {
          for (const far of contacts.filter(({ start }) => start > near.start)) {
            const steppedIn = [...far.lanes].some(
              (beside) =>
                !near.lanes.has(beside) &&
                [beside - 1, beside + 1].some(
                  (lane) => near.lanes.has(lane) && !far.lanes.has(lane),
                ),
            );
            const gap = far.start - near.end;
            if (steppedIn && gap > 0) {
              expect(gap, `seed ${seed}: ${near.kind} then ${far.kind}`).toBeGreaterThanOrEqual(
                fit - 1,
              );
            }
          }
        }
      }
    }
  });

  it("plans the same movers for the same seed", () => {
    for (const { tuned } of [{ name: "every mover", tuned: everyMover }]) {
      const zoned = inZone(realRun(tuned, FASTEST_WALKER), "homeStretch", WORLD.walkLength - 1);
      const plan = (seed: number) =>
        planZone(tuned, GAME_ROAD, plannerStreams(seed), {
          road: startRoad(LANE_COUNT),
          run: zoned,
        }).road.pending;
      expect(plan(4)).toEqual(plan(4));
      expect(plan(5)).not.toEqual(plan(4));
    }
  });

  // A hop is one jump of 1 to most spots one way, across, up the road or diagonally up, never
  // down, sideways only when it says so, as long as the tuning's hop; across zones and seeds,
  // hoppers make hops of every length they can, and hop every count of times in their range at
  // the first zone's pace, the slowest; a later hop that would come once the hopper has reached
  // the pack's rows never does.
  it("hops each hopper its drawn count of times, any way or sideways only", () => {
    for (const { hop, tuned } of hopping) {
      const spots = new Set<number>();
      const times = new Set<number>();
      for (const [zone, zoneIndex] of ZONE_IDS.flatMap((id) =>
        [0, WORLD.walkLength - 1].map((index) => [id, index] as const),
      )) {
        const zoned = inZone(realRun(tuned, FASTEST_WALKER), zone, zoneIndex);
        const length = hopSeconds(tuned) * walkScrollSpeed(tuned, zoned);
        for (const seed of [1, 2, 3]) {
          const walk = planZone(tuned, GAME_ROAD, plannerStreams(seed), {
            road: startRoad(LANE_COUNT),
            run: zoned,
          });
          for (const { mover } of walk.road.pending) {
            if (mover?.movement !== "hop") {
              continue;
            }
            expect(mover.motion).toBe("steps");
            const steps = mover.motion === "steps" ? mover.steps : [];
            expect(steps.length).toBeGreaterThanOrEqual(1);
            expect(steps.length).toBeLessThanOrEqual(hop.times.max);
            times.add(steps.length);
            for (const { lanes, length: hopLength, travel } of steps) {
              const rows = -travel / GAME_ROAD.cell.length;
              expect(rows).toBeGreaterThanOrEqual(0);
              expect(lanes === 0 || rows === 0 || Math.abs(lanes) === rows).toBe(true);
              if (hop.sideways === true) {
                expect(travel).toBe(0);
              }
              expect(hopLength).toBeCloseTo(length);
              spots.add(Math.max(Math.abs(lanes), rows));
            }
          }
        }
      }
      expect([...spots].sort()).toEqual(Array.from({ length: hop.most }, (_, i) => i + 1));
      expect([...times].sort()).toEqual([1, 2]);
    }
  });

  // Each stepper, hopper and stalker of the game's data, planned across seeds at the first
  // zone's pace and the last's with every mover moving: a stalker plans for its drawn count of
  // steps, each count in its kind's range coming up, and a stepper or hopper moves at least once
  // and never more than its kind's most.
  const counted = OBSTACLE_KINDS.flatMap((kind) => {
    const movement = movementOf(kind);
    if (movement?.kind === "approach" || movement?.kind === "step") {
      return [{ kind, range: movement.steps }];
    }
    return movement?.kind === "hop" ? [{ kind, range: movement.times }] : [];
  });
  let countedPlans: readonly { kind: WalkItem["kind"]; mover: MoverPath }[] | null = null;
  const plannedMovers = () => {
    countedPlans ??= ZONE_IDS.flatMap((zone) =>
      [0, WORLD.walkLength - 1].flatMap((zoneIndex) =>
        [1, 2, 3, 4].flatMap((seed) => {
          const zoned = inZone(realRun(everyMover, FASTEST_WALKER), zone, zoneIndex);
          const walk = planZone(everyMover, GAME_ROAD, plannerStreams(seed), {
            road: startRoad(LANE_COUNT),
            run: zoned,
          });
          return walk.road.pending.flatMap(({ kind, mover }) =>
            mover === undefined ? [] : [{ kind, mover }],
          );
        }),
      ),
    );
    return countedPlans;
  };
  it.each(counted)("moves each $kind within its range of times across seeds", ({ kind, range }) => {
    const paths = plannedMovers().filter((planned) => planned.kind === kind);
    expect(paths.length).toBeGreaterThan(0);
    const stalked = new Set<number>();
    for (const { mover } of paths) {
      if (mover.motion === "approach") {
        expect(mover.rows).toBeGreaterThanOrEqual(range.min);
        expect(mover.rows).toBeLessThanOrEqual(range.max);
        expect(mover.pending).toHaveLength(mover.rows);
        stalked.add(mover.rows);
      } else if (mover.motion === "steps") {
        expect(mover.steps.length).toBeGreaterThanOrEqual(1);
        expect(mover.steps.length).toBeLessThanOrEqual(range.max);
      }
    }
    if (stalked.size > 0) {
      expect([...stalked].sort()).toEqual(
        Array.from({ length: range.max - range.min + 1 }, (_, i) => range.min + i),
      );
    }
  });

  it("brings a mover onto the road as its cue, carrying its path", () => {
    const walk = walkWith(["koda"]);
    const due: Walk = {
      ...walk,
      road: {
        ...walk.road,
        pending: [{ distance: 0.5, kind: "squirrel", lane: 0, mover: crossing }],
      },
    };
    const [item] = step(due, 0.05).walk.road.items;
    const height = itemHeight(data, geometry, "squirrel", true);
    expect(item?.mover?.since).toBeCloseTo(3.5);
    expect(item?.y).toBeCloseTo(40 - height + 450 + 3.5);
  });

  // A stalker in lane 2 that may step a lane either side and a row down chooses its step as
  // its cue begins, toward the pack where the pack stands then.
  it("steps a stalker toward the pack's lane as its cue begins", () => {
    for (const { lane, want } of [
      { lane: 0, want: -1 },
      { lane: 1, want: -1 },
      { lane: 2, want: 0 },
      { lane: 3, want: 1 },
      { lane: 4, want: 1 },
    ]) {
      const stalking: MoverPath = {
        burst: geometry.cell.length,
        lane: 2,
        length: 50,
        motion: "approach",
        movement: "approach",
        pending: [{ at: 300, kind: "after" }],
        reach: { count: 3, first: 1 },
        rows: 1,
        steps: [],
        stopTravel: geometry.sightLength,
        warning: 100,
      };
      const before = inLane(lane, walkWith(["koda"], [moverAt("coyote", stalking, 200 - 1e-6)]));
      const [waiting] = step(before, 0).walk.road.items;
      expect(waiting?.mover?.path).toBe(stalking);
      const [item] = step(before).walk.road.items;
      const path = item?.mover?.path;
      expect(path?.motion === "approach" ? path.steps : []).toEqual([
        { at: 300, lanes: want, length: 50, travel: geometry.cell.length },
      ]);
    }
  });

  // A stalker's second step has no cue: it is chosen as it starts, once the first has ended.
  it("chooses a stalker's second step as it starts, with no cue", () => {
    const first = { at: 100, lanes: 0, length: 50, travel: geometry.cell.length };
    const stalking: MoverPath = {
      burst: geometry.cell.length,
      lane: 2,
      length: 50,
      motion: "approach",
      movement: "approach",
      pending: [{ kind: "near", travel: 0 }],
      reach: { count: 3, first: 1 },
      rows: 2,
      steps: [first],
      stopTravel: geometry.sightLength,
      warning: 100,
    };
    const before = inLane(4, walkWith(["koda"], [moverAt("coyote", stalking, 150 - 1e-6)]));
    const [waiting] = step(before, 0).walk.road.items;
    expect(waiting?.mover?.path).toBe(stalking);
    const [item] = step(before).walk.road.items;
    const path = item?.mover?.path;
    expect(path?.motion === "approach" ? path.steps : []).toEqual([
      first,
      { at: 150, lanes: 1, length: 50, travel: geometry.cell.length, uncued: true },
    ]);
  });

  // A shy hopper in lane 2 that may hop a lane either side and a row up chooses its hop as its
  // cue begins, away from the pack where the pack stands then: out of the pack's lane, to the
  // side away from it, and up the road, the first way on a tie.
  it.each([
    { lane: 0, want: 1 },
    { lane: 1, want: 1 },
    { lane: 2, want: -1 },
    { lane: 3, want: -1 },
    { lane: 4, want: -1 },
  ])("hops a shy hopper away from the pack in lane $lane as its cue begins", ({ lane, want }) => {
    const shy: MoverPath = {
      burst: geometry.cell.length,
      lane: 2,
      length: 30,
      motion: "shy",
      movement: "hop",
      pending: [300],
      reach: { count: 3, first: 1 },
      rise: 1,
      shapes: hopShapes(1, false),
      steps: [],
      stopTravel: geometry.sightLength,
      warning: 100,
    };
    const before = inLane(lane, walkWith(["koda"], [moverAt("bunny", shy, 200 - 1e-6)]));
    const [waiting] = step(before, 0).walk.road.items;
    expect(waiting?.mover?.path).toBe(shy);
    const [item] = step(before).walk.road.items;
    const path = item?.mover?.path;
    expect(path?.motion === "shy" ? path.steps : []).toEqual([
      { at: 300, lanes: want, length: 30, travel: -geometry.cell.length },
    ]);
  });

  // About half of a shy kind's hoppers hop shy, drawn per mover, across zones and seeds.
  it("hops about half of a shy kind's hoppers shy", () => {
    const shyHops = hoppingInstead(everyMover, {
      kind: "hop",
      most: 2,
      shy: true,
      times: { max: 2, min: 1 },
    });
    const motions = ZONE_IDS.flatMap((zone) =>
      [1, 2, 3].flatMap((seed) => {
        const zoned = inZone(realRun(shyHops, FASTEST_WALKER), zone, 0);
        return planZone(shyHops, GAME_ROAD, plannerStreams(seed), {
          road: startRoad(LANE_COUNT),
          run: zoned,
        }).road.pending.flatMap(({ mover }) => (mover?.movement === "hop" ? [mover.motion] : []));
      }),
    );
    const share = motions.filter((motion) => motion === "shy").length / motions.length;
    expect(motions.length).toBeGreaterThan(40);
    expect(share).toBeGreaterThan(0.35);
    expect(share).toBeLessThan(0.65);
  });

  it("passes through a squirrel however it meets it: no card, heart, grace or stop", () => {
    for (const [, item] of [
      ["standing in the lane", atPack("squirrel")],
      ["darting across it", moverAt("squirrel", crossing, 82)],
    ] as const) {
      const walk = walkWith(["koda"], [item]);
      const after = step(walk);
      expect(after.cards).toEqual([]);
      expect(after.encounterHits).toEqual([]);
      expect(after.contacts).toEqual([]);
      expect(heartsByDog(after.walk.run)).toEqual(heartsByDog(walk.run));
      expect(after.walk.road.items.map(({ kind }) => kind)).toEqual(["squirrel"]);
      expect(after.walk.road.hitStop).toBeNull();
      expect(after.walk.road.invulnerableSeconds).toBe(0);
    }
  });

  it("opens a mover's card on contact", () => {
    for (const { dogs, encounter, item } of [
      {
        dogs: ["duchess"],
        encounter: "otherDog",
        item: moverAt("otherDog", crossing, 82),
        name: "a loose dog",
      },
    ] satisfies readonly {
      dogs: PackDogs;
      encounter: EncounterId;
      item: WalkItem;
      name: string;
    }[]) {
      const { walk } = step(walkWith(dogs, [item]));
      expect(walk.road.hitStop?.cards).toEqual([{ affected: dogs, encounter, kind: "encounter" }]);
    }
  });

  it("bumps the pack like a plain obstacle on contact with a ball or an in-lane cyclist", () => {
    const ball = crossing;
    expect(step(walkWith(["koda"], [moverAt("ball", ball, 82)])).bumps).toHaveLength(1);
    const cyclist: MoverPath = {
      lane: 2,
      lanes: 1,
      motion: "ride",
      movement: "inLane",
      speedMultiplier: 2,
      warning: 50,
    };
    // 50px of cue, then 266px of scroll at twice the road's speed: 532px down the road.
    expect(step(walkWith(["koda"], [moverAt("cyclist", cyclist, 316)])).bumps).toHaveLength(1);
  });
});
