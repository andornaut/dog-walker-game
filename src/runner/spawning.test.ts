import { describe, expect, it } from "vitest";

import { itemAt } from "../lib/arrays";
import { laneChangesBehind, lanesReachedAtEnd } from "../testing/avoidable";
import { plannerStreams } from "../testing/movers";
import { type MoverPath, moverPlace, type MoverSpec, sweptLanes } from "./movers";
import {
  blockingLength,
  everyLaneReaches,
  type Footprint,
  hitLength,
  type LaneReach,
  laneReach,
  moverMayTake,
  moverRests,
  packFitsBetween,
  packGap,
  planSpawns,
  rowSpacing,
  type SpawnEvent,
  type SpawnPlan,
  spawnRowDistances,
  takeDueSpawns,
} from "./spawning";

// A set of lanes as a bit mask: bit n set means lane n is in it.
function laneMask(lanes: readonly number[]): number {
  return lanes.reduce((mask, lane) => mask | (1 << lane), 0);
}

type Kind = "bench" | "car" | "cat" | "hedge" | "neighbor" | "obstacle" | "skunk" | "tip" | "treat";

// 9 rows at 100..900, 5 lanes. A one-row hit box is 30 - 2 x 5 = 20px; with the 30px pack a
// row's window is 50px, leaving 50px of clear road between rows: at 100px/s that is 0.5s,
// time for a 0.05s step and 4 moves of 0.1s, so the pack can reach any lane from any row. No cap
// on rows that come on screen quiet, unless a test sets one.
const plan: SpawnPlan<Kind> = {
  cellInset: 5,
  cellLength: 30,
  laneCount: 5,
  laneInset: 5,
  laneMoveSeconds: 0.1,
  maxEmptyRows: Number.POSITIVE_INFINITY,
  minOpenLanes: 1,
  minSpacing: 100,
  moverCaps: { darts: 1, slowVehicles: 1, total: 3 },
  packHitLength: 30,
  packLength: 30,
  quotas: [
    { blocksLane: true, count: 6, kind: "obstacle" },
    { blocksLane: false, count: 9, kind: "tip" },
    { blocksLane: false, count: 3, kind: "treat" },
  ],
  reactionSeconds: 0,
  roadLength: 1100,
  scrollSpeed: 100,
  sightLength: 1000,
  stepSeconds: 0.05,
  zoneLength: 1000,
};

// A 70px window leaves 0.3s between rows, which fits a step and one 0.25s move; the 1s into the
// first row fits a step and three.
const tight: SpawnPlan<Kind> = {
  ...plan,
  laneMoveSeconds: 0.25,
  packHitLength: 50,
  packLength: 50,
  quotas: [
    { blocksLane: true, count: 27, kind: "obstacle" },
    { blocksLane: false, count: 9, kind: "tip" },
  ],
};

const FOOTPRINTS = {
  bench: { lanes: 2, rows: 1 },
  car: { lanes: 1, rows: 3 },
  hedge: { lanes: 3, rows: 1 },
  skunk: { lanes: 2, rows: 2 },
} satisfies Partial<Record<Kind, Footprint>>;
const footprintOf = (kind: Kind): Footprint =>
  (FOOTPRINTS as Partial<Record<Kind, Footprint>>)[kind] ?? { lanes: 1, rows: 1 };

// Footprints over several lanes and rows, two lanes always open, at a tight one-lane reach.
const shaped: SpawnPlan<Kind> = {
  ...tight,
  minOpenLanes: 2,
  quotas: [
    { blocksLane: true, count: 3, footprint: FOOTPRINTS.hedge, kind: "hedge" },
    { blocksLane: true, count: 2, footprint: FOOTPRINTS.car, kind: "car" },
    { blocksLane: true, count: 2, footprint: FOOTPRINTS.skunk, kind: "skunk" },
    { blocksLane: true, count: 3, footprint: FOOTPRINTS.bench, kind: "bench" },
    { blocksLane: true, count: 4, kind: "obstacle" },
    { blocksLane: false, count: 9, kind: "tip" },
  ],
  zoneLength: 2000,
};

// Obstacles one to three lanes wide at tight's reach, where a 0.25s lane move lasts five 0.05s
// steps, 25px, and a 0.1s reaction margin is 10px: the 80px between neighbouring rows' hit boxes
// is less than the 50px pack, a lane move and the margin.
const reacting: SpawnPlan<Kind> = {
  ...shaped,
  quotas: [
    { blocksLane: true, count: 4, footprint: FOOTPRINTS.hedge, kind: "hedge" },
    { blocksLane: true, count: 2, footprint: FOOTPRINTS.skunk, kind: "skunk" },
    { blocksLane: true, count: 4, footprint: FOOTPRINTS.bench, kind: "bench" },
    { blocksLane: true, count: 10, kind: "obstacle" },
    { blocksLane: false, count: 9, kind: "tip" },
  ],
  reactionSeconds: 0.1,
  zoneLength: 3000,
};

const blocking = (event: SpawnEvent<Kind>) =>
  event.kind !== "neighbor" && event.kind !== "tip" && event.kind !== "treat";

