import { describe, expect, it } from "vitest";

import { itemAt } from "../arrays";
import { ACHIEVEMENTS } from "../data/achievements";
import { DEBUFFS } from "../data/debuffs";
import { DOGS } from "../data/dogs";
import { DOG_SLOTS } from "../data/dogSlots";
import { ENCOUNTERS } from "../data/encounters";
import { FORCED_STOPS } from "../data/forcedStops";
import { MINOR_OBSTACLES } from "../data/minorObstacles";
import { NEED_CARDS, NEED_SPOTS, NEEDS } from "../data/needs";
import { QUIRKS } from "../data/quirks";
import { RUN_TEXT } from "../data/runText";
import { LANE_COUNT, ROAD_CAMERA, SCREEN_CONFIG } from "../data/screen";
import { SHOP_GEAR } from "../data/shop";
import { TUNING } from "../data/tuning";
import type {
  EncounterId,
  MinorObstacleId,
  Movement,
  ObstacleEncounterId,
  WalkerId,
  World,
  Zone,
  ZoneId,
} from "../data/types";
import { UPGRADES } from "../data/upgrades";
import { DEFAULT_WALKER, WALKERS } from "../data/walkers";
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
import { screenLayout } from "../layout/screenLayout";
import { earnedByRun, runCountersOf } from "../rules/achievements";
import { cardFor, type CardView, chooseOption, openCard } from "../rules/choices";
import { tipValue } from "../rules/run";
import { giveTreat } from "../rules/treats";
import { cents, pixels, read, readTable } from "../rules/units";
import { newRun, type PackDogs, type RunState } from "../state/runState";
import { type BlockingSpan, laneChangesBehind, lanesReachedAtEnd } from "../testing/avoidable";
import { TEST_TUNING, withNeutralWalkers } from "../testing/tuning";
import { TEST_WALKER_DATA } from "../testing/walkers";
import { TEST_WORLD } from "../testing/world";
import { STEP_SECONDS } from "./fixedStep";
import { isSteeringLocked } from "./laneControl";
import { stillInLane } from "./laneMotion";
import { hasLeftRoad, laneAt, type MoverPath, moverPlace, onScreenOf } from "./movers";
import { seededRandom } from "./random";
import {
  type AreaContact,
  blocksLane,
  finishZone,
  footprintOf,
  headHome,
  itemCategory,
  itemHeight,
  laneMoveSeconds,
  minorObstacleWeights,
  moverMovement,
  obstacleWeights,
  pickWeighted,
  planZone,
  type RoadGeometry,
  startRoad,
  steerWalk,
  stepWalk,
  thinTips,
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
    minorStumble: 0.5,
    zoneAtBaseSpeed: 30,
  },
};
const data = {
  debuffs: DEBUFFS,
  dogs: DOGS,
  encounters: ENCOUNTERS,
  forcedStops: FORCED_STOPS,
  minorObstacles: MINOR_OBSTACLES,
  needCards: NEED_CARDS,
  needSpots: NEED_SPOTS,
  needs: NEEDS,
  quirks: QUIRKS,
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
// The game's road, as RunScene lays it out for a pack of three.
const GAME_ROAD = (() => {
  const road = screenLayout(SCREEN_CONFIG).road;
  return walkGeometry(LANE_COUNT, 3, walkProjection(ROAD_CAMERA, road), road);
})();
const ROAD_LENGTH = GAME_ROAD.roadBottom - GAME_ROAD.roadTop;
const realRun = (tuned: Real, walker: WalkerId = DEFAULT_WALKER) =>
  newRun(tuned, 3, { dogs: ["duchess", "biscuit", "koda"], gear: null, walker });
// The world with every zone at this mover share.
function sharedWorld(world: World, share: number): World {
  const [first, ...rest] = world.zones;
  const shared = (zone: Zone): Zone => ({ ...zone, moverShare: share });
  return { ...world, zones: [shared(first), ...rest.map(shared)] };
}
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
const walkwayOf = (tuned: Real, run: RunState) => ({
  laneCount: LANE_COUNT,
  laneMoveSeconds: read(TUNING, "seconds", "laneMove"),
  scrollSpeed: walkScrollSpeed(tuned, run),
  zoneLength: zoneLength(tuned, run),
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
// A standing spawn's span on the game's road.
const standingSpan = (
  tuned: Real,
  { distance, kind, lane }: { distance: number; kind: WalkItem["kind"]; lane: number },
): BlockingSpan => ({
  distance,
  lane,
  laneSpan: footprintOf(tuned, kind).lanes,
  length: itemHeight(tuned, GAME_ROAD, kind) + GAME_ROAD.tallestPackBand,
});
// A pixel-long span for each pixel of scroll a mover overlaps the pack in each lane of the
// game's road it covers.
function moverSpans(
  tuned: Real,
  event: { distance: number; kind: WalkItem["kind"]; mover: MoverPath },
): BlockingSpan[] {
  const sight = GAME_ROAD.sightLength;
  const window = itemHeight(tuned, GAME_ROAD, event.kind) + GAME_ROAD.tallestPackBand;
  const across = footprintOf(tuned, event.kind).lanes;
  return Array.from({ length: Math.ceil(4 * ROAD_LENGTH) }, (_, since) => {
    const place = moverPlace(LANE_COUNT, event.mover, since);
    const first = laneAt(place.lanePosition);
    const overlaps = place.solid && place.travel >= sight && place.travel < sight + window;
    return Array.from({ length: across }, (_unused, i) => first + i)
      .filter((lane) => overlaps && lane >= 0 && lane < LANE_COUNT)
      .map((lane) => ({ distance: event.distance + since - sight, lane, laneSpan: 1, length: 1 }));
  }).flat();
}
// Every lane-blocking spawn's spans on the game's road: a standing one's, or a mover's as it
// passes the pack.
const blockingSpans = (tuned: Real, pending: Walk["road"]["pending"]): BlockingSpan[] =>
  pending
    .filter((event) => blocksLane(tuned, event.kind))
    .flatMap((event) =>
      event.mover === undefined
        ? [standingSpan(tuned, event)]
        : moverSpans(tuned, { ...event, mover: event.mover }),
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
  itemHeights: { forcedStop: 16, lucky: 20, needSpot: 20, tip: 12, treat: 12 },
  laneCount: 5,
  packBand: { bottom: 630, top: 554 },
  roadBottom: 640,
  roadTop: 40,
  sightLength: 514,
  tallestPackBand: 76,
};

const walkWith = (dogs: PackDogs, items: WalkItem[] = []): Walk => ({
  road: { ...startRoad(5), items, nextItemId: items.length },
  run: newRun(data, 3, { dogs, gear: null, walker: "casey" }),
});
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
  const planned = planZone(data, geometry, seededRandom(3), walkWith(["koda"]));
  const countOf = (category: string) =>
    planned.road.pending.filter((event) => itemCategory(data, event.kind) === category).length;

  it("plans the zone's counts of each kind of spawn", () => {
    expect(countOf("obstacle")).toBe(6);
    expect(countOf("minor")).toBe(4);
    const solo = readTable(tuning, "multipliers", "tipSpawnsByPackSize", 1);
    expect(countOf("tip")).toBe(Math.round(tuning.counts.tipsFirstZone * solo));
    expect(countOf("treat")).toBe(2);
    expect(countOf("lucky")).toBe(2);
  });

  // Without minor obstacles three lanes wide, which only fit after a row that blocks lanes
  // beside them, so the planner has room for every obstacle at either pace.
  it("scales the obstacles, tips and need spots by the walker's pace, and nothing else", () => {
    const narrow = (zone: Zone): Zone => ({
      ...zone,
      weights: {
        ...zone.weights,
        minorObstacles: Object.fromEntries(
          Object.entries(zone.weights.minorObstacles).map(([id, weight]) => [
            id,
            footprintOf(data, id as MinorObstacleId).lanes > 2 ? 0 : weight,
          ]),
        ) as Zone["weights"]["minorObstacles"],
      },
    });
    const [first, ...rest] = data.world.zones;
    const world: World = { ...data.world, zones: [narrow(first), ...rest.map(narrow)] };
    const roomy = { ...data, world };
    const paced = {
      ...roomy,
      tuning: { ...tuning, multipliers: { ...tuning.multipliers, fastWalkerSpeed: 2 } },
    };
    const counts = (tuned: typeof data) => {
      const walk = {
        ...walkWith(["koda"]),
        run: newRun(tuned, 1, { dogs: ["koda"], gear: null, walker: "trista" }),
      };
      const plan = planZone(tuned, geometry, seededRandom(3), walk);
      const count = (category: string) =>
        plan.road.pending.filter((event) => itemCategory(tuned, event.kind) === category).length;
      return {
        lucky: count("lucky"),
        minor: count("minor"),
        needSpot: count("needSpot"),
        obstacle: count("obstacle"),
        tip: count("tip"),
        treat: count("treat"),
      };
    };
    const base = counts(roomy);
    expect(base.needSpot).toBeGreaterThan(0);
    expect(counts(paced)).toEqual({
      lucky: base.lucky,
      minor: 2 * base.minor,
      needSpot: 2 * base.needSpot,
      obstacle: 2 * base.obstacle,
      tip: 2 * base.tip,
      treat: base.treat,
    });
  });

  it("places a forced stop in the middle third of the zone", () => {
    const distance = planned.road.forcedStopAhead?.distance ?? 0;
    const length = zoneLength(data, planned.run);
    expect(distance).toBeGreaterThan(length / 3 - 160);
    expect(distance).toBeLessThan((2 * length) / 3 + 160);
  });

  it("draws only the minor obstacles the current zone weighs above 0", () => {
    const walk = walkWith(["koda"]);
    const real = { ...data, world: WORLD };
    for (const zone of ZONE_IDS) {
      const run = inZone(walk.run, zone, 0);
      const allowed = minorObstacleWeights(real, run).map(([kind]) => kind as string);
      for (const seed of [1, 2, 3]) {
        const kinds = planZone(real, geometry, seededRandom(seed), { ...walk, run })
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
            cafe: 0,
            goose: 0,
            otherDog: 0,
            petunias: 0,
            picnic: 0,
            puddle: 2,
            skunk: 0,
            squirrel: 0,
            thief: 0,
            trash: 0,
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

  // planZone throws when a tuned spawn finds no room, so this also proves none is dropped. At
  // the road's base speed, which a walker's pace scales.
  it("plans every zone of the game's road, first walk and last, with a way past every obstacle from any lane", () => {
    const base = { ...REAL, tuning: withNeutralWalkers(TUNING) };
    for (const zone of ZONE_IDS) {
      for (const zoneIndex of [0, WORLD.walkLength - 1]) {
        const zoned = inZone(realRun(base), zone, zoneIndex);
        for (const seed of [1, 2, 3]) {
          const walk = planZone(base, GAME_ROAD, seededRandom(seed), {
            road: startRoad(LANE_COUNT),
            run: zoned,
          });
          const spans = blockingSpans(base, walk.road.pending);
          for (const start of [0, 2, 4]) {
            expect(lanesReachedAtEnd(walkwayOf(base, zoned), spans, start)).not.toEqual([]);
          }
        }
      }
    }
  });

  it("shows each row of the game's road in time to cross the whole road for it, in every zone, at every pace", () => {
    const acrossRoad = (LANE_COUNT - 1) * read(TUNING, "seconds", "laneMove");
    for (const walker of Object.keys(WALKERS) as WalkerId[]) {
      for (const zone of ZONE_IDS) {
        const zoned = inZone(realRun(REAL, walker), zone, WORLD.walkLength - 1);
        const lookAhead = GAME_ROAD.sightLength / walkScrollSpeed(REAL, zoned);
        expect(lookAhead, `${walker} in ${zone}`).toBeGreaterThan(acrossRoad + 1);
      }
    }
  });

  // Each obstacle's weight raised on every zone in turn, then every obstacle's and every minor
  // obstacle's at once, at the fastest pace in the last zone, where the road is fastest.
  it.each<{ name: string; world: World }>([
    ...OBSTACLE_IDS.map((id) => ({
      name: id,
      world: reweighed((weights) => ({ ...weights, obstacles: raised(weights.obstacles, [id]) })),
    })),
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
  ])("plans a way past every row from any lane with $name weighed higher", ({ world }) => {
    const tuned = { ...REAL, world };
    for (const zone of ZONE_IDS) {
      const zoned = inZone(realRun(tuned, FASTEST_WALKER), zone, WORLD.walkLength - 1);
      for (const seed of [1, 2, 3]) {
        const walk = planZone(tuned, GAME_ROAD, seededRandom(seed), {
          road: startRoad(LANE_COUNT),
          run: zoned,
        });
        const spans = blockingSpans(tuned, walk.road.pending);
        for (const start of LANES) {
          const reached = lanesReachedAtEnd(walkwayOf(tuned, zoned), spans, start);
          expect(reached, `${zone}, seed ${seed}, from lane ${start}`).not.toEqual([]);
        }
      }
    }
  });

  // Two standing obstacles: a pack passing the nearer one in a lane the farther one blocks, that
  // gets out of it by stepping in behind the nearer one, changes lanes between the two from the
  // first lane the nearer one blocks to the nearest lane the farther one leaves open. Road
  // between them is at least the tallest pack, those lane moves in whole walk steps and the
  // reaction margin, on every way out. Two obstacles two or more lanes wide have a row between
  // them. At the road's speed in the last neighbourhood, for the walkers whose lane moves cover
  // the least and the most road.
  it.each(LANE_MOVE_WALKERS.flatMap((walker) => ZONE_IDS.map((zone) => ({ walker, zone }))))(
    "spaces obstacles for the pack to change lanes between them in $zone with $walker",
    ({ walker, zone }) => {
      const zoned = inZone(realRun(REAL, walker), zone, WORLD.walkLength - 1);
      const speed = walkScrollSpeed(REAL, zoned);
      const steps = Math.ceil(read(TUNING, "seconds", "laneMove") / STEP_SECONDS - 1e-9);
      const laneMove = steps * STEP_SECONDS * speed;
      const margin = read(TUNING, "seconds", "pathReactionMargin") * speed;
      const lanesOf = (kind: WalkItem["kind"], lane: number) =>
        new Set(Array.from({ length: footprintOf(REAL, kind).lanes }, (_, i) => lane + i));
      for (const seed of [1, 2, 3, 4, 5, 6]) {
        const walk = planZone(REAL, GAME_ROAD, seededRandom(seed), {
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
            const gap = far.distance - near.distance - itemHeight(REAL, GAME_ROAD, near.kind);
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
    },
  );

  it("draws a forced stop not met yet this run", () => {
    let walk = planned;
    for (let zone = 0; zone < 4; zone++) {
      walk = planZone(data, geometry, seededRandom(zone), walk);
    }
    expect(new Set(walk.road.forcedStopsSeen).size).toBe(walk.road.forcedStopsSeen.length);
  });
});

describe("stepWalk", () => {
  it("brings only Stinky's share of the tips due into view", () => {
    const walk = walkWith(["koda"]);
    const pending = [0, 1, 3, 4].map((lane) => ({ distance: 0.5, kind: "tip", lane }) as const);
    const due: Walk = { ...walk, road: { ...walk.road, pending } };
    const stinky: Walk = { ...due, run: { ...due.run, debuffs: [{ debuff: "stinky" }] } };
    const tipsInView = (from: Walk) =>
      step(from, 0.05).walk.road.items.filter(({ kind }) => kind === "tip").length;
    expect(tipsInView(due)).toBe(pending.length);
    expect(tipsInView(stinky)).toBe(
      pending.length * read(tuning, "multipliers", "stinkyTipSpawns"),
    );
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
    expect(after.run.money).toBe(tipValue(data, walk.run).amount);
    expect(tips).toEqual([tipValue(data, walk.run)]);
    expect(after.road.items).toEqual([]);
  });

  it("carries a treat, up to the carry limit", () => {
    const walk = walkWith(["koda"], [atPack("treat")]);
    expect(step(walk).walk.run.treats).toBe(1);
    const full = { ...walk, run: { ...walk.run, treats: 3 } };
    expect(step(full).walk.run.treats).toBe(3);
  });

  it("carries every treat of a planned zone that the pack walks into", () => {
    // The pack stands in the lane of the lowest treat in view, ignoring obstacles.
    let walk = planZone(data, geometry, seededRandom(4), walkWith(["koda"]));
    let carried = 0;
    for (let i = 0; i < 2000; i++) {
      const treat = walk.road.items
        .filter((item) => item.kind === "treat")
        .sort((a, b) => b.y - a.y)[0];
      const moved = inLane(treat?.lane ?? 2, walk);
      walk = { ...moved, road: { ...moved.road, invulnerableSeconds: 99 } };
      const after = step(walk, FRAME).walk;
      carried += after.run.treats - walk.run.treats;
      walk = { ...after, run: { ...after.run, treats: 0 } };
    }
    expect(carried).toBe(2);
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

  it("drops tips once for a minor bump, locks steering and starts the grace window", () => {
    const walk = walkWith(["koda", "duchess"], [atPack("cone"), atPack("otherDog", 1)]);
    const drop = read(tuning, "money", "minorBump");
    const rich = { ...walk, run: { ...walk.run, money: cents(drop + 300) } };
    const { bumps, cards, walk: after } = step(rich);
    expect(bumps.map(({ change }) => change?.amount)).toEqual([-drop]);
    expect(bumps[0]?.change?.causes).toEqual([{ amount: -drop, kind: "bump" }]);
    expect(after.run.money).toBe(300);
    expect(cards).toEqual([]);
    expect(isSteeringLocked(after.road.control)).toBe(true);
    expect(after.road.invulnerableSeconds).toBe(1);
    expect(after.road.items.map(({ kind }) => kind)).toEqual(["otherDog"]);
  });

  it("counts a minor bump and an obstacle hit as bumps in the zone, but not a lucky find", () => {
    const walk = walkWith(["koda"], [atPack("cone")]);
    const zoned = { ...walk, run: { ...walk.run, zoneIndex: 1 } };
    expect(step(zoned).walk.run.bumpsByZone).toEqual([0, 1]);
    expect(step(walkWith(["koda"], [atPack("otherDog")])).walk.run.bumpsByZone).toEqual([1]);
    expect(step(walkWith(["koda"], [atPack("lostWallet")])).walk.run.bumpsByZone).toEqual([]);
  });

  it.each<[string, Walk, AreaContact]>([
    [
      "a skunk catches every dog",
      walkWith(["koda", "duchess"], [atPack("skunk")]),
      { caught: ["koda", "duchess"], encounter: "skunk", hopped: [] },
    ],
    [
      "a puddle catches the big and medium dogs while the small one hops",
      walkWith(["koda", "duchess", "pierre"], [atPack("puddle")]),
      { caught: ["koda", "pierre"], encounter: "puddle", hopped: ["duchess"] },
    ],
  ])("%s, and opens its card for the dogs it caught", (_, walk, contact) => {
    const after = step(walk);
    expect(after.areaContacts).toEqual([contact]);
    expect(after.encounterHits).toEqual([
      { affected: contact.caught, encounter: contact.encounter, kind: "encounter" },
    ]);
  });

  describe("a hit that opens no card", () => {
    const raincoats = (walk: Walk): Walk => ({
      ...walk,
      run: { ...walk.run, immunities: [{ encounter: "puddle" }] },
    });
    // Each with the area contacts it reports.
    const scenery: [string, Walk, AreaContact[]][] = [
      ["a squirrel with no chaser", walkWith(["duchess"], [atPack("squirrel")]), []],
      ["a thief that flees a big dog", walkWith(["koda"], [atPack("thief")]), []],
      [
        "a puddle every dog hops",
        walkWith(["duchess"], [atPack("puddle")]),
        [{ caught: [], encounter: "puddle", hopped: ["duchess"] }],
      ],
      [
        "a picnic with no food-driven dog",
        walkWith(["duchess", "koda"], [atPack("picnic", 0, 2, 2)]),
        [],
      ],
      ["a puddle Raincoats keep off", raincoats(walkWith(["koda"], [atPack("puddle")])), []],
    ];

    it.each(scenery)(
      "is scenery for %s: removed, with no bump, grace or hit stop",
      (_, walk, contacts) => {
        const after = step(walk);
        expect(after.cards).toEqual([]);
        expect(after.encounterHits).toEqual([]);
        expect(after.areaContacts).toEqual(contacts);
        expect(after.walk.road.items).toEqual([]);
        expect(after.walk.road.hitStop).toBeNull();
        expect(after.walk.road.invulnerableSeconds).toBe(0);
        expect(after.walk.run.bumpsByZone).toEqual([]);
      },
    );

    it("opens no grace window, so an obstacle met with it is still hit", () => {
      const after = step(
        walkWith(["koda"], [atPack("thief", 0), { ...atPack("otherDog", 1), y: 550 }]),
      );
      expect(after.encounterHits.map(({ encounter }) => encounter)).toEqual(["otherDog"]);
      expect(after.walk.run.bumpsByZone).toEqual([1]);
    });

    it("leaves a zone clean for Clean Paws, and a walk for Not a Scratch", () => {
      let walk = walkWith(["duchess"]);
      for (let zone = 0; zone < data.world.walkLength; zone++) {
        const met = step({ ...walk, road: { ...walk.road, items: [atPack("squirrel")] } }).walk;
        walk = { ...met, run: finishZone(data, met.run).run };
      }
      const facts = {
        ...runCountersOf(walk.run),
        earnedCents: walk.run.money,
        packSize: 1,
        zonesFinished: data.world.walkLength,
      };
      expect(
        earnedByRun({ ...data, achievements: ACHIEVEMENTS, dogSlots: DOG_SLOTS }, facts),
      ).toEqual(expect.arrayContaining(["cleanPaws", "notAScratch"]));
    });
  });

  it("in the grace window ignores obstacles and counts no bump, but collects pickups and opens lucky finds", () => {
    const items = [
      atPack("otherDog", 0),
      atPack("cone", 1),
      atPack("tip", 2),
      atPack("lostWallet", 3),
    ];
    const { bumps, cards, collected, encounterHits, walk } = step(
      graced(walkWith(["koda"], items)),
    );
    expect(encounterHits).toEqual([]);
    expect(bumps).toEqual([]);
    expect(walk.run.bumpsByZone).toEqual([]);
    expect(collected.map(({ kind }) => kind)).toEqual(["tip"]);
    expect(cards).toEqual([{ affected: ["koda"], encounter: "lostWallet", kind: "encounter" }]);
    expect(walk.road.items.map(({ kind }) => kind)).toEqual(["otherDog", "cone"]);
  });

  it("drops no more tips than the pack has", () => {
    const walk = walkWith(["koda"], [atPack("bin")]);
    const { bumps, walk: after } = step({ ...walk, run: { ...walk.run, money: cents(50) } });
    expect(bumps[0]?.change?.amount).toBe(-50);
    expect(after.run.money).toBe(0);
  });

  it("applies an instant lucky find at once, with no card", () => {
    const walk = walkWith(["koda", "snowball"], [atPack("photoOp")]);
    const { cards, instants, walk: after } = step(walk);
    expect(cards).toEqual([]);
    expect(instants.map(({ encounter }) => encounter)).toEqual(["photoOp"]);
    expect(instants[0]?.outcome.quips).toEqual([{ dog: "snowball", moment: "happier" }]);
    expect(after.run.money).toBe(walk.run.money + TEST_TUNING.money.photoOpTip * 100);
    expect(after.run.phase).toEqual({ kind: "walking" });
  });

  it("opens the forced stop's card when it reaches the pack, in any lane", () => {
    const walk = walkWith(["koda"]);
    const stopped: Walk = {
      ...walk,
      road: { ...walk.road, forcedStopOnRoad: { stop: "stopSign", y: 540 } },
    };
    const { cards, walk: after } = step(stopped);
    expect(cards).toEqual([{ kind: "forcedStop", stop: "stopSign" }]);
    expect(after.road.forcedStopOnRoad).toBeNull();
  });

  it("ends the zone at its length and goes no further", () => {
    const walk = walkWith(["koda"]);
    const length = zoneLength(data, walk.run);
    const nearEnd = { ...walk, run: { ...walk.run, zoneDistance: pixels(length - 1) } };
    const { walk: after, zoneEnded } = step(nearEnd, 1);
    expect(zoneEnded).toBe(true);
    expect(after.run.zoneDistance).toBe(length);
  });

  it.each([
    [1, 30],
    [2, 15],
  ])(
    "takes the zone's length over its speed at speed x%i: %i s of 1/60 s steps",
    (speedFactor, seconds) => {
      const walk = walkWith(["koda"]);
      let current: Walk = { ...walk, road: { ...walk.road, speedFactor } };
      let steps = 0;
      for (let ended = false; !ended; steps++) {
        const next = step(current, 1 / 60);
        current = next.walk;
        ended = next.zoneEnded;
      }
      expect(Math.abs(steps - seconds * 60)).toBeLessThanOrEqual(1);
    },
  );

  it("stands still while a card is open", () => {
    const walk = walkWith(["koda"], [atPack("tip")]);
    const carded: Walk = {
      ...walk,
      run: {
        ...walk.run,
        phase: { kind: "card", source: { kind: "forcedStop", stop: "stopSign" } },
      },
    };
    expect(step(carded).walk).toBe(carded);
  });
});

describe("hit stop", () => {
  // A walk with a spawn due just ahead, so a moving road would bring it into view.
  const withSpawnAhead = (walk: Walk): Walk => ({
    ...walk,
    road: { ...walk.road, pending: [{ distance: 3, kind: "tip", lane: 0 }] },
  });

  it.each<{
    bumpsByZone: number[];
    dogs: PackDogs;
    frames: number;
    item: WalkItem["kind"];
    name: string;
    opens: boolean;
  }>([
    {
      bumpsByZone: [1],
      dogs: ["koda"],
      frames: 60,
      item: "otherDog",
      name: "an obstacle encounter, then opens its card",
      opens: true,
    },
    {
      bumpsByZone: [],
      dogs: ["duchess", "koda"],
      frames: 60,
      item: "lemonade",
      name: "the lemonade stand's moment, then opens its card, with no bump",
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
  ])("holds the walk $frames frames for $name", ({ bumpsByZone, dogs, frames, item, opens }) => {
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
    expect(step(walkWith(["koda"], [atPack("photoOp")])).walk.road.hitStop).toBeNull();
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

  it("keeps the grace window and the stumble lock for after the stop", () => {
    const hit = step(walkWith(["koda"], [atPack("cone")]), FRAME);
    const { control, invulnerableSeconds } = hit.walk.road;
    const after = step(hit.walk, FRAME).walk.road;
    expect(after.invulnerableSeconds).toBe(invulnerableSeconds);
    expect(after.control).toBe(control);
  });

  it("drops steering during the stop rather than queuing it", () => {
    const hit = step(walkWith(["koda"], [atPack("cone")]), FRAME).walk;
    const unlocked = {
      ...hit,
      road: { ...hit.road, control: { ...hit.road.control, lockSeconds: 0 } },
    };
    const steered = steerWalk(data, 5, 1, unlocked);
    expect(steered).toBe(unlocked);
    let walk = steered;
    while (walk.road.hitStop !== null) {
      walk = step(walk, FRAME).walk;
    }
    expect(walk.road.control.target).toBe(2);
    expect(step(walk, 1).walk.road.control.motion).toEqual(stillInLane(2));
  });

  it("holds a zone end met on the hit's step until the stop ends", () => {
    const walk = walkWith(["koda"], [atPack("otherDog")]);
    const length = zoneLength(data, walk.run);
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
    const start = planZone(data, geometry, seededRandom(5), walkWith(["koda", "duchess"]));
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

  it("replays lane moves, treats, card choices and heading home to the same final state", () => {
    const setup = { dev: true, seed: 8, speed: 1, zone: 1 };
    const start = planZone(data, geometry, seededRandom(8), walkWith(["koda", "duchess"]));
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
      let walk: Walk = { ...start, run: { ...start.run, treats: 4 } };
      let treatsGiven = 0;
      let cardsChosen = 0;
      for (let frame = 0; frame <= homeFrame && walk.run.phase.kind === "walking"; frame++) {
        const timeMs = frame * FRAME * 1000;
        for (const input of inputs.due(frame, timeMs)) {
          if (input.kind === "lane") {
            walk = steerWalk(data, 5, input.direction, walk);
          } else if (input.kind === "treat") {
            const dog = walk.run.pack[input.slot]?.dog;
            const before = walk.run.treats;
            walk =
              dog === undefined ? walk : { ...walk, run: giveTreat(data, dog, walk.run).state };
            treatsGiven += before - walk.run.treats;
          } else {
            walk = { ...walk, run: headHome(walk.run) };
          }
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
          log = recordInput({ choice, kind: "card", timeMs: timeMs + FRAME * 1000 }, log);
          cardsChosen += 1;
        }
      }
      return { cardsChosen, log, treatsGiven, walk };
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
        if (frame % 97 === 0) {
          inputs.push({ kind: "treat", slot: Math.floor(frame / 97) % 2, timeMs });
        }
        if (frame === homeFrame) {
          inputs.push({ kind: "home", timeMs });
        }
        return inputs;
      },
    });
    expect(recorded.treatsGiven).toBeGreaterThan(0);
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
  const paced = {
    ...data,
    tuning: {
      ...tuning,
      multipliers: { ...tuning.multipliers, fastWalkerSpeed: 2, slowWalkerSpeed: 0.5 },
    },
  };

  it.each<[WalkerId, number]>([
    ["ben", 0.5],
    ["trista", 2],
  ])("scales the zone's speed by %s's pace", (walker, factor) => {
    const loadout = { dogs: ["koda"], gear: null, walker } as const;
    expect(walkScrollSpeed(paced, newRun(paced, 1, loadout))).toBe(
      walkScrollSpeed(data, newRun(data, 1, loadout)) * factor,
    );
  });

  it("takes the same time over a zone with every walker, a faster one covering more road", () => {
    const zoneSeconds = (walker: WalkerId) => {
      const run = realRun(REAL, walker);
      return zoneLength(REAL, run) / walkScrollSpeed(REAL, run);
    };
    const walkers = Object.keys(WALKERS) as WalkerId[];
    for (const walker of walkers) {
      expect(zoneSeconds(walker), walker).toBeCloseTo(zoneSeconds(DEFAULT_WALKER), 9);
    }
    const lengths = new Set(walkers.map((walker) => zoneLength(REAL, realRun(REAL, walker))));
    expect(lengths.size).toBeGreaterThan(1);
  });
});

describe("finishZone", () => {
  it("pays every walking dog's fee and moves on to the next zone", () => {
    const { run } = walkWith(["koda", "duchess"]);
    const { fees, run: next } = finishZone(data, { ...run, zoneDistance: zoneLength(data, run) });
    expect(next.money).toBe(2000);
    expect(fees.map(({ amount, dog }) => ({ amount, dog }))).toEqual([
      { amount: 1000, dog: "koda" },
      { amount: 1000, dog: "duchess" },
    ]);
    expect(next.zoneIndex).toBe(1);
    expect(next.zoneDistance).toBe(0);
    expect(next.phase).toEqual({ kind: "walking" });
  });

  it("ends the zone's effects after paying its fees, keeping run-long ones", () => {
    const { run } = walkWith(["koda"]);
    const withEffects = {
      ...run,
      debuffs: [{ debuff: "stinky" as const, untilZone: 0 }],
      immunities: [{ encounter: "puddle" as const }, { encounter: "thief" as const, untilZone: 0 }],
    };
    const { run: next } = finishZone(data, withEffects);
    expect(next.debuffs).toEqual([]);
    expect(next.immunities).toEqual([{ encounter: "puddle" }]);
  });

  it("counts the zone for each debuff on as it ends", () => {
    const { run } = walkWith(["koda"]);
    const stinky = {
      ...run,
      debuffZones: { stinky: 1 },
      debuffs: [{ debuff: "stinky" as const, untilZone: 0 }],
    };
    expect(finishZone(data, stinky).run.debuffZones).toEqual({ stinky: 2 });
    expect(finishZone(data, run).run.debuffZones).toEqual({});
  });

  it("ends the run, finished, after the last zone", () => {
    const { run } = walkWith(["koda"]);
    const last = finishZone(data, { ...run, zoneIndex: WORLD.walkLength - 1 }).run;
    expect(last.phase).toEqual({ kind: "ended", reason: "finished" });
  });
});

describe("thinTips", () => {
  const tips = (count: number) =>
    Array.from({ length: count }, (_, lane) => ({ distance: 0, kind: "tip", lane }));

  it.each<[string, number, number]>([
    ["every tip at a whole share", 1, 4],
    ["every second tip at half", 0.5, 2],
    ["every tenth tip at a tenth, rounding error and all", 0.1, 1],
    ["no tip at none", 0, 0],
  ])("keeps %s", (_, share, kept) => {
    expect(thinTips(share, 0, tips(share === 0.1 ? 10 : 4)).events).toHaveLength(kept);
  });

  it("carries a part-owed tip to the next step, and always keeps other spawns", () => {
    const first = thinTips(0.5, 0, [
      { distance: 0, kind: "tip", lane: 0 },
      { distance: 0, kind: "cone", lane: 1 },
    ]);
    expect(first.events.map(({ kind }) => kind)).toEqual(["cone"]);
    expect(thinTips(0.5, first.credit, tips(1)).events).toHaveLength(1);
  });
});

describe("obstacleWeights", () => {
  const weightOf = (dogs: PackDogs, id: EncounterId) =>
    obstacleWeights(data, walkWith(dogs).run).find(([encounter]) => encounter === id)?.[1];

  it("weighs every obstacle encounter, and no lucky one", () => {
    const ids = obstacleWeights(data, walkWith(["biscuit"]).run).map(([id]) => id as string);
    const obstacles = Object.entries(ENCOUNTERS)
      .filter(([, encounter]) => encounter.kind === "obstacle")
      .map(([id]) => id);
    expect(ids.sort()).toEqual(obstacles.sort());
  });

  it("draws other dogs more often for each small dog and less for each big dog", () => {
    expect(weightOf(["biscuit"], "otherDog")).toBe(1);
    expect(weightOf(["duchess", "nugget"], "otherDog")).toBeCloseTo(1.5);
    expect(weightOf(["koda"], "otherDog")).toBeCloseTo(0.75);
    expect(weightOf(["koda"], "skunk")).toBe(1);
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
  // The rulebook's obstacles that never move: Splash, Stink, benches, bins, cones and hedges.
  const NEVER_MOVE: readonly WalkItem["kind"][] = [
    "bench",
    "bin",
    "cone",
    "hedge",
    "puddle",
    "skunk",
  ];
  const movementOf = (kind: WalkItem["kind"]) => {
    const entry = Object.hasOwn(MINOR_OBSTACLES, kind)
      ? REAL.minorObstacles[kind as MinorObstacleId]
      : REAL.encounters[kind as ObstacleEncounterId];
    const movement = ("movement" in entry ? entry.movement : undefined) as Movement | undefined;
    return movement === undefined || movement.kind === "still" ? null : movement;
  };

  it.each(NEVER_MOVE)("never moves the %s", (kind) => {
    expect(movementOf(kind)).toBeNull();
  });

  it.each(OBSTACLE_KINDS)("moves the %s at the share only when it has a movement", (kind) => {
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
  });

  it.each(["tip", "treat", "photoOp", "fireHydrant"] as const)(
    "never moves a %s, drawing nothing",
    (kind) => {
      const never = () => {
        throw new Error("drew");
      };
      expect(moverMovement(REAL, never, 1, kind)).toBeNull();
    },
  );

  // Movement values the planner can build: a dart is one cell, its tilt keeps it coming down
  // the road, and an in-lane mover moves at another speed than the road.
  it.each(OBSTACLE_KINDS)("gives the %s a movement the planner can build", (kind) => {
    const movement = movementOf(kind);
    if (movement?.kind === "dart") {
      expect(footprintOf(REAL, kind)).toEqual({ lanes: 1, rows: 1 });
      expect(Math.abs(movement.tilt ?? 0)).toBeLessThan(1);
    } else if (movement?.kind === "inLane") {
      expect(movement.factor).toBeGreaterThan(0);
      expect(movement.factor).not.toBe(1);
    }
  });

  // Every zone at the fastest pace in the last zone, at the zones' shares and with every
  // obstacle that can move moving: a way past every lane-blocking spawn from every lane, at
  // most the caps of movers on screen, the pack-fit gap wherever the path changes lanes between
  // two obstacles, and each mover moving as its kind does.
  const worlds = [
    { name: "the zones' shares", world: WORLD },
    { name: "a share of 1", world: sharedWorld(WORLD, 1) },
  ];
  it.each(worlds.flatMap(({ name, world }) => ZONE_IDS.map((zone) => ({ name, world, zone }))))(
    "keeps every move passable in $zone at $name",
    ({ world, zone }) => {
      const tuned = { ...REAL, world };
      const zoned = inZone(realRun(tuned, FASTEST_WALKER), zone, WORLD.walkLength - 1);
      const steps = Math.ceil(read(TUNING, "seconds", "laneMove") / STEP_SECONDS - 1e-9);
      const fit = GAME_ROAD.tallestPackBand + steps * STEP_SECONDS * walkScrollSpeed(tuned, zoned);
      for (const seed of [1, 2, 3]) {
        const walk = planZone(tuned, GAME_ROAD, seededRandom(seed), {
          road: startRoad(LANE_COUNT),
          run: zoned,
        });
        const blocking = walk.road.pending.filter((event) => blocksLane(tuned, event.kind));
        const spans = blockingSpans(tuned, blocking);
        for (const start of LANES) {
          const reached = lanesReachedAtEnd(walkwayOf(tuned, zoned), spans, start);
          expect(reached, `seed ${seed}, from lane ${start}`).not.toEqual([]);
        }
        const movers = blocking.flatMap(({ distance, kind, mover }) =>
          mover === undefined ? [] : [{ distance, kind, mover }],
        );
        for (const { kind, mover } of movers) {
          expect(mover.movement).toBe(movementOf(kind)?.kind);
        }
        expectCapsOnScreen(movers);
        // Each obstacle's contact with the pack: its hit box's extent and its lanes.
        const contacts = blocking.map((event) => {
          if (event.mover === undefined) {
            const { lanes } = footprintOf(tuned, event.kind);
            return {
              end: event.distance + itemHeight(tuned, GAME_ROAD, event.kind),
              lanes: new Set(Array.from({ length: lanes }, (_, i) => event.lane + i)),
              start: event.distance,
            };
          }
          const touched = moverSpans(tuned, { ...event, mover: event.mover });
          const from = Math.min(...touched.map(({ distance }) => distance));
          const to = Math.max(...touched.map(({ distance }) => distance + 1));
          return {
            end: to - GAME_ROAD.tallestPackBand,
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
              expect(gap, `seed ${seed}`).toBeGreaterThanOrEqual(fit - 1);
            }
          }
        }
      }
    },
  );

  it("plans the same movers for the same seed", () => {
    const tuned = { ...REAL, world: sharedWorld(WORLD, 1) };
    const zoned = inZone(realRun(tuned, FASTEST_WALKER), "homeStretch", WORLD.walkLength - 1);
    const plan = () =>
      planZone(tuned, GAME_ROAD, seededRandom(4), { road: startRoad(LANE_COUNT), run: zoned }).road
        .pending;
    expect(plan()).toEqual(plan());
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
    expect(item?.mover?.since).toBeCloseTo(3.5);
    expect(item?.y).toBeCloseTo(40 - 32 + 450 + 3.5);
  });

  it("cannot be hit while it is only a cue", () => {
    const cue = { ...crossing, enterTravel: 600 };
    const after = step(inLane(0, walkWith(["koda"], [moverAt("squirrel", cue, 40)])));
    expect(after.cards).toEqual([]);
    expect(after.walk.road.items).toHaveLength(1);
  });

  it.each<{ dogs: PackDogs; encounter: EncounterId; item: WalkItem; name: string }>([
    {
      dogs: ["koda"],
      encounter: "squirrel",
      item: atPack("squirrel"),
      name: "a squirrel standing in the lane, for a chaser",
    },
    {
      dogs: ["koda"],
      encounter: "squirrel",
      item: moverAt("squirrel", crossing, 82),
      name: "a darting squirrel, for a chaser",
    },
    {
      dogs: ["duchess"],
      encounter: "otherDog",
      item: moverAt("otherDog", crossing, 82),
      name: "a loose dog",
    },
    {
      dogs: ["koda"],
      encounter: "goose",
      item: moverAt("goose", crossing, 82),
      name: "a goose, big dog or not",
    },
  ])("opens the $encounter card on contact with $name", ({ dogs, encounter, item }) => {
    const { walk } = step(walkWith(dogs, [item]));
    expect(walk.road.hitStop?.cards).toEqual([{ affected: dogs, encounter, kind: "encounter" }]);
  });

  it("bumps the pack like a minor obstacle on contact with a ball or an in-lane cyclist", () => {
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
