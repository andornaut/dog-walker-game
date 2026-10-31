import { seededRandom } from "@andornaut/game-kit/random";
import { keysOf } from "@andornaut/game-kit/records";
import { describe, expect, it } from "vitest";

import { MINOR_OBSTACLES } from "../data/minorObstacles";
import { LANE_COUNT } from "../data/screen";
import { TUNING } from "../data/tuning";
import type {
  EncounterId,
  MinorObstacleId,
  Movement,
  ObstacleEncounterId,
  StopLanes,
  ZoneId,
} from "../data/types";
import { WORLD } from "../data/world";
import { read } from "../rules/units";
import { newRun, type PackDogs } from "../state/runState";
import { type HopMovement, hoppingInstead, plannerStreams, sharedWorld } from "../testing/movers";
import {
  FASTEST_WALKER,
  GAME_ROAD,
  inZone,
  LUCKY_IDS,
  MINOR_OBSTACLE_IDS,
  MOVER_SCROLL,
  OBSTACLE_IDS,
  REAL,
  type Real,
  realRun,
  ZONE_IDS,
} from "../testing/planner";
import { heartsByDog } from "../testing/runState";
import { atPack, data, geometry, inLane, step, walkWith, withHearts } from "../testing/walk";
import { weighedUp } from "../testing/world";
import { DART_VERGE_LANES, dartOutcome, drawMover, hopShapes } from "./moverPlanning";
import {
  inMotion,
  isPausing,
  laneAt,
  type MoverPath,
  moverPlace,
  type MoverStep,
  moverTell,
} from "./movers";
import { moverMovement, moverSpec } from "./moverSpecs";
import { itemHeight, startRoad, stepWalk, type Walk, walkScrollSpeed } from "./walk";
import { blocksLane, footprintOf, isPullObstacle, type WalkItem } from "./walkItems";
import { planZone } from "./zonePlan";

// A crosser 2.5 lanes in from the left edge 32px of scroll after its cue's 50px, its hit
// box then just inside the pack's band.
const crossing: MoverPath = {
  direction: 1,
  enterTravel: 500,
  idle: 0,
  lanesPerPixel: 2.5 / 32,
  motion: "cross",
  movement: "dart",
  stopAfter: null,
  tilt: 0,
  turnAfter: null,
  warning: 50,
};
// A step a lane to the right, 30px of scroll long.
const SIDESTEP = { lanes: 1, length: 30, travel: 0 } as const;
const moverAt = (kind: WalkItem["kind"], path: MoverPath, since: number): WalkItem => ({
  ...atPack(kind),
  mover: { path, since },
});

// A search for a kind's planned movers plans its zones a seed at a time from seed 1 and stops once
// it has found enough of them, so a kind its zones weigh low takes more seeds rather than failing,
// and fails only when the most seeds a search plans turn up none.
const SEARCH_ENOUGH = 8;
const SEARCH_SEEDS_MOST = 40;

// A stop-and-go across standing in its stop: the stops that leave the path open on its row, the
// lanes it covers, and whether it stands on whole lanes.
interface StandingStop {
  readonly open: readonly StopLanes[];
  readonly stands: StopLanes;
  readonly whole: boolean;
}