// A prize that moves, as the friendly neighbor does: 1 or 2 steps, a lane to either side then a
// row down the road.
const STROLLING: MoverSpec = {
  footprint: { lanes: 1, rows: 1 },
  motion: {
    count: { max: 2, min: 1 },
    kind: "steps",
    sequences: [-1, 1].flatMap((lanes) => [
      [{ lanes, travel: 0 }],
      [
        { lanes, travel: 0 },
        { lanes: 0, travel: 1 },
      ],
    ]),
    stepSeconds: 0.1,
  },
  movement: "step",
  variation: { delaySeconds: 0, lengthShare: 0, speedShare: 0 },
  warningSeconds: 0.2,
};

// A dart straight across the road at a lane a second, so most meet the pack: one that does holds
// every lane of its own row and, as its lead-in, of the row before.
const DARTING: MoverSpec = {
  footprint: { lanes: 1, rows: 1 },
  motion: {
    kind: "cross",
    lanesPerSecond: 1,
    reactionSeconds: 0.5,
    startRoadShare: [0.1, 0.9],
    stopLanes: { max: 4, min: 2 },
    stopShare: 0,
    tilt: [0, 0],
    turnAtShare: [0.5, 1],
    turnBackShare: 0,
  },
  movement: "dart",
  variation: { delaySeconds: 0, lengthShare: 0, speedShare: 0 },
  warningSeconds: 0.2,
};

// The lanes no lane-blocking spawn overlaps in each row's window.
function openLanesByRow(spawnPlan: SpawnPlan<Kind>, events: SpawnEvent<Kind>[]): number[][] {
  const window = blockingLength(spawnPlan, 1);
  return spawnRowDistances(rowSpacing(spawnPlan), spawnPlan.zoneLength).map((distance) => {
    const blocked = events.filter(blocking).flatMap((event) => {
      const { lanes, rows } = footprintOf(event.kind);
      const overlaps =
        event.distance < distance + window &&
        distance < event.distance + blockingLength(spawnPlan, rows);
      return overlaps ? Array.from({ length: lanes }, (_, i) => event.lane + i) : [];
    });
    return [0, 1, 2, 3, 4].filter((lane) => !blocked.includes(lane));
  });
}

const spansOf = (spawnPlan: SpawnPlan<Kind>, events: SpawnEvent<Kind>[]) =>
  events.filter(blocking).map((event) => {
    const { lanes, rows } = footprintOf(event.kind);
    return {
      distance: event.distance,
      lane: event.lane,
      laneSpan: lanes,
      length: hitLength(spawnPlan, rows) + spawnPlan.packLength,
    };
  });

const seeds = Array.from({ length: 50 }, (_, i) => i + 1);
const countOf = (kind: Kind, events: { kind: Kind }[]) =>
  events.filter((event) => event.kind === kind).length;

describe("spawnRowDistances", () => {
  it("spaces rows minSpacing apart, clear of both ends of the zone by at least minSpacing", () => {
    expect(spawnRowDistances(100, 1000)).toEqual([100, 200, 300, 400, 500, 600, 700, 800, 900]);
    expect(spawnRowDistances(100, 1050).at(-1)).toBe(900);
    expect(spawnRowDistances(100, 150)).toEqual([]);
    expect(spawnRowDistances(100, 50)).toEqual([]);
  });

  it("rejects a spacing that is not positive", () => {
    expect(() => spawnRowDistances(0, 1000)).toThrow("minSpacing must be positive");
  });
});

describe("packFitsBetween", () => {
  // A car three rows long in lane 1; road starts showing behind it at its hit box's far edge.
  const car = { distance: 0, lane: 1, lanes: 1, length: hitLength(plan, 3) };
  const behind = car.length;
  it("fits a pack between two obstacles only with a pack gap of road, or a lane apart", () => {
    for (const { far, fits } of [
      {
        far: { distance: behind + packGap(plan, 1) - 1, lane: 2, lanes: 1 },
        fits: false,
        name: "a pack gap less a pixel beside it",
      },
      {
        far: { distance: behind + packGap(plan, 1), lane: 2, lanes: 1 },
        fits: true,
        name: "a pack gap beside it",
      },
      {
        far: { distance: behind, lane: 2, lanes: 1 },
        fits: true,
        name: "touching it, with no road between",
      },
      { far: { distance: behind + 1, lane: 3, lanes: 1 }, fits: true, name: "a lane away" },
      { far: { distance: behind + 1, lane: 1, lanes: 1 }, fits: true, name: "in its lane" },
      {
        far: { distance: behind + 1, lane: 1, lanes: 2 },
        fits: false,
        name: "over its lane and the one beside, a pixel behind it",
      },
    ] satisfies readonly {
      far: { distance: number; lane: number; lanes: number };
      fits: boolean;
      name: string;
    }[]) {
      const other = { ...far, length: hitLength(plan, 1) };
      expect(packFitsBetween(plan, car, other)).toBe(fits);
      expect(packFitsBetween(plan, other, car)).toBe(fits);
    }
  });

  // A mover faster than the road is in contact with the pack for less than the pack's length,
  // so road shows behind it while the obstacle met with it still passes.
  it("fits a pack beside a standing obstacle met at once, not a mover passing faster than the road", () => {
    for (const { fits, length } of [
      { fits: true, length: hitLength(plan, 1), name: "a standing obstacle" },
      { fits: false, length: -1, name: "a mover passing faster than the road" },
    ] satisfies readonly { fits: boolean; length: number; name: string }[]) {
      const beside = { distance: 0, lane: 2, lanes: 1, length };
      expect(packFitsBetween(plan, car, beside)).toBe(fits);
      expect(packFitsBetween(plan, beside, car)).toBe(fits);
    }
  });
});

