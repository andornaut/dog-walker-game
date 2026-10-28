import { describe, expect, it, vi } from "vitest";

import { LANE_COUNT } from "../data/screen";
import { TUNING } from "../data/tuning";
import type { ZoneId } from "../data/types";
import { WORLD } from "../data/world";
import { keysOf } from "../lib/records";
import { read } from "../rules/units";
import { lanesReachedAtEnd, pathShortfalls } from "../testing/avoidable";
import { type HopMovement, hoppingInstead, plannerStreams, sharedWorld } from "../testing/movers";
import {
  blockingSpans,
  FASTEST_WALKER,
  GAME_ROAD,
  inZone,
  MOVER_SCROLL,
  moverContact,
  moverSpans,
  muddyLaneMove,
  packHitLength,
  REAL,
  type Real,
  realRun,
  ROAD_LENGTH,
  standingSpan,
  TALL_PACK_ROAD,
  TALLER,
  walkwayOf,
  widerRows,
  ZONE_IDS,
} from "../testing/planner";
import { mapZones } from "../testing/world";
import { STEP_SECONDS } from "./fixedStep";
import { onScreenOf, sweptLanes } from "./moverPlanning";
import { crossSpan, hasLeftRoad, type MoverPath, moverPlace } from "./movers";
import { moverOutcomes } from "./outcomes";
import { itemHeight, type RoadGeometry, startRoad, type Walk, walkScrollSpeed } from "./walk";
import { blocksLane, footprintOf, movementOf } from "./walkItems";
import { planZone } from "./zonePlan";

// While set, the lane-balance bias is off: the planner's only weighted draws are its lane balance
// (laneBalanceWeight), so even weights draw every place that fits alike.
const unbiased = vi.hoisted(() => ({ on: false }));
vi.mock("../lib/random", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/random")>();
  const weightedPick: typeof actual.weightedPick = (random, items, weights) =>
    actual.weightedPick(random, items, unbiased.on ? weights.map(() => 1) : weights);
  return { ...actual, weightedPick };
});

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

