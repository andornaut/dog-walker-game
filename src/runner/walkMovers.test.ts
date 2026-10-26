import { describe, expect, it } from "vitest";

import { MINOR_OBSTACLES } from "../data/minorObstacles";
import { LANE_COUNT } from "../data/screen";
import { TUNING } from "../data/tuning";
import type {
  EncounterId,
  MinorObstacleId,
  Movement,
  ObstacleEncounterId,
  ZoneId,
} from "../data/types";
import { WORLD } from "../data/world";
import { read } from "../rules/units";
import { type PackDogs } from "../state/runState";
import { lanesReachedAtEnd } from "../testing/avoidable";
import { type HopMovement, hoppingInstead, plannerStreams, sharedWorld } from "../testing/movers";
import {
  blockingSpans,
  FASTEST_WALKER,
  GAME_ROAD,
  inZone,
  LANES,
  LUCKY_IDS,
  MINOR_OBSTACLE_IDS,
  moverContact,
  moverSpans,
  OBSTACLE_IDS,
  plannedHeight,
  REAL,
  type Real,
  realRun,
  ROAD_LENGTH,
  slowestLaneMove,
  TALL_PACK_ROAD,
  TALLER,
  walkwayOf,
  widerRows,
  ZONE_IDS,
} from "../testing/planner";
import { heartsByDog } from "../testing/runState";
import { atPack, data, geometry, inLane, step, walkWith, withHearts } from "../testing/walk";
import { STEP_SECONDS } from "./fixedStep";
import {
  dartOutcome,
  drawMover,
  hasLeftRoad,
  hopShapes,
  inMotion,
  type MoverPath,
  moverPlace,
  type MoverStep,
  moverTell,
  onScreenOf,
} from "./movers";
import {
  blocksLane,
  footprintOf,
  itemHeight,
  moverMovement,
  planZone,
  type RoadGeometry,
  startRoad,
  type Walk,
  type WalkItem,
  walkScrollSpeed,
} from "./walk";

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
// A crosser 2.5 lanes in from the left edge 32px of scroll after its cue's 50px, its hit
// box then just inside the pack's band.
const crossing: MoverPath = {
  direction: 1,
  enterTravel: 500,
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

describe("movers", { timeout: 120_000 }, () => {
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
    if (kind === "tip" || kind === "treat") {
      return null;
    }
    const entry = Object.hasOwn(MINOR_OBSTACLES, kind)
      ? tuned.minorObstacles[kind as MinorObstacleId]
      : tuned.encounters[kind as ObstacleEncounterId];
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
      expect(moverMovement(REAL, counted(0), 1, kind)).toEqual(movementOf(kind));
      expect(moverMovement(REAL, counted(0.99), 0.5, kind)).toBeNull();
      const before = draws;
      expect(moverMovement(REAL, counted(0), 0, kind)).toBeNull();
      expect(draws).toBe(before);
    }
  });

  // The rulebook's lucky finds: the friendly neighbor walks about, the lost wallet lies still.
  it.each([
    { kind: "lostWallet", walks: false },
    { kind: "pettingNeighbor", walks: true },
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
      expect(moverMovement(REAL, never, 1, kind)).toBeNull();
    } else {
      expect(moverMovement(REAL, () => 0, 1, kind)).toEqual(movement);
      expect(moverMovement(REAL, () => 0.99, 0.5, kind)).toBeNull();
    }
  });

  // Movement values the planner can build: a dart is one cell and its tilt keeps it coming down
  // the road, and an in-lane mover moves at another speed than the road.
  it("gives every obstacle a movement the planner can build", () => {
    for (const kind of OBSTACLE_KINDS) {
      const movement = movementOf(kind);
      if (movement?.kind === "dart") {
        expect(footprintOf(REAL, kind)).toEqual({ lanes: 1, rows: 1 });
        expect(movement.tilt.min).toBeLessThanOrEqual(movement.tilt.max);
        expect(movement.tilt.min).toBeGreaterThan(-1);
      } else if (movement?.kind === "inLane") {
        expect(movement.factor).toBeGreaterThan(0);
        expect(movement.factor).not.toBe(1);
      }
    }
  });

  // Each dart kind's outcome draw, over even steps from 0 up to 1, turns back and stops at its
  // kind's shares, so a kind with no stop share, such as the ball, never stops.
  it.each(
    OBSTACLE_KINDS.flatMap((kind) => {
      const movement = movementOf(kind);
      return movement?.kind === "dart" ? [{ kind, movement }] : [];
    }),
  )("turns back and stops a $kind at its kind's shares", ({ movement }) => {
    const steps = 1000;
    const outcomes = Array.from({ length: steps }, (_, i) =>
      dartOutcome(movement, (i + 0.5) / steps),
    );
    const share = (outcome: string) => outcomes.filter((drawn) => drawn === outcome).length / steps;
    expect(share("turn")).toBeCloseTo(movement.turnBackShare, 2);
    expect(share("stop")).toBeCloseTo(movement.stopShare, 2);
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
  // The data with the minor obstacles' counts changed as given.
  const withMinorCounts = (counts: Partial<Real["tuning"]["counts"]>, tuned: Real): Real => ({
    ...tuned,
    tuning: { ...tuned.tuning, counts: { ...tuned.tuning.counts, ...counts } },
  });
  // Every world, pack and zone of the passability check, each world's data as retune makes it.
  const passableCases = (retune: (tuned: Real) => Real = (tuned) => tuned) =>
    worlds.flatMap(({ tuned }, i) =>
      packs
        .slice(0, i === 1 ? 2 : 1)
        .flatMap(({ road, taller }) =>
          ZONE_IDS.map((zone) => ({ road, tuned: widerRows(retune(tuned), taller), zone })),
        ),
    );
  it("keeps every move passable in every zone, at the shares, at a share of 1 and hopping", () => {
    expectPassable(passableCases());
  });
  // Denser minor obstacles than the game's: the last zone's count rises by the gain for each
  // zone walked before it.
  it.each([
    { counts: { minorObstaclesGainPerZone: 1 } },
    { counts: { minorObstaclesGainPerZone: 2 } },
    { counts: { minorObstaclesGainPerZone: 3 } },
    { counts: { minorObstaclesFirstZone: 54, minorObstaclesGainPerZone: 2 } },
  ])("keeps every move passable with more minor obstacles: $counts", ({ counts }) => {
    expectPassable(passableCases((tuned) => withMinorCounts(counts, tuned)));
  });
  // Minor obstacle counts either side of the game's at which seed 1 plans a dart that leaves the
  // road while it meets the pack, with another obstacle beside it or soon after it in a lane next
  // to its own: the pack-fit gap holds for the lanes and stretch its hit box meets the pack in.
  it.each([
    { minorObstaclesFirstZone: 51, minorObstaclesGainPerZone: 0 },
    { minorObstaclesFirstZone: 54, minorObstaclesGainPerZone: 0 },
    { minorObstaclesFirstZone: 58, minorObstaclesGainPerZone: 1 },
  ])(
    "keeps every move passable with a dart leaving the road as it meets the pack: %o",
    (counts) => {
      expectPassable(passableCases((tuned) => withMinorCounts(counts, tuned)));
    },
  );
  function expectPassable(
    cases: readonly { road: RoadGeometry; tuned: Real; zone: ZoneId }[],
  ): void {
    for (const { road, tuned, zone } of cases) {
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
          const moving = { ...event, mover: event.mover };
          const touched = moverSpans(tuned, road, zone, moving);
          const { end, start } = moverContact(tuned, road, zone, moving);
          return {
            end: end - road.tallestPackBand,
            kind: event.kind,
            lanes: new Set(touched.map(({ lane }) => lane)),
            start,
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
  }

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
  // down, sideways only when it says so, as long as the tuning's hop within its jitter; across
  // zones and seeds, hoppers make hops of every length they can, and hop every count of times in
  // their range at the first zone's pace, the slowest; a later hop that would come once the
  // hopper has reached the pack's rows never does.
  it("hops each hopper its drawn count of times, any way or sideways only", () => {
    for (const { hop, tuned } of hopping) {
      const spots = new Set<number>();
      const times = new Set<number>();
      for (const [zone, zoneIndex] of ZONE_IDS.flatMap((id) =>
        [0, WORLD.walkLength - 1].map((index) => [id, index] as const),
      )) {
        const zoned = inZone(realRun(tuned, FASTEST_WALKER), zone, zoneIndex);
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
  let plans: readonly Planned[] | null = null;
  const plannedSpawns = () => {
    plans ??= ZONE_IDS.flatMap((zone) =>
      [0, WORLD.walkLength - 1].flatMap((zoneIndex) =>
        Array.from({ length: 10 }, (_, i) => i + 1).flatMap((seed) => {
          const zoned = inZone(realRun(everyMover, FASTEST_WALKER), zone, zoneIndex);
          const walk = planZone(everyMover, GAME_ROAD, plannerStreams(seed), {
            road: startRoad(LANE_COUNT),
            run: zoned,
          });
          const speed = walkScrollSpeed(everyMover, zoned);
          return walk.road.pending.map(({ kind, lane, mover }) => ({ kind, lane, mover, speed }));
        }),
      ),
    );
    return plans;
  };
  const plannedMovers = () =>
    plannedSpawns().flatMap(({ kind, mover, speed }) =>
      mover === undefined ? [] : [{ kind, mover, speed }],
    );
  it.each(counted)("moves each $kind within its range of times across seeds", ({ kind, range }) => {
    const { delays, lengths } = drawMover(plannerStreams(1));
    expect(range.max).toBeLessThanOrEqual(Math.min(delays.length, lengths.length));
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

  // A lucky find that walks about is planned as a prize, blocking no lane, and like every
  // stepper shows the wander mark before its first step alone.
  const walkingLucky = LUCKY_IDS.filter((kind) => movementOf(kind) !== null);
  it.each(walkingLucky)("plans a walking %s as a prize, cueing its first step only", (kind) => {
    expect(blocksLane(REAL, kind)).toBe(false);
    const paths = plannedMovers().filter((planned) => planned.kind === kind);
    expect(paths.length).toBeGreaterThan(0);
    for (const { mover } of paths) {
      const steps = mover.motion === "steps" ? mover.steps : [];
      expect(steps.length).toBeGreaterThan(0);
      expect(steps.map(({ uncued }) => uncued === true)).toEqual(steps.map((_, i) => i > 0));
      const cues = steps.map(({ at }) => moverTell(mover, at - 1e-6)?.kind ?? null);
      expect(cues).toEqual(steps.map((_, i) => (i === 0 ? "wander" : null)));
    }
  });

  // The friendly neighbor in the pack's lane as her row reaches the pack: showing her cue before
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
  ])("pays out the friendly neighbor $name, never as a bump", ({ moving, path }) => {
    const since = 532;
    expect(inMotion(path, since)).toBe(moving);
    const met = (item: WalkItem) => withHearts(1, walkWith(["koda"], [item]));
    const walk = met(moverAt("pettingNeighbor", path, since));
    const after = step(walk);
    const standing = step(met(atPack("pettingNeighbor")));
    expect(after.instants.map(({ encounter }) => encounter)).toEqual(["pettingNeighbor"]);
    expect(heartsByDog(after.walk.run)).not.toEqual(heartsByDog(walk.run));
    expect(after.walk.run).toEqual(standing.walk.run);
    expect(after.bumps).toEqual([]);
    expect(after.walk.run.bumpsByZone).toEqual([]);
    expect(after.cards).toEqual([]);
    expect(after.walk.road.hitStop).toBeNull();
    expect(after.walk.road.items).toEqual([]);
  });

  // Every obstacle kind that blocks a lane, moving or standing, starts against each edge of the
  // road on some seed: its leftmost lane is lane 0 on some plan and the last its width leaves on
  // another.
  const blocking = OBSTACLE_KINDS.filter((kind) => blocksLane(everyMover, kind));
  it.each(blocking)("starts a %s against each edge of the road on some seed", (kind) => {
    const lanes = new Set(
      plannedSpawns()
        .filter((planned) => planned.kind === kind)
        .map(({ lane }) => lane),
    );
    expect([...lanes]).toEqual(
      expect.arrayContaining([0, LANE_COUNT - footprintOf(everyMover, kind).lanes]),
    );
  });

  // A stalker wider than a lane never fits a lane to either side, so from a middle lane it
  // reaches one side only: left on some plans and right on others.
  const wideStalkers = OBSTACLE_KINDS.filter(
    (kind) => movementOf(kind)?.kind === "approach" && footprintOf(everyMover, kind).lanes > 1,
  );
  it.each(wideStalkers)("reaches a %s either way from a middle lane across seeds", (kind) => {
    const { lanes: width } = footprintOf(everyMover, kind);
    const ways = new Set<string>();
    for (const { mover } of plannedMovers().filter((planned) => planned.kind === kind)) {
      if (mover.motion !== "approach" || mover.lane < 1 || mover.lane > LANE_COUNT - width - 1) {
        continue;
      }
      if (mover.reach.first < mover.lane) {
        ways.add("left");
      }
      if (mover.reach.first + mover.reach.count - 1 > mover.lane) {
        ways.add("right");
      }
    }
    expect([...ways].sort()).toEqual(["left", "right"]);
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
      const factors = plannedMovers().flatMap(({ mover, speed }) => {
        if (mover.movement !== movement) {
          return [];
        }
        const lengths =
          mover.motion === "approach" || mover.motion === "shy"
            ? mover.lengths
            : mover.motion === "steps"
              ? mover.steps.map(({ length }) => length)
              : [];
        return lengths.map((length) => length / (moveSeconds * speed));
      });
      expect(factors.length).toBeGreaterThan(0);
      expect(Math.min(...factors)).toBeGreaterThanOrEqual(1 - jitter - 1e-9);
      expect(Math.max(...factors)).toBeLessThanOrEqual(1 + jitter + 1e-9);
      expect(Math.min(...factors)).toBeLessThan(1);
      expect(Math.max(...factors)).toBeGreaterThan(1);
    },
  );

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