describe("packGap and packFitsBetween over wide obstacles", () => {
  // At 100px/s a 0.1s lane move lasts two 0.05s steps, 10px, and a 0.2s reaction margin is 20px.
  const margined = { ...plan, reactionSeconds: 0.2 };
  it("is the pack, its lane moves and the reaction margin", () => {
    for (const { changes, gap } of [
      { changes: 1, gap: 30 + 10 + 20 },
      { changes: 3, gap: 30 + 3 * 10 + 20 },
    ]) {
      expect(packGap(margined, changes)).toBeCloseTo(gap, 9);
    }
  });

  // A pack beside the nearer obstacle in a lane the farther one blocks steps in behind the
  // nearer one, and on to the nearest lane the farther one leaves open.
  it("leaves room for every lane change between wide obstacles", () => {
    for (const { changes, far, near } of [
      { changes: 1, far: { lane: 3, lanes: 1 }, name: "0-2, then 3", near: { lane: 0, lanes: 3 } },
      {
        changes: 2,
        far: { lane: 2, lanes: 3 },
        name: "0-2, then 2-4",
        near: { lane: 0, lanes: 3 },
      },
      {
        changes: 3,
        far: { lane: 0, lanes: 3 },
        name: "1-3, then 0-2",
        near: { lane: 1, lanes: 3 },
      },
      {
        changes: 2,
        far: { lane: 0, lanes: 2 },
        name: "1-3, then 0-1",
        near: { lane: 1, lanes: 3 },
      },
    ]) {
      const nearer = { ...near, distance: 0, length: hitLength(plan, 1) };
      const at = (gap: number) => ({
        ...far,
        distance: nearer.length + gap,
        length: nearer.length,
      });
      for (const [a, b] of [
        [nearer, at(packGap(margined, changes) - 1)],
        [at(packGap(margined, changes) - 1), nearer],
      ] as const) {
        expect(packFitsBetween(margined, a, b)).toBe(false);
      }
      expect(packFitsBetween(margined, nearer, at(packGap(margined, changes)))).toBe(true);
    }
  });
});