describe("movers", { timeout: 120_000 }, () => {
  const baselineData = { ...REAL, movementAssignments: {} };
  const OBSTACLE_KINDS = [...OBSTACLE_IDS, ...MINOR_OBSTACLE_IDS] as WalkItem["kind"][];
  // The rulebook's obstacles that never move: art sculptures, benches, bins, cherry trees,
  // fallen logs, hedges, iron fences, market stalls, potholes, puddles, streetcar platforms and
  // volleyball nets.
  const NEVER_MOVE: readonly WalkItem["kind"][] = [
    "artSculpture",
    "bench",
    "cherryTrees",
    "fallenLog",
    "hedge",
    "ironFence2",
    "ironFence3",
    "marketStall2",
    "marketStall3",
    "pothole",
    "puddle",
    "streetcarPlatform",
    "trashCan",
    "volleyballNet3",
  ];
  const movementOf = (kind: WalkItem["kind"]) => {
    if (kind === "tip" || kind === "treat") {
      return null;
    }
    const entry = Object.hasOwn(MINOR_OBSTACLES, kind)
      ? REAL.minorObstacles[kind as MinorObstacleId]
      : REAL.encounters[kind as ObstacleEncounterId];
    const movement = ("movement" in entry ? entry.movement : undefined) as Movement | undefined;
    return movement ?? null;
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
      expect(moverMovement(baselineData, counted(0), 1, "highPark", kind)).toEqual(
        movementOf(kind),
      );
      expect(moverMovement(baselineData, counted(0.99), 0.5, "highPark", kind)).toBeNull();
      const before = draws;
      expect(moverMovement(baselineData, counted(0), 0, "highPark", kind)).toBeNull();
      expect(draws).toBe(before);
    }
  });

  // The rulebook's lucky finds: the friendly neighbour walks about, the lost wallet lies still.
  it.each([
    { kind: "lostWallet", walks: false },
    { kind: "friendlyNeighbour", walks: true },
  ] as const)("walks the $kind about: $walks", ({ kind, walks }) => {
    expect(movementOf(kind) !== null).toBe(walks);
  });

  // A pickup or lucky find with no movement never moves and draws nothing; one with a movement
  // moves at the share, as an obstacle does.
  it.each(["tip", "treat", ...LUCKY_IDS] as const)("moves a %s only by its movement", (kind) => {
    const movement = movementOf(kind);
    if (movement === null) {
      const never = () => {
        throw new Error("drew");
      };
      expect(moverMovement(baselineData, never, 1, "highPark", kind)).toBeNull();
    } else {
      expect(moverMovement(baselineData, () => 0, 1, "highPark", kind)).toEqual(movement);
      expect(moverMovement(baselineData, () => 0.99, 0.5, "highPark", kind)).toBeNull();
    }
  });

  // Movement values the planner can build: a dart is one row, one wider than a lane never stops,
  // as its stop and verge spots are a lane's, and its tilt keeps it coming down the road; and an
  // in-lane mover moves at another speed than the road.
  it("gives every obstacle a movement the planner can build", () => {
    for (const kind of OBSTACLE_KINDS) {
      const movement = movementOf(kind);
      if (movement?.kind === "dart") {
        const { lanes, rows } = footprintOf(REAL, kind);
        expect(rows).toBe(1);
        expect(lanes === 1 || movement.stopShare === 0, kind).toBe(true);
        expect(movement.tilt.min).toBeLessThanOrEqual(movement.tilt.max);
        expect(movement.tilt.min).toBeGreaterThan(-1);
      } else if (movement?.kind === "inLane") {
        expect(movement.factor).toBeGreaterThan(0);
        expect(movement.factor).not.toBe(1);
      }
    }
  });

  it("keeps configured merge and step durations positive throughout their jitter range", () => {
    for (const kind of OBSTACLE_KINDS) {
      const movement = movementOf(kind);
      if (movement === null) {
        continue;
      }
      const { motion, variation } = moverSpec(
        REAL,
        plannerStreams(1),
        footprintOf(REAL, kind),
        movement,
      );
      if (motion.kind === "ride" && motion.merge !== undefined) {
        expect(Number.isFinite(motion.merge.seconds), kind).toBe(true);
        expect(motion.merge.seconds, kind).toBeGreaterThan(0);
      }
      if (motion.kind === "steps" || motion.kind === "approach") {
        expect(Number.isFinite(motion.stepSeconds), kind).toBe(true);
        expect(motion.stepSeconds, kind).toBeGreaterThan(0);
        expect(variation.lengthShare, kind).toBeGreaterThanOrEqual(0);
        expect(variation.lengthShare, kind).toBeLessThan(1);
      }
    }
  });

  // Each dart kind's outcome draw, over even steps from 0 up to 1, turns back and stops at its
  // kind's shares, so a kind with no stop share, such as the ball, never stops, and of its stops
  // the tuning's verge share stops on the verge.
  it.each(
    OBSTACLE_KINDS.flatMap((kind) => {
      const movement = movementOf(kind);
      return movement?.kind === "dart" ? [{ kind, movement }] : [];
    }),
  )("turns back and stops a $kind at its kind's shares", ({ movement }) => {
    const steps = 1000;
    const vergeShare = read(TUNING, "probability", "dartVergeStopShare");
    const outcomes = Array.from({ length: steps }, (_, i) =>
      dartOutcome({ ...movement, vergeShare }, (i + 0.5) / steps),
    );
    const share = (outcome: string) => outcomes.filter((drawn) => drawn === outcome).length / steps;
    expect(share("turn")).toBeCloseTo(movement.turnBackShare, 2);
    expect(share("stop")).toBeCloseTo(movement.stopShare * (1 - vergeShare), 2);
    expect(share("verge")).toBeCloseTo(movement.stopShare * vergeShare, 2);
  });

  // The data with every obstacle that can move moving.
  const everyMover: Real = { ...REAL, world: sharedWorld(WORLD, 1) };
  // Every stepper and hopper hopping alike, each hop up to 2 spots any way, or sideways only.
  const HOPS: readonly HopMovement[] = [
    { kind: "hop", most: 2, times: { max: 2, min: 1 } },
    { kind: "hop", most: 2, sideways: true, times: { max: 2, min: 1 } },
  ];
  const hopping = HOPS.map((hop) => ({ hop, tuned: hoppingInstead(everyMover, hop) }));

  it("plans the same movers for the same seed", () => {
    const zoned = inZone(realRun(everyMover, FASTEST_WALKER), WORLD.lastZone, WORLD.walkLength - 1);
    const plan = (seed: number) =>
      planZone(everyMover, GAME_ROAD, plannerStreams(seed), {
        road: startRoad(LANE_COUNT),
        run: zoned,
      }).road.pending;
    const first = plan(4);
    expect(plan(4)).toEqual(first);
    expect(plan(5)).not.toEqual(first);
  });

  // A hop is one jump of 1 to most spots one way, across, up the road or diagonally up, never
  // down, sideways only when it says so, as long as the tuning's hop within its jitter; across
  // zones and seeds at the first zone's pace, the slowest, hoppers make hops of every length they
  // can, and hop every count of times in their range; a later hop that would come once the
  // hopper has reached the pack's rows never does.
  it("hops each hopper its drawn count of times, any way or sideways only", () => {
    for (const { hop, tuned } of hopping) {
      const spots = new Set<number>();
      const times = new Set<number>();
      for (const zone of ZONE_IDS) {
        const zoned = inZone(realRun(tuned, FASTEST_WALKER), zone, 0);
        const length =
          read(tuned.tuning, "seconds", "moverHopSeconds") * walkScrollSpeed(tuned, zoned);
        const jitter = read(tuned.tuning, "seconds", "moverMoveSecondsJitter");
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
              expect(Math.abs(hopLength / length - 1)).toBeLessThanOrEqual(jitter + 1e-9);
              spots.add(Math.max(Math.abs(lanes), rows));
            }
          }
        }
      }
      expect([...spots].sort()).toEqual(Array.from({ length: hop.most }, (_, i) => i + 1));
      expect([...times].sort()).toEqual([1, 2]);
    }
  });

  // Each stepper, hopper and stalker of the game's data, lucky finds included, planned across
  // seeds at the first zone's pace and the last's with every mover moving: a stalker plans for its
  // drawn count of steps, each count in its kind's range coming up, and a stepper or hopper moves
  // at least once and never more than its kind's most.
  const counted = [...OBSTACLE_KINDS, ...LUCKY_IDS].flatMap((kind) => {
    const movement = movementOf(kind);
    if (movement?.kind === "approach" || movement?.kind === "step") {
      return [{ kind, range: movement.steps }];
    }
    return movement?.kind === "hop" ? [{ kind, range: movement.times }] : [];
  });
  // Every spawn so planned, with the road's speed where it was planned.
  type Planned = {
    kind: WalkItem["kind"];
    lane: number;
    mover: MoverPath | undefined;
    speed: number;
  };
  // Every spawn planned in a zone at a walk position on a seed, planned once for every search.
  const spawnPlans = new Map<string, readonly Planned[]>();
  const spawnsOf = (zone: ZoneId, zoneIndex: number, seed: number): readonly Planned[] => {
    const key = `${zone} ${zoneIndex} ${seed}`;
    let planned = spawnPlans.get(key);
    if (planned === undefined) {
      const zoned = inZone(realRun(everyMover, FASTEST_WALKER), zone, zoneIndex);
      const walk = planZone(everyMover, GAME_ROAD, plannerStreams(seed), {
        road: startRoad(LANE_COUNT),
        run: zoned,
      });
      const speed = walkScrollSpeed(everyMover, zoned);
      planned = walk.road.pending.map(({ kind, lane, mover }) => ({ kind, lane, mover, speed }));
      spawnPlans.set(key, planned);
    }
    return planned;
  };
  // Every spawn planned in zone at its first and last walk positions, on each of seeds.
  const planIn = (zone: ZoneId, seeds: readonly number[]): Planned[] =>
    [0, WORLD.walkLength - 1].flatMap((zoneIndex) =>
      seeds.flatMap((seed) => spawnsOf(zone, zoneIndex, seed)),
    );
  // The spawns planned in zones that match, planned a seed at a time from seed 1 until found holds
  // of them or the search has planned its most seeds, failing if none of what it seeks come up.
  const searchSpawns = (
    zones: readonly ZoneId[],
    matches: (spawn: Planned) => boolean,
    found: (spawns: readonly Planned[]) => boolean,
    sought: string,
  ): Planned[] => {
    const spawns: Planned[] = [];
    for (let seed = 1; seed <= SEARCH_SEEDS_MOST && !found(spawns); seed++) {
      spawns.push(...zones.flatMap((zone) => planIn(zone, [seed])).filter(matches));
    }
    const where = zones.length > 0 ? `zones ${zones.join(", ")}` : "no zone that weighs it above 0";
    expect(
      spawns.length,
      `no ${sought} planned on ${SEARCH_SEEDS_MOST} seeds in ${where}`,
    ).toBeGreaterThan(0);
    return spawns;
  };
  const enough = (spawns: readonly Planned[]) => spawns.length >= SEARCH_ENOUGH;
  // The zones that plan a kind: every zone for a lucky find, which each zone's quota places, and
  // otherwise those that weigh it above 0, of its own zones if it has any.
  const zonesOf = (kind: WalkItem["kind"]): ZoneId[] => {
    if ((LUCKY_IDS as readonly string[]).includes(kind)) {
      return ZONE_IDS;
    }
    const minor = Object.hasOwn(MINOR_OBSTACLES, kind);
    const entry = minor
      ? everyMover.minorObstacles[kind as MinorObstacleId]
      : everyMover.encounters[kind as ObstacleEncounterId];
    return everyMover.world.zones
      .filter(({ id, weights }) => {
        const weight = minor
          ? weights.minorObstacles[kind as MinorObstacleId]
          : weights.obstacles[kind as ObstacleEncounterId];
        return (
          weight > 0 && (!("zones" in entry) || (entry.zones as readonly string[]).includes(id))
        );
      })
      .map(({ id }) => id as ZoneId);
  };
  // A kind's spawns planned in the zones that draw it, searched until found holds of them.
  const spawnsOfKind = (kind: WalkItem["kind"], found = enough) =>
    searchSpawns(zonesOf(kind), (spawn) => spawn.kind === kind, found, kind);
  // A kind's movers planned in the zones that draw it, searched until found holds of them.
  type PlannedMover = Planned & { mover: MoverPath };
  const isMover = (spawn: Planned): spawn is PlannedMover => spawn.mover !== undefined;
  const moversOf = (kind: WalkItem["kind"], found = enough): PlannedMover[] =>
    searchSpawns(
      zonesOf(kind),
      (spawn) => spawn.kind === kind && isMover(spawn),
      found,
      `moving ${kind}`,
    ).filter(isMover);
  // The counts of steps a kind's stalkers among spawns plan.
  const stalkedRows = (spawns: readonly Planned[]) =>
    new Set(spawns.flatMap(({ mover }) => (mover?.motion === "approach" ? [mover.rows] : [])));
  it.each(counted)("moves each $kind within its range of times across seeds", ({ kind, range }) => {
    const { delays, lengths } = drawMover(plannerStreams(1));
    expect(range.max).toBeLessThanOrEqual(Math.min(delays.length, lengths.length));
    const everyCount = Array.from({ length: range.max - range.min + 1 }, (_, i) => range.min + i);
    const stalks = movementOf(kind)?.kind === "approach";
    const paths = moversOf(
      kind,
      (spawns) =>
        enough(spawns) && (!stalks || everyCount.every((rows) => stalkedRows(spawns).has(rows))),
    );
    for (const { mover } of paths) {
      if (mover.motion === "approach") {
        expect(mover.rows).toBeGreaterThanOrEqual(range.min);
        expect(mover.rows).toBeLessThanOrEqual(range.max);
        expect(mover.pending).toHaveLength(mover.rows);
      } else if (mover.motion === "steps") {
        expect(mover.steps.length).toBeGreaterThanOrEqual(1);
        expect(mover.steps.length).toBeLessThanOrEqual(range.max);
      }
    }
    if (stalks) {
      expect([...stalkedRows(paths)].sort((a, b) => a - b)).toEqual(everyCount);
    }
  });

  // A lucky find that walks about is planned as a prize, blocking no lane, and like every
  // stepper shows the wander mark before its first step alone.
  const walkingLucky = LUCKY_IDS.filter((kind) => movementOf(kind) !== null);
  it.each(walkingLucky)("plans a walking %s as a prize, cueing its first step only", (kind) => {
    expect(blocksLane(REAL, kind)).toBe(false);
    for (const { mover } of moversOf(kind)) {
      const steps = mover.motion === "steps" ? mover.steps : [];
      expect(steps.length).toBeGreaterThan(0);
      expect(steps.map(({ uncued }) => uncued === true)).toEqual(steps.map((_, i) => i > 0));
      const cues = steps.map(({ at }) => moverTell(mover, at - 1e-6)?.kind ?? null);
      expect(cues).toEqual(steps.map((_, i) => (i === 0 ? "wander" : null)));
    }
  });

  // A kind some zone draws whose movement is a pattern (bounce, dive, follow, merge, stopAndGo,
  // stopAndGoAcross, sway),
  // planned across seeds at the first zone's pace and the last's with every mover moving, as the
  // passability sweep plans it: its most moves, whether it cues each move, and its lanes.
  const patternOf = (movement: Movement | null) => {
    switch (movement?.kind) {
      case "bounce":
        return { cueEach: true, most: movement.hops.max, rocks: true };
      case "follow":
        return { cueEach: true, most: movement.steps.max, rocks: false };
      case "stopAndGo":
        return { cueEach: true, most: movement.stops.max + 1, rocks: false };
      case "sway":
        return { cueEach: false, most: 2 * movement.times.max, rocks: true };
      default:
        return null;
    }
  };
  // The planner builds each way of moving from its kind's numbers the same way, so one kind of
  // each way of moving, footprint and stops stands for the rest.
  const patternKey = (kind: WalkItem["kind"]) => {
    const movement = movementOf(kind);
    const spots = movement?.kind === "stopAndGoAcross" ? movement.stops : null;
    return JSON.stringify([movement?.kind ?? null, footprintOf(REAL, kind), spots]);
  };
  const patterned = OBSTACLE_KINDS.filter(
    (kind) =>
      zonesOf(kind).length > 0 &&
      (patternOf(movementOf(kind)) !== null ||
        movementOf(kind)?.kind === "dive" ||
        movementOf(kind)?.kind === "merge" ||
        movementOf(kind)?.kind === "stopAndGoAcross"),
  ).filter(
    (kind, i, kinds) => kinds.findIndex((other) => patternKey(other) === patternKey(kind)) === i,
  );
  // A kind's movers planned in the zones that draw it, searched until enough come up.
  const pathsOf = (kind: WalkItem["kind"]) => moversOf(kind).map(({ mover }) => mover);

  // A stepping pattern moves at least once and at most its most, each step a lane to one side
  // (back the way it came, for a bounce or a sway, so it rocks between two lanes), or in its lane
  // only for a stop-and-go, at its kind's speed; it stays on the road. A dive always lands and
  // slides into a lane, never turning back or stopping on the verge. A merge rides its lane and
  // merges a lane to one side on the road, wholly before it reaches the pack's rows. A stop-and-go
  // across crosses level with the road as wide as its footprint, never turning back or stopping for
  // good, and stands once in one of its stops.
  it.each(patterned)("moves each %s in its pattern, within its lanes", (kind) => {
    const movement = movementOf(kind);
    const pattern = patternOf(movement);
    const span = footprintOf(REAL, kind).lanes;
    for (const mover of pathsOf(kind)) {
      if (mover.motion === "signature") {
        expect(Object.values(REAL.movementProfiles)).toContain(mover.route.profile);
        expect(mover.route.legs.slice(1).length).toBeGreaterThan(0);
        // Complete profile geometry and contextual assignments are checked across all recipes.
        expect(mover.route.cues.some((cue) => cue.end === mover.route.entryEnd)).toBe(true);
        continue;
      }
      if (mover.motion === "cross" && movement?.kind === "stopAndGoAcross") {
        const { pause } = mover;
        expect(pause).toBeDefined();
        expect([mover.span, mover.tilt, mover.turnAfter, mover.stopAfter]).toEqual([
          span,
          0,
          null,
          null,
        ]);
        const halfway = mover.warning + (pause?.after ?? 0) / mover.lanesPerPixel + 1;
        expect(isPausing(mover, halfway)).toBe(true);
        const left = laneAt(moverPlace(LANE_COUNT, mover, halfway).lanePosition);
        expect(movement.stops).toContainEqual([left, left + span - 1]);
        continue;
      }
      if (mover.motion === "cross") {
        expect(movement?.kind).toBe("dive");
        expect(mover.slide).toBe(movement?.kind === "dive" ? movement.slide : undefined);
        expect(mover.turnAfter).toBeNull();
        expect(mover.stopAfter).not.toBeNull();
        expect(mover.stopAfter ?? Infinity).toBeLessThanOrEqual(LANE_COUNT);
        continue;
      }
      if (mover.motion === "ride") {
        expect(movement?.kind).toBe("merge");
        const { merge } = mover;
        expect(Math.abs(merge?.lanes ?? 0)).toBe(1);
        const merged = mover.lane + (merge?.lanes ?? 0);
        expect(merged).toBeGreaterThanOrEqual(0);
        expect(merged + span).toBeLessThanOrEqual(LANE_COUNT);
        const done = (merge?.at ?? Infinity) + (merge?.length ?? 0);
        expect(moverPlace(LANE_COUNT, mover, done).travel).toBeLessThanOrEqual(
          GAME_ROAD.sightLength,
        );
        continue;
      }
      expect(mover.motion).toBe("steps");
      const steps = mover.motion === "steps" ? mover.steps : [];
      expect(steps.length).toBeGreaterThanOrEqual(1);
      expect(steps.length).toBeLessThanOrEqual(pattern?.most ?? 0);
      let lane = mover.lane;
      for (const [i, { lanes, travel }] of steps.entries()) {
        if (movement?.kind === "stopAndGo") {
          expect(lanes).toBe(0);
          expect(Math.sign(travel)).toBe(Math.sign(movement.factor - 1));
        } else {
          expect(Math.abs(lanes)).toBe(1);
          expect(travel).toBe(0);
        }
        if (pattern?.rocks === true && i > 0) {
          expect(lanes).toBe(-(steps[i - 1]?.lanes ?? 0));
        }
        lane += lanes;
        expect(lane).toBeGreaterThanOrEqual(0);
        expect(lane + span).toBeLessThanOrEqual(LANE_COUNT);
      }
    }
  });

  // A stop-and-go across, planned in its zones at the first zone's pace and the last's with every
  // mover moving: the lanes it covers while it stands, first and last, whether it stands on whole
  // lanes, and its kind's stops that leave open the lanes the path holds on its row: the path's
  // lane there and, where the path changes lane after it, every lane the change crosses.
  const stopKinds = OBSTACLE_KINDS.filter(
    (kind) => movementOf(kind)?.kind === "stopAndGoAcross" && zonesOf(kind).length > 0,
  );
  const stopsOf = (kind: WalkItem["kind"]) => {
    const movement = movementOf(kind);
    return movement?.kind === "stopAndGoAcross" ? movement.stops : [];
  };
  const stopsOn = (tuned: Real, kind: WalkItem["kind"], seed: number): StandingStop[] =>
    zonesOf(kind).flatMap((zone) =>
      [0, WORLD.walkLength - 1].flatMap((zoneIndex) => {
        const run = inZone(realRun(tuned, FASTEST_WALKER), zone, zoneIndex);
        const { road } = planZone(tuned, GAME_ROAD, plannerStreams(seed), {
          road: startRoad(LANE_COUNT),
          run,
        });
        const span = footprintOf(REAL, kind).lanes;
        return road.pending.flatMap(({ distance, kind: planned, mover }) => {
          if (planned !== kind || mover?.motion !== "cross" || mover.pause === undefined) {
            return [];
          }
          const since = mover.warning + mover.pause.after / mover.lanesPerPixel + 1;
          const { lanePosition } = moverPlace(LANE_COUNT, mover, since);
          const left = laneAt(lanePosition);
          // Its row comes on screen enterTravel less its cue before it does.
          const row = distance - mover.enterTravel + mover.warning;
          const at = road.path.findIndex((held) => Math.abs(held.distance - row) < 1e-6);
          expect(at).toBeGreaterThanOrEqual(0);
          const lane = road.path[at]?.lane ?? Number.NaN;
          const next = road.path[at + 1]?.lane ?? lane;
          const [low, high] = [Math.min(lane, next), Math.max(lane, next)];
          const open = stopsOf(kind).filter(([first, last]) => last < low || first > high);
          const whole = Math.abs(lanePosition - left) < 1e-9;
          return [{ open, stands: [left, left + span - 1] as const, whole }];
        });
      }),
    );
  // Plans tuned a seed at a time from seed 1 until found holds of the stops or the search has
  // planned its most seeds.
  const searchStops = (
    tuned: Real,
    kind: WalkItem["kind"],
    found: (stops: readonly StandingStop[]) => boolean,
  ): StandingStop[] => {
    const stops: StandingStop[] = [];
    for (let seed = 1; seed <= SEARCH_SEEDS_MOST && !found(stops); seed++) {
      stops.push(...stopsOn(tuned, kind, seed));
    }
    return stops;
  };
  it.each(stopKinds)(
    "gives each of %s's stops as many lanes as it is wide, on the road",
    (kind) => {
      const span = footprintOf(REAL, kind).lanes;
      expect(stopsOf(kind).length).toBeGreaterThan(0);
      for (const [first, last] of stopsOf(kind)) {
        expect(last - first + 1).toBe(span);
        expect(first).toBeGreaterThanOrEqual(0);
        expect(last).toBeLessThan(LANE_COUNT);
      }
    },
  );
  // On whole lanes, so it covers only as many lanes as it is wide: a 2-lane one never straddles
  // three; and in a stop that leaves the path open on its row.
  it.each(stopKinds)("stands each %s in one of its stops, never over the path's lane", (kind) => {
    const stops = searchStops(everyMover, kind, (found) => found.length >= SEARCH_ENOUGH);
    expect(stops.length).toBeGreaterThan(0);
    for (const { open, stands, whole } of stops) {
      expect(whole).toBe(true);
      expect(open).toContainEqual(stands);
    }
  });
  // A kind with several stops draws one, each as likely, and stands in it on a row where it leaves
  // the path open, so where a row leaves several open, the row does not fix which: across seeds
  // each stop is stood in on some row where another was open too. Searched until each has been.
  // Whether a row fixes the stop is a matter of each mover and its row alone, whatever else its
  // zone plans, so its zones weigh it up (weighedUp) to bring more of them a plan.
  const severalStops = stopKinds.filter((kind) => stopsOf(kind).length > 1);
  const choseOver = (stop: StopLanes, found: readonly StandingStop[]) =>
    found.some(({ open, stands }) => stands[0] === stop[0] && open.length > 1);
  it.each(severalStops)("stands %s in each of its stops where another is open too", (kind) => {
    const tuned = weighedUp(kind as MinorObstacleId | ObstacleEncounterId, everyMover);
    const stops = searchStops(tuned, kind, (found) =>
      stopsOf(kind).every((stop) => choseOver(stop, found)),
    );
    expect(stopsOf(kind).filter((stop) => !choseOver(stop, stops))).toEqual([]);
  });

  // Its first move is cued: a dive's arrow before it sets off, a stop-and-go across's before it
  // sets off and again before it sets off from its stop, a merge's arrow down its lane
  // before it enters and its wander mark before it merges, and a stepping pattern's wander mark
  // before its first step and, where its kind cues each, before every step.
  it.each(patterned)("cues each %s's first move, and each later one its kind cues", (kind) => {
    const pattern = patternOf(movementOf(kind));
    for (const mover of pathsOf(kind)) {
      if (mover.motion === "cross") {
        expect(moverTell(mover, mover.warning - 1e-6)?.kind).toBe("across");
        const { pause } = mover;
        if (pause !== undefined) {
          const restart = mover.warning + pause.after / mover.lanesPerPixel + pause.length;
          expect(moverTell(mover, restart - pause.cue - 1e-6)).toBeNull();
          expect(moverTell(mover, restart - 1e-6)?.kind).toBe("across");
        }
        continue;
      }
      if (mover.motion === "ride") {
        expect(moverTell(mover, mover.warning - 1e-6)?.kind).toBe("down");
        expect(moverTell(mover, (mover.merge?.at ?? 0) - 1e-6)?.kind).toBe("wander");
        continue;
      }
      const steps = mover.motion === "steps" ? mover.steps : [];
      const cues = steps.map(({ at }) => moverTell(mover, at - 1e-6)?.kind ?? null);
      expect(cues).toEqual(
        steps.map((_, i) => (i === 0 || pattern?.cueEach === true ? "wander" : null)),
      );
    }
  });

  // It never comes back up the screen toward a pack that has passed it: its travel down the road
  // never falls as the road scrolls, and no step starts once it has reached the pack's rows.
  it.each(patterned)("never moves a %s back up the road", (kind) => {
    for (const mover of pathsOf(kind)) {
      let travel = -Infinity;
      for (let since = 0; since < MOVER_SCROLL; since += 2) {
        const place = moverPlace(LANE_COUNT, mover, since);
        expect(place.travel).toBeGreaterThanOrEqual(travel - 1e-9);
        travel = place.travel;
      }
      if (mover.motion === "steps") {
        for (const { at } of mover.steps) {
          expect(moverPlace(LANE_COUNT, mover, at).travel).toBeLessThan(GAME_ROAD.sightLength);
        }
      }
    }
  });

  // A pull obstacle passes through the pack, so it blocks no lane: one that moves is planned as a
  // moving prize, as a walking lucky find is, and comes moving on every plan.
  const movingPull = OBSTACLE_KINDS.filter(
    (kind) => isPullObstacle(REAL, kind) && movementOf(kind) !== null,
  );
  it.each(movingPull)("plans a moving %s as a prize that moves", (kind) => {
    expect(blocksLane(REAL, kind)).toBe(false);
    expect(spawnsOfKind(kind).filter(({ mover }) => mover === undefined)).toEqual([]);
  });

  // The friendly neighbour in the pack's lane as her row reaches the pack: showing her cue before
  // a step, partway through a step, and standing after an uncued one. However she meets the pack
  // she pays out as she does standing, and is never a bump, a card or a stop.
  const stroll = (steps: readonly MoverStep[]): MoverPath => ({
    lane: 2,
    motion: "steps",
    movement: "step",
    steps,
    warning: 50,
  });
  it.each([
    { moving: false, name: "showing her cue", path: stroll([{ at: 560, ...SIDESTEP }]) },
    { moving: true, name: "partway through a step", path: stroll([{ at: 520, ...SIDESTEP }]) },
    {
      moving: false,
      name: "standing after an uncued step",
      path: stroll([
        { at: 400, ...SIDESTEP },
        { at: 450, ...SIDESTEP, lanes: -1, uncued: true },
      ]),
    },
  ])("pays out the friendly neighbour $name, never as a bump", ({ moving, path }) => {
    const since = 532;
    expect(inMotion(path, since)).toBe(moving);
    const met = (item: WalkItem) => withHearts(1, walkWith(["kilo"], [item]));
    const walk = met(moverAt("friendlyNeighbour", path, since));
    const after = step(walk);
    const standing = step(met(atPack("friendlyNeighbour")));
    expect(after.instants.map(({ encounter }) => encounter)).toEqual(["friendlyNeighbour"]);
    expect(heartsByDog(after.walk.run)).not.toEqual(heartsByDog(walk.run));
    expect(after.walk.run).toEqual(standing.walk.run);
    expect(after.bumps).toEqual([]);
    expect(after.walk.run.bumpsByZone).toEqual([]);
    expect(after.cards).toEqual([]);
    expect(after.walk.road.hitStop).toBeNull();
    expect(after.walk.road.items).toEqual([]);
  });

  // A ball that has ended its move standing on a tip, both at the pack. The tip is a plain grab
  // however the pack reaches it; the ball hits only the pack that touches it, in its lane, and
  // not one that grabs the tip a lane over by Long reach.
  const longReach = keysOf(data.walkers).find(
    (walker) => data.walkers[walker].perk === "longReach",
  );
  it.each([
    { bumps: 1, lane: 2, name: "in its lane", reach: 0 },
    { bumps: 0, lane: 1, name: "a lane over by Long reach", reach: 1 },
  ])(
    "grabs a tip a stopped mover stands on $name, with $bumps bumps",
    ({ bumps, lane, name, reach }) => {
      const path = stroll([
        { at: 400, ...SIDESTEP },
        { at: 450, ...SIDESTEP, lanes: -1, uncued: true },
      ]);
      const since = 532;
      expect(inMotion(path, since)).toBe(false);
      const reaching = {
        ...data,
        tuning: { ...data.tuning, counts: { ...data.tuning.counts, longReachLanes: reach } },
      };
      const walker = reach > 0 && longReach !== undefined ? longReach : data.defaultWalker;
      const walk = inLane(lane, {
        road: {
          ...startRoad(5),
          items: [moverAt("ball", path, since), atPack("tip", 1)],
          nextItemId: 2,
        },
        run: newRun(reaching, 3, { dogs: ["kilo"], gear: null, walker }),
      });
      const after = stepWalk(reaching, geometry, seededRandom(1), 0.01, walk);
      expect(after.tips, name).toHaveLength(1);
      expect(after.collected.map(({ kind }) => kind)).toEqual(["tip"]);
      expect(after.bumps).toHaveLength(bumps);
      expect(after.cards).toEqual([]);
    },
  );

  // An obstacle kind that blocks a lane, moving or standing, starts against each edge of the
  // road on some seed: its leftmost lane is lane 0 on some plan and the last its width leaves on
  // another. The planner draws a start lane by footprint and way of moving, so one kind of each
  // footprint, way of moving and table covers them all.
  const blocking = OBSTACLE_KINDS.filter((kind) => blocksLane(everyMover, kind));
  const edgeKey = (kind: WalkItem["kind"]) =>
    JSON.stringify([
      footprintOf(everyMover, kind),
      movementOf(kind)?.kind ?? null,
      Object.hasOwn(MINOR_OBSTACLES, kind),
    ]);
  const edgeKinds = blocking.filter(
    (kind, i) => blocking.findIndex((other) => edgeKey(other) === edgeKey(kind)) === i,
  );
  // Each kind is searched until it has started against both edges.
  it.each(edgeKinds)("starts a %s against each edge of the road on some seed", (kind) => {
    const edges = [0, LANE_COUNT - footprintOf(everyMover, kind).lanes];
    const lanesOf = (spawns: readonly Planned[]) => new Set(spawns.map(({ lane }) => lane));
    const spawns = spawnsOfKind(kind, (found) => edges.every((lane) => lanesOf(found).has(lane)));
    expect([...lanesOf(spawns)]).toEqual(expect.arrayContaining(edges));
  });

  // A stalker wider than a lane never fits a lane to either side, so from a middle lane it
  // reaches one side only: left on some plans and right on others.
  const wideStalkers = OBSTACLE_KINDS.filter(
    (kind) => movementOf(kind)?.kind === "approach" && footprintOf(everyMover, kind).lanes > 1,
  );
  it.each(wideStalkers)("reaches a %s either way from a middle lane across seeds", (kind) => {
    const { lanes: width } = footprintOf(everyMover, kind);
    // The ways the stalkers among spawns reach from a middle lane.
    const waysOf = (spawns: readonly Planned[]) => {
      const ways = new Set<string>();
      for (const { mover } of spawns) {
        if (mover?.motion !== "approach" || mover.lane < 1 || mover.lane > LANE_COUNT - width - 1) {
          continue;
        }
        if (mover.reach.first < mover.lane) {
          ways.add("left");
        }
        if (mover.reach.first + mover.reach.count - 1 > mover.lane) {
          ways.add("right");
        }
      }
      return [...ways].sort();
    };
    const movers = moversOf(kind, (found) => waysOf(found).length === 2);
    expect(waysOf(movers)).toEqual(["left", "right"]);
  });

  // Each step, hop and stalker's step lasts its kind's length at a factor drawn per move within
  // the tuning's jitter either way, and the draws spread to both sides of the kind's length.
  const moveKinds = [
    { movement: "approach", seconds: read(TUNING, "seconds", "moverStepSeconds") },
    { movement: "hop", seconds: read(TUNING, "seconds", "moverHopSeconds") },
    { movement: "step", seconds: read(TUNING, "seconds", "moverStepSeconds") },
  ];
  it.each(moveKinds)(
    "draws each $movement's length within the jitter either way",
    ({ movement, seconds: moveSeconds }) => {
      const jitter = read(TUNING, "seconds", "moverMoveSecondsJitter");
      // Each move's length over its kind's length, of the movers among spawns.
      const factorsOf = (spawns: readonly Planned[]) =>
        spawns.flatMap(({ mover, speed }) => {
          const lengths =
            mover?.motion === "approach" || mover?.motion === "shy"
              ? mover.lengths
              : mover?.motion === "steps"
                ? mover.steps.map(({ length }) => length)
                : [];
          return lengths.map((length) => length / (moveSeconds * speed));
        });
      // Searched until enough movers have come up and their draws fall either side of 1.
      const spread = (spawns: readonly Planned[]) => {
        const drawn = factorsOf(spawns);
        return drawn.some((factor) => factor < 1) && drawn.some((factor) => factor > 1);
      };
      const factors = factorsOf(
        searchSpawns(
          ZONE_IDS,
          (spawn) => spawn.mover?.movement === movement,
          (found) => enough(found) && spread(found),
          `${movement} mover`,
        ),
      );
      expect(Math.min(...factors)).toBeGreaterThanOrEqual(1 - jitter - 1e-9);
      expect(Math.max(...factors)).toBeLessThanOrEqual(1 + jitter + 1e-9);
      expect(Math.min(...factors)).toBeLessThan(1);
      expect(Math.max(...factors)).toBeGreaterThan(1);
    },
  );

  it("brings a mover onto the road as its cue, carrying its path", () => {
    const walk = walkWith(["kilo"]);
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
        lengths: [50],
        motion: "approach",
        movement: "approach",
        pending: [{ at: 300, kind: "after" }],
        reach: { count: 3, first: 1 },
        rows: 1,
        steps: [],
        stopTravel: geometry.sightLength,
        warning: 100,
      };
      const before = inLane(lane, walkWith(["kilo"], [moverAt("coyote", stalking, 200 - 1e-6)]));
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
      lengths: [50, 50],
      motion: "approach",
      movement: "approach",
      pending: [{ kind: "near", travel: 0 }],
      reach: { count: 3, first: 1 },
      rows: 2,
      steps: [first],
      stopTravel: geometry.sightLength,
      warning: 100,
    };
    const before = inLane(4, walkWith(["kilo"], [moverAt("coyote", stalking, 150 - 1e-6)]));
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
      lengths: [30],
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
    const before = inLane(lane, walkWith(["kilo"], [moverAt("bunny", shy, 200 - 1e-6)]));
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
      const walk = walkWith(["kilo"], [item]);
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
        dogs: ["ginger"],
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

  // A dart that has stopped in the far lane meets the pack standing there; one that has stopped
  // on the verge past it is off the road, so the walk drops it and the pack in the far lane
  // takes no hit. Both crossed 90px of scroll after their cues at 2.5 lanes per 32px, so both
  // have stopped, level with the pack's band.
  it.each([
    { bumps: 1, name: "in the far lane", onRoad: true, stopAfter: LANE_COUNT - 0.5 },
    { bumps: 0, name: "on the verge", onRoad: false, stopAfter: LANE_COUNT + DART_VERGE_LANES },
  ])("leaves a dart stopped $name with $bumps bumps", ({ bumps, onRoad, stopAfter }) => {
    const stopped: MoverPath = { ...crossing, enterTravel: 442, stopAfter };
    const after = step(inLane(LANE_COUNT - 1, walkWith(["kilo"], [moverAt("ball", stopped, 140)])));
    expect(after.bumps).toHaveLength(bumps);
    expect(after.walk.road.items.length > 0 || after.bumps.length > 0).toBe(onRoad);
  });

  it("bumps the pack like a plain obstacle on contact with a ball or an in-lane cyclist", () => {
    const ball = crossing;
    expect(step(walkWith(["kilo"], [moverAt("ball", ball, 82)])).bumps).toHaveLength(1);
    const cyclist: MoverPath = {
      lane: 2,
      lanes: 1,
      motion: "ride",
      movement: "inLane",
      speedMultiplier: 2,
      warning: 50,
    };
    // 50px of cue, then 266px of scroll at twice the road's speed: 532px down the road.
    expect(step(walkWith(["kilo"], [moverAt("cyclist", cyclist, 316)])).bumps).toHaveLength(1);
  });
});
