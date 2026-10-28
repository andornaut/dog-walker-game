import { describe, expect, it } from "vitest";

import { ACHIEVEMENTS } from "../data/achievements";
import { DEBUFFS } from "../data/debuffs";
import { DOGS } from "../data/dogs";
import { DOG_SLOTS } from "../data/dogSlots";
import { ENCOUNTERS } from "../data/encounters";
import { LANE_COUNT } from "../data/screen";
import { SHOP_GEAR } from "../data/shop";
import { TUNING } from "../data/tuning";
import type {
  Effect,
  EncounterId,
  GearId,
  Size,
  TallyId,
  WalkerId,
  World,
  Zone,
  ZoneId,
} from "../data/types";
import { UPGRADES } from "../data/upgrades";
import { WALKER_PERKS, WALKERS } from "../data/walkers";
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
import { itemAt } from "../lib/arrays";
import { seededRandom } from "../lib/random";
import { keysOf } from "../lib/records";
import { cents, clampHearts, pixels } from "../lib/units";
import { earnedByRun, runCountersOf } from "../rules/achievements";
import { cardFor, type CardView, chooseOption, openCard } from "../rules/choices";
import { modifiersOf, modifierValue } from "../rules/modifiers";
import { currentZone } from "../rules/route";
import { tipValue } from "../rules/run";
import { read } from "../rules/units";
import { zoneStats } from "../rules/zones";
import { mapPack, packDogs } from "../state/pack";
import { type ModifierSource, newRun, type PackDogs, type RunState } from "../state/runState";
import { packOf, runFactsFor } from "../testing/achievements";
import { lanesReachedAtEnd, pathShortfalls } from "../testing/avoidable";
import { plannerStreams } from "../testing/movers";
import {
  blockingSpans,
  FASTEST_WALKER,
  GAME_ROAD,
  gcdOf,
  inZone,
  LANE_MOVE_WALKERS,
  MINOR_OBSTACLE_IDS,
  MOVER_SCROLL,
  moverContact,
  type MoverEvent,
  muddyLaneMove,
  OBSTACLE_IDS,
  packHitLength,
  raised,
  REAL,
  type Real,
  realRun,
  reweighed,
  ROAD_LENGTH,
  slowestLaneMove,
  standingSpan,
  walkwayOf,
  ZONE_IDS,
} from "../testing/planner";
import { activeModifier, heartsByDog } from "../testing/runState";
import {
  atPack,
  data,
  geometry,
  graced,
  inLane,
  RAINCOATS,
  step,
  tuning,
  walkWith,
  withHearts,
} from "../testing/walk";
import { TEST_WORLD } from "../testing/world";
import { approachOutcomes } from "./approach";
import { STEP_SECONDS } from "./fixedStep";
import { stillInLane } from "./laneMotion";
import { hasLeftRoad, laneAt, type MoverPath, moverPlace } from "./movers";
import { shyOutcomes } from "./shy";
import { WIDE_LANES, zoneRows } from "./spawning";
import {
  collectTip,
  finishZone,
  headHome,
  itemHeight,
  laneMoveSeconds,
  type RoadGeometry,
  startRoad,
  steerWalk,
  stepWalk,
  type Walk,
  walkScrollSpeed,
  zoneLength,
} from "./walk";
import {
  blocksLane,
  footprintOf,
  isMinorObstacle,
  itemCategory,
  movementOf,
  opensACard,
  type WalkItem,
} from "./walkItems";
import {
  firstContactSeconds,
  minorObstacleWeights,
  obstacleWeights,
  plannedCellInset,
  planZone,
  spawnQuotas,
} from "./zonePlan";

// The scroll since its cue at which a mover's body first shows on the road: at or below the
// road's top, and not yet off its side. A cue, or a dart waiting at the road's edge, blocks
// nothing yet.
function firstInView(mover: MoverPath): number {
  let since = 0;
  for (; since < MOVER_SCROLL; since++) {
    const place = moverPlace(LANE_COUNT, mover, since);
    if (place.solid && place.travel >= 0 && !hasLeftRoad(LANE_COUNT, place)) {
      break;
    }
  }
  return since;
}
// The lengths of the runs of spawn rows that come on screen with no lane-blocking obstacle in
// view in them, the zone's first and last rows included. A row comes on screen at its distance,
// where a standing spawn on it does, and is overlapped by an obstacle whose contact with the
// pack meets the row's window; a mover counts there once it is in view as the row comes on. The
// rows are the zone's own (zoneRows), spacing apart, reaching back onto the road in view where the
// zone starts with spawns there, and ending a spacing before the zone's end. A mover's contact
// gets a pixel either way, so a rounding error at its edges never decides a row.
function quietRuns(
  tuned: Real,
  road: RoadGeometry,
  zoned: RunState,
  zone: ZoneId,
  pending: Walk["road"]["pending"],
): number[] {
  const spacing = gcdOf(pending.flatMap((e) => (e.mover === undefined ? [e.distance] : [])));
  const contact = firstContactSeconds(tuned, zoned);
  const rows = zoneRows(
    {
      ...(contact === undefined ? {} : { firstContactSeconds: contact }),
      scrollSpeed: walkScrollSpeed(tuned, zoned),
      sightLength: road.sightLength,
      zoneLength: zoneLength(tuned),
    },
    spacing,
  );
  const window = road.cell.length - 2 * plannedCellInset(tuned, road) + road.tallestPackBand;
  const shows = pending
    .filter((event) => blocksLane(tuned, event.kind))
    .map((event) => {
      if (event.mover === undefined) {
        const { distance, length } = standingSpan(tuned, road, zone, event);
        return { end: distance + length, from: distance, start: distance };
      }
      const { end, start } = moverContact("planned", tuned, road, zone, {
        ...event,
        mover: event.mover,
      });
      return { end: end + 1, from: event.distance + firstInView(event.mover), start: start - 1 };
    });
  const runs: number[] = [];
  let run = 0;
  for (const row of rows) {
    const filled = shows.some(
      ({ end, from, start }) => from <= row && start < row + window && end > row,
    );
    if (filled && run > 0) {
      runs.push(run);
    }
    run = filled ? 0 : run + 1;
  }
  return run > 0 ? [...runs, run] : runs;
}
const FRAME = 1 / 60;