describe("planSpawns", () => {
  it("spawns exactly the count of each kind, sorted by distance", () => {
    const events = planSpawns(plannerStreams(1), plan);
    expect(countOf("obstacle", events)).toBe(6);
    expect(countOf("tip", events)).toBe(9);
    expect(countOf("treat", events)).toBe(3);
    const distances = events.map((event) => event.distance);
    expect(distances).toEqual([...distances].sort((a, b) => a - b));
  });

  it("puts every spawn on a row and in a lane, one spawn per cell", () => {
    const rows = spawnRowDistances(100, 1000);
    for (const seed of seeds) {
      const events = planSpawns(plannerStreams(seed), plan);
      const cells = new Set(events.map(({ distance, lane }) => `${distance}:${lane}`));
      expect(cells.size).toBe(events.length);
      for (const { distance, lane } of events) {
        expect(rows).toContain(distance);
        expect(lane).toBeGreaterThanOrEqual(0);
        expect(lane).toBeLessThan(5);
      }
    }
  });

  it("repeats the same plan for the same seed and varies with the seed", () => {
    expect(planSpawns(plannerStreams(9), plan)).toEqual(planSpawns(plannerStreams(9), plan));
    expect(planSpawns(plannerStreams(9), plan)).not.toEqual(planSpawns(plannerStreams(10), plan));
  });

  it("never blocks every lane on a row, even when obstacles fill all the room they may", () => {
    const crowded: SpawnPlan<Kind> = {
      ...plan,
      quotas: [
        { blocksLane: true, count: 9 * 4, kind: "obstacle" },
        { blocksLane: false, count: 9, kind: "tip" },
      ],
    };
    for (const seed of seeds) {
      const events = planSpawns(plannerStreams(seed), crowded);
      for (const row of spawnRowDistances(100, 1000)) {
        const onRow = events.filter((event) => event.distance === row);
        expect(countOf("obstacle", onRow)).toBe(4);
        expect(countOf("tip", onRow)).toBe(1);
      }
    }
  });

  it("keeps minOpenLanes open on every row", () => {
    const crowded: SpawnPlan<Kind> = {
      ...plan,
      minOpenLanes: 2,
      quotas: [{ blocksLane: true, count: 9 * 3, kind: "obstacle" }],
    };
    for (const seed of seeds.slice(0, 10)) {
      const open = openLanesByRow(crowded, planSpawns(plannerStreams(seed), crowded));
      expect(open.every((lanes) => lanes.length === 2)).toBe(true);
    }
  });

  // 29 rows, with one-cell obstacles each in view as its row comes on screen: placed one per
  // stretch at random, some stretches run quiet for longer than the cap, with room to move
  // obstacles into them.
  const sparse = (obstacles: number): SpawnPlan<Kind> => ({
    ...plan,
    quotas: [
      { blocksLane: true, count: obstacles, kind: "obstacle" },
      { blocksLane: false, count: 9, kind: "tip" },
    ],
    zoneLength: 3000,
  });
  const longestQuiet = (events: SpawnEvent<Kind>[]) => {
    const filled = new Set(events.filter(blocking).map(({ distance }) => distance));
    let [longest, run] = [0, 0];
    for (const row of spawnRowDistances(plan.minSpacing, 3000)) {
      run = filled.has(row) ? 0 : run + 1;
      longest = Math.max(longest, run);
    }
    return longest;
  };
  it.each([
    { maxEmptyRows: 3, obstacles: 10 },
    { maxEmptyRows: 4, obstacles: 7 },
  ])(
    "moves $obstacles obstacles into every run of more than $maxEmptyRows quiet rows, adding none",
    ({ maxEmptyRows, obstacles }) => {
      const uncapped = seeds
        .slice(0, 10)
        .map((seed) => planSpawns(plannerStreams(seed), sparse(obstacles)));
      expect(Math.max(...uncapped.map(longestQuiet))).toBeGreaterThan(maxEmptyRows);
      for (const seed of seeds.slice(0, 10)) {
        const events = planSpawns(plannerStreams(seed), { ...sparse(obstacles), maxEmptyRows });
        expect(longestQuiet(events), `seed ${seed}`).toBeLessThanOrEqual(maxEmptyRows);
        expect(countOf("obstacle", events)).toBe(obstacles);
        expect(countOf("tip", events)).toBe(9);
      }
    },
  );

  // 9 rows of 5 lanes, each keeping minOpenLanes open.
  it("places as many as fit and skips the rest, given more than fit", () => {
    for (const { minOpenLanes } of [
      { minOpenLanes: 1, name: "more obstacles than the rows have room for" },
      { minOpenLanes: 2, name: "obstacles that would leave fewer than minOpenLanes open" },
    ]) {
      const room = 9 * (5 - minOpenLanes);
      const crowded: SpawnPlan<Kind> = {
        ...plan,
        minOpenLanes,
        quotas: [{ blocksLane: true, count: room + 1, kind: "obstacle" }],
      };
      for (const seed of seeds.slice(0, 10)) {
        const events = planSpawns(plannerStreams(seed), crowded);
        expect(countOf("obstacle", events)).toBe(room);
        expect(openLanesByRow(crowded, events).every((lanes) => lanes.length >= minOpenLanes)).toBe(
          true,
        );
      }
    }
  });

  it("throws when the rows cannot be planned", () => {
    for (const { error, unplannable } of [
      {
        error: /apart/,
        name: "the rows, with no lane move to space them, are too close for the pack to pass between them",
        unplannable: { ...plan, laneMoveSeconds: 0, packLength: 81 },
      },
      {
        error: /sight/,
        name: "the next row is out of sight before the pack must steer for it",
        unplannable: { ...plan, sightLength: 49 },
      },
    ] satisfies readonly { error: RegExp; name: string; unplannable: SpawnPlan<Kind> }[]) {
      expect(() => planSpawns(plannerStreams(1), unplannable)).toThrow(error);
    }
  });

  it("skips an obstacle bigger than one cell that has no room left, the same way every time", () => {
    const tooBig: SpawnPlan<Kind> = {
      ...plan,
      quotas: [
        { blocksLane: true, count: 40, footprint: { lanes: 3, rows: 1 }, kind: "obstacle" },
        { blocksLane: false, count: 9, kind: "tip" },
      ],
    };
    const events = planSpawns(plannerStreams(1), tooBig);
    expect(countOf("obstacle", events)).toBeGreaterThan(0);
    expect(countOf("obstacle", events)).toBeLessThan(40);
    expect(countOf("tip", events)).toBe(9);
    expect(planSpawns(plannerStreams(1), tooBig)).toEqual(events);
  });

  it("skips a bigger obstacle that would leave too few cells for the one-cell spawns", () => {
    // 9 rows of 5 lanes: 30 tips leave 15 cells for benches two cells wide.
    const crowded: SpawnPlan<Kind> = {
      ...plan,
      quotas: [
        { blocksLane: true, count: 20, footprint: FOOTPRINTS.bench, kind: "bench" },
        { blocksLane: false, count: 30, kind: "tip" },
      ],
    };
    for (const seed of seeds.slice(0, 10)) {
      const events = planSpawns(plannerStreams(seed), crowded);
      expect(countOf("tip", events)).toBe(30);
      expect(countOf("bench", events)).toBeGreaterThan(0);
      expect(countOf("bench", events)).toBeLessThanOrEqual(7);
    }
  });

  it("frees a one-cell spawn's kept cell once it is placed, for the bigger obstacles after it", () => {
    // 9 rows of 5 lanes: 30 treats placed first leave 15 cells, all free for benches.
    const placedFirst: SpawnPlan<Kind> = {
      ...plan,
      quotas: [
        { blocksLane: true, count: 20, footprint: FOOTPRINTS.bench, kind: "bench" },
        { blocksLane: false, count: 30, first: true, kind: "treat" },
      ],
    };
    for (const seed of seeds.slice(0, 10)) {
      const events = planSpawns(plannerStreams(seed), placedFirst);
      expect(countOf("treat", events)).toBe(30);
      expect(countOf("bench", events)).toBeGreaterThan(0);
    }
  });

  it("places every obstacle at a tight reach, an open lane within a move of each on the row before", () => {
    for (const seed of seeds) {
      const events = planSpawns(plannerStreams(seed), tight);
      expect(countOf("obstacle", events)).toBe(27);
      const open = openLanesByRow(tight, events);
      open.slice(1).forEach((lanes, i) => {
        for (const from of itemAt(open, i)) {
          expect(lanes.some((lane) => Math.abs(lane - from) <= 1)).toBe(true);
        }
      });
    }
  });

  // Eight wide footprints with a row between each leave 19 rows too few for every one at times,
  // so a hedge or a bench may be skipped; the one-cell obstacles never are, and the hedges, three
  // lanes wide at a one-lane reach, fit after rows with no obstacle, which the pack steers across.
  it("keeps a footprint on the road, its cells to itself, and two lanes open", () => {
    const kinds = new Set<Kind>();
    for (const seed of seeds) {
      const events = planSpawns(plannerStreams(seed), shaped);
      expect(countOf("obstacle", events)).toBe(4);
      expect(events.filter(blocking).length).toBeGreaterThanOrEqual(12);
      events.filter(blocking).forEach(({ kind }) => kinds.add(kind));
      for (const event of events) {
        expect(event.lane + footprintOf(event.kind).lanes).toBeLessThanOrEqual(5);
      }
      for (const lanes of openLanesByRow(shaped, events)) {
        expect(lanes.length).toBeGreaterThanOrEqual(2);
      }
      const tips = events.filter((event) => event.kind === "tip");
      const open = openLanesByRow(shaped, events);
      const rows = spawnRowDistances(100, 2000);
      for (const tip of tips) {
        expect(itemAt(open, rows.indexOf(tip.distance))).toContain(tip.lane);
      }
    }
    expect([...kinds].sort()).toEqual(["bench", "car", "hedge", "obstacle", "skunk"]);
  });

  it("leaves a way through footprints over several lanes and rows, from any lane", () => {
    for (const seed of seeds) {
      const spans = spansOf(shaped, planSpawns(plannerStreams(seed), shaped));
      for (const start of [0, 1, 2, 3, 4]) {
        expect(lanesReachedAtEnd(shaped, spans, start)).not.toEqual([]);
      }
    }
  });

  it("ends a footprint more than one row long within the zone's last row", () => {
    const cars: SpawnPlan<Kind> = {
      ...shaped,
      quotas: [{ blocksLane: true, count: 12, footprint: FOOTPRINTS.car, kind: "car" }],
    };
    for (const seed of seeds.slice(0, 10)) {
      for (const event of planSpawns(plannerStreams(seed), cars)) {
        expect(event.distance + blockingLength(cars, 3)).toBeLessThanOrEqual(1900 + 70);
      }
    }
  });

  // Every pair of obstacles, checked apart from the planner: where a way out of a lane the
  // farther one blocks steps in behind the nearer one, the road between their hit boxes fits the
  // 50px pack, 25px per lane change and the 10px margin; wide ones are two rows apart or more.
  it("spaces obstacles for lane changes between them, for any seed", () => {
    for (const seed of seeds.slice(0, 5)) {
      const events = planSpawns(plannerStreams(seed), reacting).filter(blocking);
      const lanesOf = (event: SpawnEvent<Kind>) =>
        new Set(Array.from({ length: footprintOf(event.kind).lanes }, (_, i) => event.lane + i));
      expect(events.filter((event) => footprintOf(event.kind).lanes > 1).length).toBeGreaterThan(4);
      events.forEach((near, i) => {
        for (const far of events.slice(i + 1)) {
          const gap = far.distance - near.distance - (30 * footprintOf(near.kind).rows - 10);
          const changes = laneChangesBehind(5, lanesOf(near), lanesOf(far));
          if (changes > 0 && gap > 0) {
            expect(gap).toBeGreaterThanOrEqual(50 + 25 * changes + 10);
          }
          if (footprintOf(near.kind).lanes > 1 && footprintOf(far.kind).lanes > 1) {
            expect(far.distance - near.distance).toBeGreaterThanOrEqual(2 * 100);
          }
        }
      });
    }
  });

  // A moving prize is placed after every spawn the pack steers around, which it leaves where they
  // were, and blocks no lane itself. A long zone gives it room to move; a zone shorter than the
  // road has none, so it stands still. Either way none is skipped.
  it.each([
    { moves: 3, name: "a long zone", zoneLength: 6000 },
    { moves: 0, name: "a zone shorter than the road", zoneLength: 1000 },
  ])(
    "places every moving prize in $name, leaving the rest as they were",
    ({ moves, zoneLength }) => {
      const without: SpawnPlan<Kind> = { ...plan, zoneLength };
      const prize = { blocksLane: false, count: 3, kind: "neighbor", mover: STROLLING } as const;
      const withPrizes: SpawnPlan<Kind> = { ...without, quotas: [...without.quotas, prize] };
      for (const seed of seeds) {
        const events = planSpawns(plannerStreams(seed), withPrizes);
        const prizes = events.filter(({ kind }) => kind === "neighbor");
        expect(prizes).toHaveLength(prize.count);
        expect(prizes.filter(({ mover }) => mover !== undefined)).toHaveLength(moves);
        expect(events.filter(blocking)).toEqual(
          planSpawns(plannerStreams(seed), without).filter(blocking),
        );
      }
    },
  );

  // Cards (obstacles marked first) are placed before the darts, and benches and tips after. A dart
  // sets off over a card's cell, never with a card in its lead-in row; a bench placed after it may
  // take its row but never its lead-in row; no tip is in a row it holds; and the pack has a way
  // past every card, dart and bench from any lane. A straight dart's row is where it sets off, its
  // cue's lead less its cue.
  it.each([
    { cards: 8, minOpenLanes: 2 },
    { cards: 14, minOpenLanes: 1 },
  ])(
    "lets a dart set off over $cards cards' cells, and a later bench take its own outside its lead-in",
    ({ cards, minOpenLanes }) => {
      const darting: SpawnPlan<Kind> = {
        ...shaped,
        minOpenLanes,
        quotas: [
          { blocksLane: true, count: cards, first: true, kind: "obstacle" },
          { blocksLane: true, count: 4, kind: "cat", mover: DARTING },
          { blocksLane: true, count: 3, footprint: FOOTPRINTS.bench, kind: "bench" },
          { blocksLane: false, count: 9, kind: "tip" },
        ],
        zoneLength: 3000,
      };
      const spacing = rowSpacing(darting);
      const window = blockingLength(darting, 1);
      let shared = 0;
      let benchShared = 0;
      for (const seed of seeds.slice(0, 20)) {
        const events = planSpawns(plannerStreams(seed), darting);
        const darts = events.flatMap(({ distance, mover }) => {
          if (mover?.motion !== "cross") {
            return [];
          }
          const row = distance - mover.enterTravel + mover.warning;
          const lanes = sweptLanes(5, mover, darting.sightLength, darting.sightLength + window);
          return [{ lanes, row }];
        });
        expect(darts.length).toBeGreaterThan(0);
        const at = (row: number, kinds: readonly Kind[]) =>
          events.filter(({ distance, kind }) => distance === row && kinds.includes(kind));
        for (const { lanes, row } of darts) {
          const leadIn = lanes.count > 0 ? [row - spacing] : [];
          shared += at(row, ["obstacle"]).length;
          benchShared += at(row, ["bench"]).length;
          for (const held of [row, ...leadIn]) {
            expect(at(held, ["tip"]), `seed ${seed}`).toEqual([]);
          }
          for (const held of leadIn) {
            expect(at(held, ["obstacle", "bench"]), `seed ${seed}`).toEqual([]);
          }
        }
        const spans = [
          ...spansOf(
            darting,
            events.filter(({ kind }) => kind !== "cat"),
          ),
          ...darts.map(({ lanes, row }) => ({
            distance: row,
            lane: lanes.first,
            laneSpan: lanes.count,
            length: window,
          })),
        ];
        for (const start of [0, 1, 2, 3, 4]) {
          expect(lanesReachedAtEnd(darting, spans, start), `seed ${seed}`).not.toEqual([]);
        }
      }
      expect(shared).toBeGreaterThan(0);
      expect(benchShared).toBeGreaterThan(0);
    },
  );

  // A rider holds every row it passes on screen, from the rows its near end comes level with to
  // the ones its far end does. A standing obstacle placed after it may stand in its lane on one of
  // those rows where its hit box shares no road with the rider's at any moment both are on the
  // road: below the rows a fast rider reaches, as it leaves the road's bottom first, and above the
  // rows a slow one reaches, as the road brings them only once it has gone.
  it.each([
    { name: "a fast rider", rowsAfter: -1, speedMultiplier: 2 },
    { name: "a slow rider", rowsAfter: 2, speedMultiplier: 0.5 },
  ])(
    "stands an obstacle in $name's lane $rowsAfter rows from its own, never on it",
    ({ rowsAfter, speedMultiplier }) => {
      const riding: SpawnPlan<Kind> = {
        ...plan,
        minOpenLanes: 2,
        quotas: [
          {
            blocksLane: true,
            count: 6,
            kind: "car",
            mover: { ...DARTING, motion: { kind: "ride", speedMultiplier }, movement: "inLane" },
          },
          { blocksLane: true, count: 20, kind: "obstacle" },
        ],
        zoneLength: 4000,
      };
      const spacing = rowSpacing(riding);
      const height = hitLength(riding, 1);
      let beside = 0;
      for (const seed of seeds.slice(0, 20)) {
        const events = planSpawns(plannerStreams(seed), riding);
        const riders = events.flatMap(({ distance, mover }) =>
          mover?.motion === "ride" ? [{ distance, mover }] : [],
        );
        expect(riders.length).toBeGreaterThan(0);
        for (const { distance, mover } of riders) {
          const row = distance + mover.warning - riding.sightLength * (1 - 1 / speedMultiplier);
          for (const obstacle of events.filter(({ kind }) => kind === "obstacle")) {
            if (obstacle.lane !== mover.lane) {
              continue;
            }
            beside += Math.abs(obstacle.distance - (row + rowsAfter * spacing)) < 1e-6 ? 1 : 0;
            // Both hit boxes run up the road from their near edges, which come down the road
            // with the scroll: the obstacle's with the road, the rider's at its own speed.
            const life = mover.warning + (riding.roadLength + height) / speedMultiplier;
            for (let since = 0; since <= life; since += 1) {
              const own = distance + since - obstacle.distance;
              const place = moverPlace(5, mover, since);
              const onRoad = (travel: number) => travel > 0 && travel - height < riding.roadLength;
              if (!place.solid || !onRoad(own) || !onRoad(place.travel)) {
                continue;
              }
              expect(Math.abs(own - place.travel), `seed ${seed}`).toBeGreaterThanOrEqual(height);
            }
          }
        }
      }
      expect(beside).toBeGreaterThan(0);
    },
  );

  // A rider passes through its own row in its lane, as it reaches the pack just as the row does,
  // and never stops there. A tip a mover may pass over may lie on that cell; any other keeps off
  // every cell a mover passes through.
  it.each([
    { moversPassOver: true, onPath: true },
    { moversPassOver: false, onPath: false },
  ])(
    "lays a tip marked moversPassOver $moversPassOver on a rider's path: $onPath",
    ({ moversPassOver, onPath }) => {
      const riding: SpawnPlan<Kind> = {
        ...plan,
        quotas: [
          {
            blocksLane: true,
            count: 4,
            kind: "car",
            mover: { ...DARTING, motion: { kind: "ride", speedMultiplier: 2 }, movement: "inLane" },
          },
          { blocksLane: false, count: 60, kind: "tip", moversPassOver },
        ],
        zoneLength: 4000,
      };
      let onRiders = 0;
      for (const seed of seeds.slice(0, 20)) {
        const events = planSpawns(plannerStreams(seed), riding);
        for (const { distance, mover } of events) {
          if (mover?.motion !== "ride") {
            continue;
          }
          const row = distance + mover.warning - riding.sightLength / 2;
          onRiders += events.filter(
            (tip) =>
              tip.kind === "tip" && tip.lane === mover.lane && Math.abs(tip.distance - row) < 1e-6,
          ).length;
        }
      }
      expect(onRiders > 0).toBe(onPath);
    },
  );

  // Twenty wide footprints with a row between each never all fit in 19 rows: the hedges and the
  // benches take turns along the zone, so neither kind takes the room first.
  it("keeps each standing kind's share of what is placed when room runs short", () => {
    const crowded: SpawnPlan<Kind> = {
      ...shaped,
      quotas: [
        { blocksLane: true, count: 10, footprint: FOOTPRINTS.hedge, kind: "hedge" },
        { blocksLane: true, count: 10, footprint: FOOTPRINTS.bench, kind: "bench" },
      ],
    };
    const placed = seeds.map((seed) => planSpawns(plannerStreams(seed), crowded));
    const total = (kind: Kind) => placed.reduce((sum, events) => sum + countOf(kind, events), 0);
    expect(total("hedge") + total("bench")).toBeLessThan(20 * seeds.length);
    for (const kind of ["hedge", "bench"] as const) {
      expect(total(kind) / (total("hedge") + total("bench"))).toBeGreaterThan(0.4);
    }
  });

  it("spreads each kind over the zone, one per equal stretch of rows", () => {
    // 3 treats over 9 rows: one in rows 100-300, one in 400-600, one in 700-900.
    for (const seed of seeds) {
      const treats = planSpawns(plannerStreams(seed), plan).filter((e) => e.kind === "treat");
      expect(treats.map(({ distance }) => Math.floor((distance - 100) / 300))).toEqual([0, 1, 2]);
    }
  });
});