// Every zone at the fastest pace, with every obstacle that can move moving: a way past every
// lane-blocking spawn from every lane, at most the caps of movers on screen, the pack-fit gap
// wherever the path changes lanes between two obstacles, and each mover moving as its kind does.
describe("the planned road", { timeout: 120_000 }, () => {
  const everyMover: Real = { ...REAL, world: sharedWorld(WORLD, 1) };
  // Every stepper and hopper hopping 1 or 2 times, each hop up to 2 spots any way.
  const HOP: HopMovement = { kind: "hop", most: 2, times: { max: 2, min: 1 } };
  const hopping = hoppingInstead(everyMover, HOP);
  // The game's pack, and a taller one on rows spaced wider by as much.
  const packs = [
    { pack: "the game's pack", road: GAME_ROAD, taller: 0 },
    { pack: "a taller pack", road: TALL_PACK_ROAD, taller: TALLER },
  ];
  // The zones' shares with both packs, a share of 1 only where some zone's share is under 1, since
  // it plans the same zones otherwise, and every hopper hopping.
  const everyZoneMoves = WORLD.zones.every(({ moverShare }) => moverShare === 1);
  const worlds = [
    { packs, tuned: REAL },
    ...(everyZoneMoves ? [] : [{ packs: packs.slice(0, 1), tuned: everyMover }]),
    { packs: packs.slice(0, 1), tuned: hopping },
  ];
  // The data with the minor obstacles' counts changed as given.
  const withMinorCounts = (counts: Partial<Real["tuning"]["counts"]>, tuned: Real): Real => ({
    ...tuned,
    tuning: { ...tuned.tuning, counts: { ...tuned.tuning.counts, ...counts } },
  });
  // Every zone as the walk's last, and the walk's first zone as its first, whose rows reach back
  // onto the road in view as it starts.
  const zonePlaces = [
    ...ZONE_IDS.map((zone) => ({ zone, zoneIndex: WORLD.walkLength - 1 })),
    { zone: WORLD.firstZone as ZoneId, zoneIndex: 0 },
  ];
  type PassableCase = {
    road: RoadGeometry;
    seed?: number;
    tuned: Real;
    zone: ZoneId;
    zoneIndex: number;
  };
  // Every world, pack and zone place.
  const PASSABLE: readonly PassableCase[] = worlds.flatMap(({ packs: sized, tuned }) =>
    sized.flatMap(({ road, taller }) =>
      zonePlaces.map(({ zone, zoneIndex }) => ({
        road,
        tuned: widerRows(tuned, taller),
        zone,
        zoneIndex,
      })),
    ),
  );
  // Each case's plan on its seed, 1 unless given, planned once for every check made of it.
  const plans = new Map<PassableCase, Walk>();
  const planOf = (passable: PassableCase): Walk => {
    let walk = plans.get(passable);
    if (walk === undefined) {
      const { road, seed = 1, tuned, zone, zoneIndex } = passable;
      walk = planZone(tuned, road, plannerStreams(seed), {
        road: startRoad(LANE_COUNT),
        run: inZone(realRun(tuned, FASTEST_WALKER), zone, zoneIndex),
      });
      plans.set(passable, walk);
    }
    return walk;
  };

  it("keeps every move passable in every zone, at the shares, with a taller pack and hopping", () => {
    expectPassable(PASSABLE);
  });
  // Other minor obstacle counts on the game's pack: denser, the last zone's count rising by the
  // gain for each zone walked before it, and counts at which seed 1 plans a dart that leaves the
  // road while it meets the pack, with another obstacle beside it or soon after it in a lane next
  // to its own: the pack-fit gap holds for the lanes and stretch its hit box meets the pack in.
  it.each([
    { minorObstaclesGainPerZone: 3 },
    { minorObstaclesFirstZone: 51, minorObstaclesGainPerZone: 0 },
    { minorObstaclesFirstZone: 58, minorObstaclesGainPerZone: 1 },
  ])("keeps every move passable at minor obstacle counts %o", (counts) => {
    const tuned = withMinorCounts(counts, REAL);
    expectPassable(zonePlaces.map((place) => ({ ...place, road: GAME_ROAD, tuned })));
  });
  // Minor obstacle counts at which seed 1, with the lane-balance bias off and every hopper
  // hopping, plans the last zone with a mover just after a card mover stilled for want of room,
  // or with a dart just before a stepper in the lane beside those it meets the pack in: the
  // pack-fit gap holds whatever the bias draws.
  it.each([
    { minorObstaclesFirstZone: 70, minorObstaclesGainPerZone: 0 },
    { minorObstaclesFirstZone: 90, minorObstaclesGainPerZone: 1 },
  ])("keeps every move passable with the lane-balance bias off: %o", (counts) => {
    unbiased.on = true;
    try {
      expectPassable([
        {
          road: GAME_ROAD,
          tuned: withMinorCounts(counts, hopping),
          zone: WORLD.lastZone,
          zoneIndex: WORLD.walkLength - 1,
        },
      ]);
    } finally {
      unbiased.on = false;
    }
  });
  // Each dart more than a lane wide, in each zone it comes in, weighed there as heavily as the
  // zone's other minor obstacles together, so every plan has several, planned on many seeds with
  // the zone first in the walk and last: each one crosses as wide as its footprint, some turn
  // back and some cross, and the road stays passable around them (expectPassable). The lanes the
  // planner blocks for one in the pack's window (sweptLanes), which openLanesPerRowMin and
  // openStretches weigh, hold every lane its hit box meets the pack in, and leave
  // openLanesPerRowMin open.
  const WIDE_DARTS = keysOf(REAL.minorObstacles).flatMap((kind) =>
    movementOf(REAL, kind)?.kind === "dart" && footprintOf(REAL, kind).lanes > 1
      ? WORLD.zones
          .filter(({ weights }) => weights.minorObstacles[kind] > 0)
          .map(({ id }) => ({ kind, zone: id }))
      : [],
  );
  const WIDE_DART_SEEDS = Array.from({ length: 10 }, (_, i) => i + 1);
  const WIDE_DART_CASES = WIDE_DARTS.flatMap(({ kind, zone }) => {
    const tuned: Real = {
      ...REAL,
      world: mapZones((each) => {
        if (each.id !== zone) {
          return each;
        }
        const weights = each.weights.minorObstacles;
        const others = keysOf(weights)
          .filter((other) => other !== kind)
          .reduce((sum, other) => sum + weights[other], 0);
        return {
          ...each,
          weights: { ...each.weights, minorObstacles: { ...weights, [kind]: others } },
        };
      }, WORLD),
    };
    return [0, WORLD.walkLength - 1].flatMap((zoneIndex) =>
      WIDE_DART_SEEDS.map((seed) => ({
        kind,
        passable: { road: GAME_ROAD, seed, tuned, zone, zoneIndex },
        seed,
        zone,
        zoneIndex,
      })),
    );
  });
  it.each(WIDE_DART_CASES)(
    "places $kind in $zone (zone $zoneIndex, seed $seed) by every placement rule",
    ({ kind, passable, zone }) => {
      const { tuned } = passable;
      expectPassable([passable]);
      const blocking = planOf(passable).road.pending.filter((event) =>
        blocksLane(tuned, event.kind),
      );
      const wide = blocking.flatMap(({ distance, kind: other, mover }) =>
        other === kind && mover?.motion === "cross" ? [{ distance, kind, mover }] : [],
      );
      expect(wide.length).toBeGreaterThan(0);
      const minOpen = read(tuned.tuning, "counts", "openLanesPerRowMin");
      for (const dart of wide) {
        expect(crossSpan(dart.mover)).toBe(footprintOf(tuned, kind).lanes);
        const touched = new Set(
          moverSpans("planned", tuned, GAME_ROAD, zone, dart).map(({ lane }) => lane),
        );
        const sight = GAME_ROAD.sightLength;
        const window = standingSpan(tuned, GAME_ROAD, zone, { ...dart, lane: 0 }).length;
        const { count, first } = sweptLanes(LANE_COUNT, dart.mover, sight, sight + window);
        const swept = Array.from({ length: count }, (_, i) => first + i);
        expect(swept).toEqual(expect.arrayContaining([...touched]));
        expect(swept.length).toBeLessThanOrEqual(LANE_COUNT - minOpen);
      }
    },
  );
  it.each(WIDE_DARTS)("plans $kind in $zone both crossing and turning back", ({ kind, zone }) => {
    const outcomes = WIDE_DART_CASES.filter((wide) => wide.kind === kind && wide.zone === zone)
      .flatMap(({ passable }) => planOf(passable).road.pending)
      .flatMap(({ kind: other, mover }) =>
        other === kind && mover?.motion === "cross" ? [mover.turnAfter === null] : [],
      );
    expect([...new Set(outcomes)].sort()).toEqual([false, true]);
  });
  // A pack following the zone's path passes every obstacle with full margins (pathShortfalls),
  // measured as drawn: each obstacle at its kind's drawn hit length, the pack at the tallest pack's
  // hit boxes, the lane moves in whole walk steps and the reaction margin, less a pixel for a
  // mover's contact sampled a pixel of scroll at a time. The pack also has a way through the zone
  // from the path's first lane.
  function expectPassable(cases: readonly PassableCase[]): void {
    for (const passable of cases) {
      const { road, tuned, zone, zoneIndex } = passable;
      const walk = planOf(passable);
      const zoned = inZone(realRun(tuned, FASTEST_WALKER), zone, zoneIndex);
      const speed = walkScrollSpeed(tuned, zoned);
      const laneMove = Math.ceil(muddyLaneMove / STEP_SECONDS - 1e-9) * STEP_SECONDS * speed;
      const margin = read(tuned.tuning, "seconds", "pathReactionMargin") * speed;
      const fit = (moves: number) => packHitLength(road) + moves * laneMove + margin - 1;
      const blocking = walk.road.pending.filter((event) => blocksLane(tuned, event.kind));
      const spans = blockingSpans(tuned, road, zone, blocking);
      const start = walk.road.path[0]?.lane ?? -1;
      const label = `${zone} ${zoneIndex}`;
      expect(lanesReachedAtEnd(walkwayOf(tuned, road, zoned), spans, start), label).not.toEqual([]);
      const movers = blocking.flatMap(({ distance, kind, mover }) =>
        mover === undefined ? [] : [{ distance, kind, mover }],
      );
      for (const { kind, mover } of movers) {
        expect(mover.movement).toBe(movementOf(tuned, kind)?.kind);
      }
      expectCapsOnScreen(movers);
      // Each obstacle's contact with the pack: its drawn hit box's extent and its lanes.
      const contacts = blocking.map((event) => {
        const named = `${event.kind} at ${event.distance}`;
        if (event.mover === undefined) {
          const { lanes } = footprintOf(tuned, event.kind);
          return {
            end: event.distance + itemHeight(tuned, road, event.kind, false),
            label: named,
            lanes: new Set(Array.from({ length: lanes }, (_, i) => event.lane + i)),
            start: event.distance,
          };
        }
        const moving = { ...event, mover: event.mover };
        const touched = moverSpans("drawn", tuned, road, zone, moving);
        const { end, start: meets } = moverContact("drawn", tuned, road, zone, moving);
        return {
          end: end - packHitLength(road),
          label: named,
          lanes: new Set(touched.map(({ lane }) => lane)),
          start: meets,
        };
      });
      expect(pathShortfalls(packHitLength(road), fit, walk.road.path, contacts), label).toEqual([]);
    }
  }

  // A standing obstacle may stand where a dart passes, crossing over or past it, but never where
  // another mover is while it is there: at no moment with both on the road do their drawn hit
  // boxes overlap in a lane both cover, whichever way a stalker or shy hopper chooses its moves.
  it("keeps every standing obstacle's hit box off every mover's but a dart's", () => {
    for (const passable of PASSABLE) {
      const { road, tuned, zone } = passable;
      const walk = planOf(passable);
      const blocking = walk.road.pending.filter((event) => blocksLane(tuned, event.kind));
      const roadLength = road.roadBottom - road.roadTop;
      const inset = road.cell.inset / road.cell.length;
      const standing = blocking.filter(({ mover }) => mover === undefined);
      for (const { distance, kind, mover } of blocking) {
        if (mover === undefined || mover.motion === "cross") {
          continue;
        }
        const height = itemHeight(tuned, road, kind, true);
        const across = footprintOf(tuned, kind).lanes;
        // By lane, the nearest and farthest distances along the zone its near edge reaches on
        // the road.
        const reached = new Map<number, { far: number; near: number }>();
        for (const path of moverOutcomes(mover)) {
          for (let since = 0; since < MOVER_SCROLL; since++) {
            const place = moverPlace(LANE_COUNT, path, since);
            if (!place.solid || place.travel <= 0) {
              continue;
            }
            if (place.travel - height >= roadLength) {
              break;
            }
            const at = distance + since - place.travel;
            const first = Math.floor(place.lanePosition - 1 + inset) + 1;
            const last = Math.ceil(place.lanePosition + across - inset) - 1;
            for (let lane = first; lane <= last; lane++) {
              const { far, near } = reached.get(lane) ?? { far: at, near: at };
              reached.set(lane, { far: Math.max(far, at), near: Math.min(near, at) });
            }
          }
        }
        for (const obstacle of standing) {
          const { lanes } = footprintOf(tuned, obstacle.kind);
          const length = itemHeight(tuned, road, obstacle.kind, false);
          for (let lane = obstacle.lane; lane < obstacle.lane + lanes; lane++) {
            const span = reached.get(lane);
            const overlaps =
              span !== undefined &&
              obstacle.distance < span.far + height &&
              span.near < obstacle.distance + length;
            expect(overlaps, `${zone}: ${obstacle.kind} on ${kind}`).toBe(false);
          }
        }
      }
    }
  });
});