// The seeds the game's road sweeps sample: more seeds cover more plans and take longer.
const SWEEP_SEEDS = [1, 2];

// The spawn planner takes a few hundred milliseconds a zone of the game's road, so a sweep over it
// takes several seconds, more on a busy machine.
describe("planZone", { timeout: 60_000 }, () => {
  // The game's road planned in zone at walk position on seed, for walker, planned once for every
  // check made of it.
  const realPlans = new Map<string, Walk["road"]>();
  const realPlan = (
    seed: number,
    zone: ZoneId,
    position: number,
    walker?: WalkerId,
  ): Walk["road"] => {
    const key = `${walker ?? ""} ${zone} ${position} ${seed}`;
    let road = realPlans.get(key);
    if (road === undefined) {
      road = planZone(REAL, GAME_ROAD, plannerStreams(seed), {
        road: startRoad(LANE_COUNT),
        run: inZone(realRun(REAL, walker), zone, position),
      }).road;
      realPlans.set(key, road);
    }
    return road;
  };
  const planned = planZone(data, geometry, plannerStreams(3), walkWith(["kilo"]));
  const countOf = (category: string) =>
    planned.road.pending.filter((event) => itemCategory(data, event.kind) === category).length;

  it("plans the zone's counts of each kind of spawn", () => {
    const { counts } = tuning;
    expect(countOf("obstacle")).toBe(counts.obstaclesFirstZone);
    expect(countOf("minor")).toBe(counts.minorObstaclesFirstZone);
    expect(countOf("tip")).toBe(counts.tipsFirstZone);
    expect(countOf("treat")).toBe(counts.treatsPerZone);
    expect(countOf("lucky")).toBe(
      Object.values(counts.luckyFindsPerZone).reduce((sum, count) => sum + count, 0),
    );
  });

  // Rush hour's and Keen eye's treatSpawns factors, at the live tuning's values.
  it("plans Rush hour's and Keen eye's treatSpawns factor of treats", () => {
    for (const [, effects, source] of [
      ["Rush hour", UPGRADES.rushHour.effects, { kind: "upgrade", upgrade: "rushHour" }],
      ["Keen eye", WALKER_PERKS.keenEye.effects, { kind: "walker", walker: "mrB" }],
    ] satisfies readonly [string, readonly Effect[], ModifierSource][]) {
      const live = { ...data, tuning: { ...tuning, multipliers: TUNING.multipliers } };
      const factors = modifiersOf(effects).filter(({ stat }) => stat === "treatSpawns");
      expect(factors).toHaveLength(1);
      const walk = walkWith(["kilo"]);
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
    const walk = walkWith(["kilo"]);
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
    const { run } = walkWith(["kilo"]);
    const zones: [Zone, ...Zone[]] = [
      {
        ...TEST_WORLD.zones[0],
        weights: {
          ...TEST_WORLD.zones[0].weights,
          obstacles: {
            ...(Object.fromEntries(
              Object.keys(TEST_WORLD.zones[0].weights.obstacles).map((id) => [id, 0]),
            ) as Zone["weights"]["obstacles"]),
            puddle: 2,
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
  // Every zone at each walk position, planned with a cap of one quiet row, tighter than the
  // game's so the fill has rows to fill, and without a cap, on one seed: the capped plan has
  // the same movers, no more of any kind than the zone planned, the fixed obstacles counted together
  // as one with no room is swapped for another, and never more rows quiet over the cap, and across
  // the zones it has fewer.
  it("moves the zone's own fixed obstacles into rows that come on screen quiet over the cap", () => {
    const cap = 1;
    const capping = {
      ...REAL,
      tuning: { ...TUNING, counts: { ...TUNING.counts, maxEmptyRows: cap } },
    };
    const uncapped = {
      ...REAL,
      tuning: { ...TUNING, counts: { ...TUNING.counts, maxEmptyRows: Number.POSITIVE_INFINITY } },
    };
    const overCap = (zoned: RunState, zone: ZoneId, pending: Walk["road"]["pending"]) =>
      quietRuns(REAL, GAME_ROAD, zoned, zone, pending).reduce(
        (sum, run) => sum + Math.max(0, run - cap),
        0,
      );
    const movingObstacles = (pending: Walk["road"]["pending"]) =>
      pending.filter((event) => event.mover !== undefined && blocksLane(REAL, event.kind));
    let [cappedOver, uncappedOver] = [0, 0];
    // A kind may have several quotas, such as one per stepper.
    const group = (kind: WalkItem["kind"]) =>
      isMinorObstacle(REAL, kind) && movementOf(REAL, kind) === null ? "fixed" : kind;
    for (const { position, zone } of POSITIONS) {
      const walk = { road: startRoad(LANE_COUNT), run: inZone(realRun(REAL), zone, position) };
      const capped = planZone(capping, GAME_ROAD, plannerStreams(1), walk).road;
      const plain = planZone(uncapped, GAME_ROAD, plannerStreams(1), walk).road.pending;
      const label = `${zone} at ${position}`;
      expect(movingObstacles(capped.pending), label).toEqual(movingObstacles(plain));
      for (const kind of new Set(capped.planned.map((quota) => group(quota.kind)))) {
        const planned = capped.planned
          .filter((quota) => group(quota.kind) === kind)
          .reduce((sum, { count }) => sum + count, 0);
        const placed = capped.pending.filter((event) => group(event.kind) === kind).length;
        expect(placed, `${label}: ${kind}`).toBeLessThanOrEqual(planned);
      }
      const over = overCap(walk.run, zone, capped.pending);
      const plainOver = overCap(walk.run, zone, plain);
      expect(over, label).toBeLessThanOrEqual(plainOver);
      cappedOver += over;
      uncappedOver += plainOver;
    }
    expect(cappedOver).toBeLessThan(uncappedOver);
  });

  // A walker's perk tipSpawns factors scale the zone's tips, rounded as Rush hour's are; a
  // walker without one plans the zone's own count.
  it.each(keysOf(WALKERS))(
    "plans %s's tips in every zone at every walk position, scaled by its perk",
    (walker) => {
      const factor = modifiersOf(WALKER_PERKS[WALKERS[walker].perk].effects)
        .filter(({ operation, stat }) => operation === "multiply" && stat === "tipSpawns")
        .reduce((product, modifier) => product * modifierValue(TUNING, modifier), 1);
      for (const { position, zone } of POSITIONS) {
        const zoned = inZone(realRun(REAL, walker), zone, position);
        const base = zoneStats(TUNING, currentZone(REAL, zoned), position).tips;
        const tips = spawnQuotas(REAL, plannerStreams(1), zoned).find(({ kind }) => kind === "tip");
        expect(tips?.count, `${zone} at ${position}`).toBe(Math.round(base * factor));
      }
    },
  );

  it("skips no card for a plain obstacle in any zone at any walk position", () => {
    for (const { position, zone } of POSITIONS) {
      const zoned = inZone(realRun(REAL), zone, position);
      for (const seed of SWEEP_SEEDS) {
        const asked = spawnQuotas(REAL, plannerStreams(seed), zoned)
          .filter(({ kind }) => opensACard(REAL, kind))
          .reduce((sum, { count }) => sum + count, 0);
        const { pending } = realPlan(seed, zone, position);
        const cards = pending.filter(({ kind }) => opensACard(REAL, kind)).length;
        const plain = pending.filter(
          ({ kind }) => blocksLane(REAL, kind) && !opensACard(REAL, kind),
        );
        expect(plain.length, `seed ${seed}`).toBeGreaterThan(0);
        expect(cards, `seed ${seed}`).toBe(asked);
      }
    }
  });

  // Where a mover stands once it has made its last move, as the walk moves it: a dart that stops
  // short, and a stepper, hopper or stalker whichever way it chooses its moves. Each is the
  // distance a spawn level with it has, and the lanes it covers.
  const SETTLED = 10 * ROAD_LENGTH;
  const restsOf = ({ distance, kind, mover }: MoverEvent) => {
    const ways =
      mover.motion === "approach"
        ? approachOutcomes(mover)
        : mover.motion === "shy"
          ? shyOutcomes(mover)
          : mover.motion === "steps" || (mover.motion === "cross" && mover.stopAfter !== null)
            ? [mover]
            : [];
    return ways.map((way) => {
      const place = moverPlace(LANE_COUNT, way, SETTLED);
      const lane = laneAt(place.lanePosition);
      return {
        distance: distance + SETTLED - place.travel,
        lanes: Array.from({ length: footprintOf(REAL, kind).lanes }, (_, i) => lane + i),
      };
    });
  };
  it.each(POSITIONS)(
    "places every tip and treat planned, no treat where a mover stops, in $zone at walk position $position",
    ({ position, zone }) => {
      const zoned = inZone(realRun(REAL), zone, position);
      for (const seed of SWEEP_SEEDS) {
        const quotas = spawnQuotas(REAL, plannerStreams(seed), zoned);
        const { pending } = realPlan(seed, zone, position);
        const pickups = pending.filter(({ kind }) => kind === "tip" || kind === "treat");
        for (const kind of ["tip", "treat"] as const) {
          expect(
            pickups.filter((pickup) => pickup.kind === kind).length,
            `seed ${seed}: ${kind}s`,
          ).toBe(quotas.find((quota) => quota.kind === kind)?.count);
        }
        const stops = pending.flatMap((event) =>
          event.mover === undefined
            ? []
            : restsOf({ ...event, mover: event.mover }).map((rest) => ({
                ...rest,
                kind: event.kind,
                length: itemHeight(REAL, GAME_ROAD, event.kind, true),
              })),
        );
        // A tip may lie where a mover stops (moversRestOn); a treat may not.
        const kept = pickups.filter(
          (pickup) => quotas.find((quota) => quota.kind === pickup.kind)?.moversRestOn !== true,
        );
        for (const pickup of kept) {
          const length = itemHeight(REAL, GAME_ROAD, pickup.kind, false);
          const under = stops.filter(
            (stop) =>
              stop.lanes.includes(pickup.lane) &&
              pickup.distance > stop.distance - length &&
              pickup.distance < stop.distance + stop.length,
          );
          expect(
            under.map(({ kind }) => kind),
            `seed ${seed}: ${pickup.kind} at ${pickup.distance}`,
          ).toEqual([]);
        }
      }
    },
  );

  // No obstacle meets the pack sooner than firstZoneContact into the walk's first zone, though
  // its rows may reach back onto the road in view; a later zone starts with the road clear of
  // its own.
  it.each([
    { clearRoad: false, zoneIndex: 0 },
    { clearRoad: true, zoneIndex: WORLD.walkLength - 1 },
  ])(
    "starts the zone at walk position $zoneIndex no sooner than firstZoneContact, with a clear road: $clearRoad",
    ({ clearRoad, zoneIndex }) => {
      const zoned = inZone(realRun(REAL), WORLD.firstZone as ZoneId, zoneIndex);
      const soonest = read(TUNING, "seconds", "firstZoneContact") * walkScrollSpeed(REAL, zoned);
      const firsts = SWEEP_SEEDS.map((seed) =>
        Math.min(
          ...realPlan(seed, WORLD.firstZone as ZoneId, zoneIndex)
            .pending.filter((event) => event.mover === undefined && blocksLane(REAL, event.kind))
            .map(({ distance }) => distance),
        ),
      );
      if (clearRoad) {
        expect(firsts.every((first) => first >= 0)).toBe(true);
      }
      for (const first of firsts) {
        expect(first + GAME_ROAD.sightLength).toBeGreaterThanOrEqual(soonest - 1e-6);
      }
    },
  );

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
    for (const walker of keysOf(WALKERS)) {
      for (const zone of ZONE_IDS) {
        const zoned = inZone(realRun(REAL, walker), zone, latestIndex(zone));
        const lookAhead = GAME_ROAD.sightLength / walkScrollSpeed(REAL, zoned);
        expect(lookAhead, `${walker} in ${zone}`).toBeGreaterThan(acrossRoad + 1);
      }
    }
  });

  // Every obstacle's and every minor obstacle's weight raised at once, at the fastest pace in
  // the last zone, where the road is fastest.
  it("plans a way past every row from the path's start with every obstacle or minor obstacle weighed higher", () => {
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
        const walk = planZone(tuned, GAME_ROAD, plannerStreams(1), {
          road: startRoad(LANE_COUNT),
          run: zoned,
        });
        const spans = blockingSpans(tuned, GAME_ROAD, zone, walk.road.pending);
        const start = walk.road.path[0]?.lane ?? -1;
        const reached = lanesReachedAtEnd(walkwayOf(tuned, GAME_ROAD, zoned), spans, start);
        expect(reached, `${zone}, from lane ${start}`).not.toEqual([]);
      }
    }
  });

  // Standing obstacles along the path: at each change of lane, the road between the drawn hit
  // boxes of obstacles met before and after it is at least the tallest pack's hit boxes, the lane
  // moves made between them in whole walk steps and the reaction margin. Two obstacles WIDE_LANES
  // or more lanes wide have a row between them. At the road's speed in the last neighbourhood, for
  // the walkers whose lane moves cover the least and the most road.
  it("spaces obstacles for the path's lane changes between them, at the shortest and longest lane move", () => {
    for (const { walker, zone } of LANE_MOVE_WALKERS.flatMap((walker) =>
      ZONE_IDS.map((zone) => ({ walker, zone })),
    )) {
      const zoned = inZone(realRun(REAL, walker), zone, WORLD.walkLength - 1);
      const speed = walkScrollSpeed(REAL, zoned);
      const steps = Math.ceil(muddyLaneMove / STEP_SECONDS - 1e-9);
      const laneMove = steps * STEP_SECONDS * speed;
      const margin = read(TUNING, "seconds", "pathReactionMargin") * speed;
      const lanesOf = (kind: WalkItem["kind"], lane: number) =>
        new Set(Array.from({ length: footprintOf(REAL, kind).lanes }, (_, i) => lane + i));
      const road = realPlan(1, zone, WORLD.walkLength - 1, walker);
      const standing = road.pending.filter(
        (event) => event.mover === undefined && blocksLane(REAL, event.kind),
      );
      const contacts = standing.map(({ distance, kind, lane }) => ({
        end: distance + itemHeight(REAL, GAME_ROAD, kind, false),
        label: `${walker} in ${zone}: ${kind} at ${distance}`,
        lanes: lanesOf(kind, lane),
        start: distance,
      }));
      const fit = (moves: number) => packHitLength(GAME_ROAD) + moves * laneMove + margin - 1e-6;
      expect(pathShortfalls(packHitLength(GAME_ROAD), fit, road.path, contacts)).toEqual([]);
      const spacing = gcdOf(road.pending.flatMap((e) => (e.mover ? [] : [e.distance])));
      const wide = standing.filter(({ kind }) => footprintOf(REAL, kind).lanes >= WIDE_LANES);
      wide.forEach((near, i) => {
        for (const far of wide.slice(i + 1)) {
          const rowsApart = Math.abs(far.distance - near.distance) / spacing;
          const label = `${walker} in ${zone}: ${near.kind} and ${far.kind}`;
          expect(rowsApart, label).toBeGreaterThanOrEqual(2);
        }
      });
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
      const walk = walkWith(["kilo"]);
      const pending = [0, 1, 3, 4].map((lane) => ({ distance: 0.5, kind: "tip", lane }) as const);
      const due = debuffed({ ...walk, road: { ...walk.road, pending } });
      const tips = step(due, 0.05).walk.road.items.filter(({ kind }) => kind === "tip");
      expect(tips).toHaveLength(pending.length);
    }
  });

  it("pays a tip grabbed its value, clean or Stinky", () => {
    for (const [, debuffed, amount] of [
      ["clean", (walk: Walk) => walk, read(tuning, "money", "tip")],
      ["Stinky", stinkyRun, 0],
    ] as const) {
      const { run } = debuffed(walkWith(["kilo"]));
      const { tip } = collectTip(data, run);
      expect(tip.amount).toBe(amount);
    }
  });

  it("brings a due spawn into view at the top of the road", () => {
    const walk = walkWith(["kilo"]);
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

  it("collects a tip the pack walks into, worth what tips pay now, with its item", () => {
    const walk = walkWith(["kilo"], [atPack("tip")]);
    const { collected, tips, walk: after } = step(walk);
    expect(collected.map(({ kind }) => kind)).toEqual(["tip"]);
    expect(after.run.money).toBe(walk.run.money + tipValue(data, walk.run).amount);
    expect(tips).toEqual([{ change: tipValue(data, walk.run), item: collected[0] }]);
    expect(after.road.items).toEqual([]);
  });

  it("gives a treat the pack walks into to its dog's owner, up to their max", () => {
    const walk = withHearts(1, walkWith(["kilo"], [atPack("treat")]));
    const { collected, treats, walk: after } = step(walk);
    expect(collected.map(({ kind }) => kind)).toEqual(["treat"]);
    expect(treats.map(({ dog }) => dog)).toEqual(["kilo"]);
    expect(heartsByDog(after.run).kilo).toBe(1 + read(tuning, "hearts", "treat"));
    const full = walkWith(["kilo"], [atPack("treat")]);
    expect(step(full).treats.map(({ change }) => change)).toEqual([null]);
  });

  // Long reach grabs a tip or a treat its lanes reach past the pack's own, and no further.
  const longReach = keysOf(WALKERS).find((walker) => WALKERS[walker].perk === "longReach");
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
          run: newRun(reaching, 3, { dogs: ["kilo"], gear: null, walker: longReach ?? "casey" }),
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
      const walk = hearts(walkWith(["kilo", "biscuit"], [atPack("treat")]));
      const before = walk.run.tallies.treats ?? 0;
      expect(step(walk).walk.run.tallies.treats).toBe(before + 1);
    }
  });

  // A tip counts toward the tips tally, and each lucky find toward the tally its data names.
  const tallied: [WalkItem["kind"], TallyId][] = [
    ["tip", "tips"],
    ...keysOf(ENCOUNTERS).flatMap((id): [EncounterId, TallyId][] => {
      const { resolution } = ENCOUNTERS[id];
      return resolution.kind === "instant" ? [[id, resolution.tally]] : [];
    }),
  ];

  it.each(tallied)("counts a %s grabbed or found toward the %s tally", (kind, tally) => {
    expect(step(walkWith(["kilo"], [atPack(kind)])).walk.run.tallies).toEqual({ [tally]: 1 });
  });

  it("gives a treat the front dog grabs at its owner's max to the hurt owner behind", () => {
    const walk = walkWith(["kilo", "biscuit"], [atPack("treat")]);
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
    let walk = planZone(data, geometry, plannerStreams(4), walkWith(["kilo"]));
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
      walkWith(["kilo", "duchess"], [atPack("otherDog")]),
    );
    const card = { affected: ["kilo", "duchess"], encounter: "otherDog", kind: "encounter" };
    expect(encounterHits).toEqual([card]);
    expect(cards).toEqual([]);
    expect(walk.road.hitStop?.cards).toEqual([card]);
    expect(walk.road.items).toEqual([]);
    expect(walk.road.invulnerableSeconds).toBe(1);
  });

  it("hits an obstacle across several lanes from any of them, and misses it from the others", () => {
    const hedge = walkWith(["kilo"], [atPack("hedge", 0, 1, 3)]);
    const bumps = [0, 1, 2, 3, 4].map((lane) => step(inLane(lane, hedge)).bumps.length);
    expect(bumps).toEqual([0, 1, 1, 1, 0]);
  });

  it("costs a plain hit's dog's owner a heart, with no money, and starts the grace window", () => {
    const walk = walkWith(["kilo", "duchess"], [atPack("cone"), atPack("otherDog", 1)]);
    const { bumps, cards, walk: after } = step(walk);
    const bump = read(tuning, "hearts", "bump");
    expect(bumps.map(({ change, dodged, dog }) => [dog, dodged, change?.causes])).toEqual([
      ["kilo", false, [{ amount: -bump, kind: "bump" }]],
    ]);
    expect(after.run.money).toBe(walk.run.money);
    expect(heartsByDog(after.run).kilo).toBe((heartsByDog(walk.run).kilo ?? 0) - bump);
    expect(cards).toEqual([]);
    expect(after.road.invulnerableSeconds).toBe(1);
    expect(after.road.items.map(({ kind }) => kind)).toEqual(["otherDog"]);
  });

  // Muddy only slows lane changes: a bump costs what it always does.
  it("costs a plain bump's hearts while Muddy", () => {
    const walk = walkWith(["kilo"], [atPack("cone")]);
    const muddy = {
      ...walk,
      run: { ...walk.run, debuffs: [{ debuff: "muddy", secondsLeft: 20, untilZone: 0 }] },
    } as const;
    const bump = read(tuning, "hearts", "bump");
    expect(heartsByDog(step(muddy).walk.run).kilo).toBe((heartsByDog(walk.run).kilo ?? 0) - bump);
  });

  // A Muddy pack's lane move lasts 1 / muddyLaneSlow times as long, whatever walks it: the
  // slowing multiplies the pack's own pace, so a small dog's pack and one slowed by a large dog.
  it.each(
    keysOf(WALKERS)
      .slice(0, 1)
      .flatMap((walker) =>
        ([["biscuit"], ["kilo", "penny"]] as const).map((dogs) => ({ dogs, walker })),
      ),
  )("slows $walker's lane moves with $dogs while Muddy", ({ dogs, walker }) => {
    const run = newRun(data, dogs.length, { dogs, gear: null, walker });
    const muddy = {
      ...run,
      debuffs: [{ debuff: "muddy", secondsLeft: 20, untilZone: 0 }] as const,
    };
    const slow = read(tuning, "multipliers", "muddyLaneSlow");
    expect(laneMoveSeconds(data, muddy)).toBeCloseTo(laneMoveSeconds(data, run) / slow, 9);
  });

  // With no grace window, a cone, a card obstacle and a treat all meet the pack on one step.
  it("fires an owner a hit empties before the step's treat, and leaves their dog off its card", () => {
    const ungraced = {
      ...data,
      tuning: { ...tuning, seconds: { ...tuning.seconds, collisionGrace: 0 } },
    };
    const items = [atPack("cone"), { ...atPack("otherDog", 1), y: 556 }, atPack("treat", 2)];
    const walk = withHearts(read(tuning, "hearts", "bump"), walkWith(["kilo", "biscuit"], items));
    const stepped = stepWalk(ungraced, geometry, seededRandom(1), 0.01, walk);
    const card = { affected: ["biscuit"], encounter: "otherDog", kind: "encounter" };
    expect(stepped.fired).toEqual(["kilo"]);
    expect(stepped.treats.map(({ dog }) => dog)).toEqual(["biscuit"]);
    expect(stepped.encounterHits).toEqual([card]);
    expect(stepped.walk.road.hitStop?.cards).toEqual([card]);
  });

  // The game sets the pack's formation: the biggest dog leads, ties in roster order, whatever
  // order the dogs were picked in, and a head-on hit lands on the lead.
  it("lands a plain hit head-on on the biggest dog, ties in roster order", () => {
    for (const [, dogs, dog] of [
      ["on the front dog", ["kilo", "biscuit"], "kilo"],
      ["on the bigger dog, picked second", ["biscuit", "kilo"], "kilo"],
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
      const walk = walkWith(["kilo", "biscuit"], [atPack(kind, 0, 1)]);
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

  // Each size's chance to dodge a plain hit, without and with the Whistle in the Pocket, at
  // the game's chances, which the test tuning pins to 0: a small dog's own chance, plus the
  // whistle's for the sizes it names.
  const { probability } = TUNING;
  const [whistle] = SHOP_GEAR.whistle.effects;
  const whistleSizes: readonly Size[] = whistle.sizes;
  const dodgeCases = (["large", "medium", "small"] as const).flatMap((size) =>
    ([null, "whistle"] as const).map((gear: GearId | null) => ({
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
      const dog = keysOf(DOGS).find((id) => DOGS[id].size === size) ?? "kilo";
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
      expect(under.stepped.walk.run.bumpsByKind).toEqual(dodged ? {} : { cone: 1 });
      expect(under.stepped.walk.road.hitStop === null).toBe(dodged);
      // Every dog's dodge counts toward the dodges tally, the Whistle's included.
      expect(under.stepped.walk.run.tallies.dodges ?? 0).toBe(dodged ? 1 : 0);
      expect(at.stepped.bumps.map((bump) => bump.dodged)).toEqual([false]);
    },
  );

  it("counts only a plain hit as a bump in the zone, not a card obstacle or a lucky find", () => {
    const walk = walkWith(["kilo"], [atPack("cone")]);
    const zoned = { ...walk, run: { ...walk.run, zoneIndex: 1 } };
    expect(step(zoned).walk.run.bumpsByZone).toEqual([0, 1]);
    expect(step(walkWith(["kilo"], [atPack("otherDog")])).walk.run.bumpsByZone).toEqual([]);
    expect(step(walkWith(["kilo"], [atPack("lostWallet")])).walk.run.bumpsByZone).toEqual([]);
  });

  it("opens an encounter's card for the whole pack", () => {
    for (const encounter of ["otherDog", "skunk", "thief"] as const) {
      const walk = walkWith(["kilo", "duchess", "pierre"], [atPack(encounter)]);
      expect(step(walk).encounterHits).toEqual([
        { affected: packDogs(walk.run), encounter, kind: "encounter" },
      ]);
    }
  });

  // Raincoats keep a puddle's Muddy off; the capybara's Help the keeper muddies the pack anyway
  // (chooseOption).
  it.each([
    { muddy: true, raincoats: false },
    { muddy: false, raincoats: true },
  ])("muddies the pack on a puddle: $muddy, with Raincoats: $raincoats", ({ muddy, raincoats }) => {
    const walk = walkWith(["kilo"], [atPack("puddle")]);
    const coated = raincoats
      ? { ...walk, run: { ...walk.run, immunities: [{ encounter: "puddle", source: RAINCOATS }] } }
      : walk;
    const debuffs = step(coated as Walk).walk.run.debuffs.map(({ debuff }) => debuff);
    expect(debuffs).toEqual(muddy ? ["muddy"] : []);
  });

  it("muddies the whole pack on a puddle, with no card or heart and a plain obstacle's stop", () => {
    const dogs: PackDogs = ["kilo", "duchess"];
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
      ["a puddle Raincoats keep off", raincoats(walkWith(["kilo"], [atPack("puddle")]))],
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
        raincoats(walkWith(["kilo"], [atPack("puddle", 0), { ...atPack("otherDog", 2), y: 550 }])),
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
      graced(walkWith(["kilo"], items)),
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
    const walk = walkWith(["kilo", "snowball"], [atPack("lostWallet")]);
    const { cards, instants, walk: after } = step(walk);
    expect(cards).toEqual([]);
    expect(instants.map(({ encounter }) => encounter)).toEqual(["lostWallet"]);
    expect(instants[0]?.outcome.quips).toEqual([]);
    expect(after.run.money).toBe(walk.run.money + read(tuning, "money", "lostWalletKeep"));
    expect(after.run.phase).toEqual({ kind: "walking" });
  });

  // A lucky find touches the pack's outline as a pickup does, so one reaching a pixel into the
  // outline's top is found, though it is above every dog's and the walker's rectangle.
  const LUCKY = keysOf(ENCOUNTERS).filter((kind) => ENCOUNTERS[kind].kind === "lucky");
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
      const after = step(inLane(2, walkWith(["kilo", "snowball"], [item])), 0);
      expect(after.walk.road.items.some(({ id }) => id === item.id)).toBe(!found);
    }
  });

  it("ends the zone at its length and goes no further", () => {
    const walk = walkWith(["kilo"]);
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
      const walk = walkWith(["kilo"]);
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
    const walk = walkWith(["kilo"], [atPack("tip")]);
    const carded: Walk = {
      ...walk,
      run: {
        ...walk.run,
        phase: {
          kind: "card",
          source: { affected: ["kilo"], encounter: "thief", kind: "encounter" },
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
    hearts: { ...live.hearts, secondChanceForgiven: TUNING.hearts.secondChanceForgiven },
  }));
  const calming = withTuning((live) => ({
    ...live,
    multipliers: {
      ...live.multipliers,
      quickRecoveryDebuffFactor: TUNING.multipliers.quickRecoveryDebuffFactor,
    },
  }));
  const reaching = withTuning((live) => ({
    ...live,
    counts: { ...live.counts, longReachLanes: TUNING.counts.longReachLanes },
  }));
  const walkerWith = (perk: keyof typeof WALKER_PERKS): WalkerId => {
    const walker = keysOf(WALKERS).find((id) => WALKERS[id].perk === perk);
    if (walker === undefined) {
      throw new Error(`No walker has ${perk}`);
    }
    return walker;
  };
  // A lone kilo walking with walker, meeting item at the pack.
  const meeting = (walker: WalkerId, item: WalkItem, run: Partial<Walk["run"]> = {}): Walk => ({
    road: { ...startRoad(5), items: [item], nextItemId: 1 },
    run: { ...newRun(data, 3, { dogs: ["kilo"], gear: null, walker }), ...run },
  });
  const by = (amount: number, source: ModifierSource) => [
    { amount, kind: "modifier" as const, source },
  ];
  const kilo = { dog: "kilo", kind: "hearts" } as const;
  const stinky = { debuff: "stinky", kind: "debuff" } as const;
  const bump = read(tuning, "hearts", "bump");
  const tip = read(tuning, "money", "tip");
  const bonus = read(tuning, "money", "bigTipperTipBonus");
  const reach = read(reaching.tuning, "counts", "longReachLanes");
  const muddySeconds = read(tuning, "seconds", DEBUFFS.muddy.seconds);
  const calmedSeconds =
    muddySeconds * read(calming.tuning, "multipliers", "quickRecoveryDebuffFactor");
  const bigTipper = { kind: "upgrade", upgrade: "bigTipper" } as const;
  const debuffed = (debuff: "muddy" | "stinky") => ({
    debuffs: [{ debuff, secondsLeft: 20, untilZone: 0 }],
  });

  it.each([
    [
      "Second chance forgives a bump",
      forgiving,
      meeting(walkerWith("secondChance"), atPack("cone")),
      [
        {
          after: 0,
          before: -bump,
          by: [
            {
              amount: bump,
              forgives: true,
              kind: "modifier",
              source: { kind: "walker", walker: walkerWith("secondChance") },
            },
          ],
          subject: kilo,
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
      "Quick recovery shortens a puddle's Muddy",
      calming,
      meeting(walkerWith("quickRecovery"), atPack("puddle")),
      [
        {
          after: calmedSeconds,
          before: muddySeconds,
          by: by(calmedSeconds - muddySeconds, {
            kind: "walker",
            walker: walkerWith("quickRecovery"),
          }),
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

  // A bump badge counts every plain hit that lands, forgiven or not.
  it.each([
    ["counts a plain bump by its obstacle's kind", data, meeting("casey", atPack("cone")), 1],
    [
      "counts one Second chance forgives",
      forgiving,
      meeting(walkerWith("secondChance"), atPack("cone")),
      1,
    ],
  ] as const)("%s", (_, walkData, walk, landed) => {
    const { run } = stepWalk(walkData, geometry, seededRandom(1), 0.01, walk).walk;
    expect(run.bumpsByKind).toEqual({ cone: landed });
  });

  // While Spotlight lasts, a plain bump costs its cash on top of its hearts: all the cash there is
  // when that is less, and none at $0. Second chance may forgive the heart, never the cash.
  const spotlightCash = read(tuning, "money", DEBUFFS.spotlight.bumpMoney);
  const plenty = cents(spotlightCash * 2);
  const short = cents(spotlightCash - 100);
  const lit = (money: number) => ({
    debuffs: [{ debuff: "spotlight", secondsLeft: 20, untilZone: 0 }] as const,
    money: cents(money),
  });
  const secondChance = walkerWith("secondChance");
  it.each([
    { cash: spotlightCash, forgiven: 0, hearts: bump, money: plenty, name: "its cash and a heart" },
    {
      cash: short,
      forgiven: 0,
      hearts: bump,
      money: short,
      name: "what cash there is and a heart",
    },
    { cash: 0, forgiven: 0, hearts: bump, money: 0, name: "a heart and no cash at $0" },
    {
      cash: spotlightCash,
      forgiven: bump,
      hearts: 0,
      money: plenty,
      name: "its cash, Second chance forgiving the heart",
      walker: secondChance,
    },
    {
      cash: 0,
      forgiven: bump,
      hearts: 0,
      money: 0,
      name: "nothing at $0, Second chance forgiving the heart",
      walker: secondChance,
    },
  ])("costs a Spotlight bump $name", ({ cash, forgiven, hearts, money, walker }) => {
    const walk = meeting(walker ?? "casey", atPack("cone"), lit(money));
    const walkData = walker === undefined ? data : forgiving;
    const after = stepWalk(walkData, geometry, seededRandom(1), 0.01, walk);
    const { run: next } = after.walk;
    expect(next.money).toBe(walk.run.money - cash);
    expect(heartsByDog(next).kilo).toBe((heartsByDog(walk.run).kilo ?? 0) - hearts);
    expect(next.heartsForgiven).toBe(forgiven);
    expect(next.bumpsByKind).toEqual({ cone: 1 });
    expect(after.bumps.map((landed) => (landed.cash === null ? 0 : -landed.cash.amount))).toEqual([
      cash,
    ]);
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
        dogs: ["kilo"],
        frames: 60,
        item: "otherDog",
        name: "an obstacle encounter, then opens its card",
        opens: true,
      },
      {
        bumpsByZone: [1],
        dogs: ["kilo"],
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
    const both = walkWith(["kilo"], [atPack("cone"), atPack("otherDog", 1)]);
    const hit = stepWalk(graceless, geometry, seededRandom(1), FRAME, both);
    expect(hit.encounterHits).toHaveLength(1);
    expect(hit.bumps).toHaveLength(1);
    expect(hit.walk.road.hitStop?.seconds).toBe(1);
  });

  it("never stops for a lucky find without a hit label", () => {
    expect(step(walkWith(["kilo"], [atPack("lostWallet")])).walk.road.hitStop).toBeNull();
    expect(step(walkWith(["kilo"], [atPack("pettingNeighbour")])).walk.road.hitStop).toBeNull();
  });

  it("advances neither distance, the spawn plan, the road nor the pack during the stop", () => {
    const hit = step(withSpawnAhead(walkWith(["kilo"], [atPack("cone"), atPack("tip", 1, 0)])));
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
    const hit = step(walkWith(["kilo"], [atPack("cone")]), FRAME);
    const { control, invulnerableSeconds } = hit.walk.road;
    const after = step(hit.walk, FRAME).walk.road;
    expect(after.invulnerableSeconds).toBe(invulnerableSeconds);
    expect(after.control).toBe(control);
  });

  it("drops steering during the stop rather than queuing it", () => {
    const hit = step(walkWith(["kilo"], [atPack("cone")]), FRAME).walk;
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
    const walk = walkWith(["kilo"], [atPack("otherDog")]);
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
    const start = planZone(data, geometry, plannerStreams(5), walkWith(["kilo", "duchess"]));
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
    const start = planZone(data, geometry, plannerStreams(1), walkWith(["kilo", "duchess"]));
    const homeFrame = 60 * 25;
    // As RunScene steps: the inputs due now, each logged at the run time it is applied, then
    // the walk, then each card it opened, chosen and logged at the run time after the step.
    // Heading home applies before a step, at the run time the pause menu was opened.
    const play = (inputs: {
      choose: (view: CardView) => CardChoice;
      due: (frame: number, timeMs: number) => StepInput[];
    }) => {
      const rolls = seededRandom(9);
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
          walk = { ...walk, run: chooseOption(data, run, view, choice).state };
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
    const speeds = keysOf(WALKERS).map((walker) => walkScrollSpeed(REAL, realRun(REAL, walker)));
    expect(new Set(speeds).size).toBe(1);
  });
});

describe("finishZone", () => {
  const pay = read(tuning, "money", "payPerDog");

  it("banks every walking dog's pay and moves on to the next zone", () => {
    const { run } = walkWith(["kilo", "duchess"]);
    const { fees, run: next } = finishZone(data, { ...run, zoneDistance: zoneLength(data) });
    expect(next.money).toBe(run.money + 2 * pay);
    expect(fees.map(({ amount, dog }) => ({ amount, dog }))).toEqual([
      { amount: pay, dog: "kilo" },
      { amount: pay, dog: "duchess" },
    ]);
    expect(next.zoneIndex).toBe(1);
    expect(next.zoneDistance).toBe(0);
    expect(next.phase).toEqual({ kind: "walking" });
  });

  it("starts the next zone with Hall pass's Skip and Second chance back and no cards counted", () => {
    const { run } = walkWith(["kilo"]);
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
    const { run } = walkWith(["kilo"]);
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

  it("ends the run, finished, after the last zone, banking its pay and the Walk bonus", () => {
    const { run } = walkWith(["kilo", "duchess"]);
    const end = finishZone(data, { ...run, zoneIndex: WORLD.walkLength - 1 });
    const bonus = read(tuning, "money", "walkBonus");
    expect(end.run.phase).toEqual({ kind: "ended", reason: "finished" });
    expect(end.run.money).toBe(run.money + 2 * pay + bonus);
    expect(end.fees.map(({ causes }) => causes[0]?.kind)).toEqual(["pay", "pay", "bonus"]);
  });

  it("pays no Walk bonus once an owner has fired you", () => {
    const { run } = walkWith(["kilo", "duchess"]);
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
    const { run } = walkWith(["kilo", "duchess"]);
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