describe("laneReach and rowSpacing", () => {
  // tight's 70px window leaves 30px between rows 100px apart. A move lasts whole 0.05s steps,
  // and needs a step to spare.
  it("spaces rows for a lane move between them", () => {
    for (const { reach, spaced, spacing } of [
      {
        name: "a step and a move fit",
        reach: { betweenRows: 1, entry: 3 },
        spaced: tight,
        spacing: 100,
      },
      {
        name: "52px between rows fits two 25px moves but not their step to spare",
        reach: { betweenRows: 1, entry: 3 },
        spaced: { ...tight, packHitLength: 28, packLength: 28 },
        spacing: 100,
      },
      {
        name: "a 0.26s move lasts six steps, 30px",
        reach: { betweenRows: 1, entry: 3 },
        spaced: { ...tight, laneMoveSeconds: 0.26 },
        spacing: 105,
      },
      {
        name: "at 200px/s a 10px step and a 50px move need 60px",
        reach: { betweenRows: 1, entry: 2 },
        spaced: { ...tight, scrollSpeed: 200 },
        spacing: 130,
      },
      {
        name: "a hit box 30px longer than its row widens a 120px window's rows past minSpacing",
        reach: { betweenRows: 1, entry: 4 },
        spaced: { ...tight, cellInset: -20 },
        spacing: 150,
      },
      // Never further than the road is wide.
      {
        name: "an instant move reaches every lane",
        reach: { betweenRows: 4, entry: 4 },
        spaced: { ...plan, laneMoveSeconds: 0 },
        spacing: 100,
      },
    ] satisfies readonly {
      name: string;
      reach: LaneReach;
      spaced: SpawnPlan<Kind>;
      spacing: number;
    }[]) {
      expect(rowSpacing(spaced)).toBe(spacing);
      expect(laneReach(spaced)).toEqual(reach);
    }
  });

  it("plans the spawns on rows that far apart", () => {
    const fast = { ...tight, quotas: plan.quotas, scrollSpeed: 200 };
    const distances = planSpawns(plannerStreams(1), fast).map(({ distance }) => distance);
    expect(distances.length).toBeGreaterThan(0);
    expect(distances.every((distance) => distance % rowSpacing(fast) === 0)).toBe(true);
  });
});

describe("everyLaneReaches", () => {
  const notLane1 = ~laneMask([1]);

  it("tells whether every lane has a target within reach", () => {
    for (const { clear, from, reach, reaches, to } of [
      {
        clear: -1,
        from: [0, 2],
        name: "every lane has a target within reach",
        reach: 1,
        reaches: true,
        to: [1],
      },
      {
        clear: -1,
        from: [0, 4],
        name: "one lane has no target within reach",
        reach: 1,
        reaches: false,
        to: [1],
      },
      { clear: -1, from: [0], name: "there are no targets", reach: 4, reaches: false, to: [] },
      {
        clear: -1,
        from: [],
        name: "there are no lanes to reach from",
        reach: 0,
        reaches: true,
        to: [],
      },
      {
        clear: notLane1,
        from: [0],
        name: "the only way crosses a lane that is not clear",
        reach: 2,
        reaches: false,
        to: [2],
      },
      {
        clear: notLane1,
        from: [0],
        name: "a target short of a lane that is not clear",
        reach: 2,
        reaches: true,
        to: [0, 2],
      },
    ]) {
      expect(everyLaneReaches(reach, laneMask(from), laneMask(to), clear)).toBe(reaches);
    }
  });
});

// A dart may set off over cells other spawns hold, and a rider pass over cells only darts hold;
// no other mover takes a cell anything holds, and nothing but a dart takes one a dart holds
// alongside another spawn.
describe("moverMayTake", () => {
  it.each([
    { byDarts: false, byOthers: false, motion: "cross", takes: true },
    { byDarts: false, byOthers: true, motion: "cross", takes: true },
    { byDarts: true, byOthers: false, motion: "cross", takes: false },
    { byDarts: false, byOthers: false, motion: "ride", takes: true },
    { byDarts: true, byOthers: false, motion: "ride", takes: true },
    { byDarts: false, byOthers: true, motion: "ride", takes: false },
    { byDarts: true, byOthers: true, motion: "ride", takes: false },
    { byDarts: false, byOthers: false, motion: "steps", takes: true },
    { byDarts: true, byOthers: false, motion: "steps", takes: false },
    { byDarts: false, byOthers: true, motion: "approach", takes: false },
    { byDarts: true, byOthers: false, motion: "shy", takes: false },
  ] as const)(
    "lets a $motion mover take a cell held by darts $byDarts, by others $byOthers: $takes",
    ({ byDarts, byOthers, motion, takes }) => {
      expect(moverMayTake(motion, byDarts, byOthers)).toBe(takes);
    },
  );
});

describe("takeDueSpawns", () => {
  const events = [
    { distance: 100, kind: "tip", lane: 0 },
    { distance: 200, kind: "obstacle", lane: 1 },
    { distance: 300, kind: "tip", lane: 2 },
  ];

  it("splits the events into those reached, at or past their distance, and those still ahead", () => {
    expect(takeDueSpawns(250, events)).toEqual({ due: events.slice(0, 2), pending: [events[2]] });
    expect(takeDueSpawns(200, events).due).toEqual(events.slice(0, 2));
    expect(takeDueSpawns(199.9, events).due).toEqual(events.slice(0, 1));
  });
});

describe("moverRests", () => {
  // A dart whose cue shows for 50px of scroll and sets off 300px down the road, crossing 0.01
  // lanes a pixel at a tilt of 0.2. Stopping after 1.5 lanes takes 150px of scroll, so it stands
  // level with a spawn its cue's distance plus 50 - 300 - 0.2 x 150 = -280 away.
  const dart = {
    direction: 1,
    enterTravel: 300,
    idle: 0,
    lanesPerPixel: 0.01,
    motion: "cross",
    movement: "dart",
    stopAfter: null,
    tilt: 0.2,
    turnAfter: null,
    warning: 50,
  } as const;
  const step = (lanes: number, travel: number) => ({ at: 0, lanes, length: 10, travel });

  it.each<{ name: string; path: MoverPath; rests: { distance: number; lane: number }[] }>([
    { name: "a dart that crosses", path: dart, rests: [] },
    {
      name: "a dart from the left that stops short",
      path: { ...dart, stopAfter: 1.5 },
      rests: [{ distance: 720, lane: 1 }],
    },
    {
      name: "a dart from the right that stops short",
      path: { ...dart, direction: -1, stopAfter: 1.5 },
      rests: [{ distance: 720, lane: 3 }],
    },
    {
      name: "a rider",
      path: {
        lane: 2,
        lanes: 1,
        motion: "ride",
        movement: "inLane",
        speedMultiplier: 2,
        warning: 50,
      },
      rests: [],
    },
    {
      name: "a stepper, at its last spot",
      path: {
        lane: 1,
        motion: "steps",
        movement: "step",
        steps: [step(1, 0), step(0, 64), step(1, 64)],
        warning: 50,
      },
      rests: [{ distance: 872, lane: 3 }],
    },
    {
      name: "a hopper that hops up the road",
      path: { lane: 4, motion: "steps", movement: "hop", steps: [step(-1, -64)], warning: 50 },
      rests: [{ distance: 1064, lane: 3 }],
    },
  ])("finds where $name stands", ({ path, rests }) => {
    expect(moverRests(5, 1000, path)).toEqual(rests);
  });
});
