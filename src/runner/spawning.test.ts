import { describe, expect, it } from "vitest";

import { itemAt } from "../lib/arrays";
import { keysOf } from "../lib/records";
import { type Contact, lanesReachedAtEnd, pathShortfalls } from "../testing/avoidable";
import { plannerStreams } from "../testing/movers";
import { type MoverPath, moverPlace, type MoverSpec, sweptLanes } from "./movers";
import {
  blockingLength,
  type Footprint,
  hitLength,
  moverMayTake,
  moverRests,
  openStretches,
  packFitsOnPath,
  packGap,
  PATH_HOLD_ROWS,
  type PathChange,
  pathReach,
  type PlannedSpawns,
  rowSpacing,
  type SpawnEvent,
  type SpawnPlan,
  spawnRowDistances,
  takeDueSpawns,
  WIDE_LANES,
} from "./spawning";
import { planSpawns } from "./zonePlanner";

type Kind =
  | "bench"
  | "car"
  | "cat"
  | "hedge"
  | "neighbour"
  | "obstacle"
  | "rope"
  | "skunk"
  | "squirrel"
  | "tip"
  | "treat";

// 9 rows at 100..900, 5 lanes. A one-row hit box is 30 - 2 x 5 = 20px; with the 30px pack a
// row's window is 50px, leaving 50px of clear road between rows: at 100px/s that is 0.5s,
// time for a 0.05s step and 4 moves of 0.1s, so the pack can reach any lane from any row. No cap
// on rows that come on screen quiet, unless a test sets one. The path starts in the middle lane.
// No fixed kinds to swap among, unless a test sets them.
const plan: SpawnPlan<Kind> = {
  cellInset: 5,
  cellLength: 30,
  fixedKinds: [],
  laneCount: 5,
  laneInset: 5,
  laneMoveSeconds: 0.1,
  maxEmptyRows: Number.POSITIVE_INFINITY,
  minOpenLanes: 1,
  minSpacing: 100,
  moverCaps: { darts: 1, slowVehicles: 1, total: 3 },
  packHitLength: 30,
  packLength: 30,
  pathLaneMoveSeconds: 0.1,
  pathStart: 2,
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
  pathLaneMoveSeconds: 0.25,
  quotas: [
    { blocksLane: true, count: 27, kind: "obstacle" },
    { blocksLane: false, count: 9, kind: "tip" },
  ],
};

const FOOTPRINTS = {
  bench: { lanes: 2, rows: 1 },
  car: { lanes: 1, rows: 3 },
  hedge: { lanes: 3, rows: 1 },
  rope: { lanes: 2, rows: 1 },
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
  !["neighbour", "squirrel", "tip", "treat"].includes(event.kind);

// A prize that moves, as the friendly neighbour does: 1 or 2 steps, a lane to either side then a
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
// every lane of its own row.
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
    vergeShare: 0,
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

// Each lane-blocking spawn as the pack meets it, its hit box planned from its footprint.
const contactsOf = (spawnPlan: SpawnPlan<Kind>, events: SpawnEvent<Kind>[]): Contact[] =>
  events.filter(blocking).map((event) => {
    const { lanes, rows } = footprintOf(event.kind);
    return {
      end: event.distance + hitLength(spawnPlan, rows),
      label: `${event.kind} at ${event.distance} in lane ${event.lane}`,
      lanes: new Set(Array.from({ length: lanes }, (_, i) => event.lane + i)),
      start: event.distance,
    };
  });

// The planned path passes every lane-blocking spawn with full margins, as the planner measures
// them, and the pack has a way through the zone from the path's first lane.
function expectPathPassable(
  spawnPlan: SpawnPlan<Kind>,
  planned: PlannedSpawns<Kind>,
  label: string,
): void {
  const { events, path } = planned;
  const gap = (moves: number) => packGap(spawnPlan, moves) - 1e-6;
  expect(
    pathShortfalls(spawnPlan.packLength, gap, path, contactsOf(spawnPlan, events)),
    label,
  ).toEqual([]);
  const spans = spansOf(spawnPlan, events);
  expect(lanesReachedAtEnd(spawnPlan, spans, spawnPlan.pathStart), label).not.toEqual([]);
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

describe("packFitsOnPath", () => {
  // A car three rows long in lane 2, and the path changing from lane 1 to lane 2 just after it
  // meets the pack: road starts showing behind it at its hit box's far edge.
  const car = { distance: 0, lane: 2, lanes: 1, length: hitLength(plan, 3) };
  const behind = car.length;
  const change: PathChange = { at: 1, from: 1, to: 2 };
  it.each([
    {
      far: { distance: behind + packGap(plan, 1) - 1, lane: 1 },
      fits: false,
      name: "a pack gap less a pixel later, in the lane the path leaves",
    },
    {
      far: { distance: behind + packGap(plan, 1), lane: 1 },
      fits: true,
      name: "a pack gap later, in the lane the path leaves",
    },
    {
      far: { distance: behind + 1, lane: 2 },
      fits: true,
      name: "a pixel later, in the lane the path takes",
    },
    {
      far: { distance: behind + 1, lane: 3 },
      fits: true,
      name: "a pixel later, off the path's way",
    },
    {
      far: { distance: behind + 1, lane: 1 },
      fits: true,
      name: "a pixel later, with no change between",
      unchanged: true,
    },
  ])("fits a pack past a car and an obstacle $name: $fits", ({ far, fits, unchanged }) => {
    const changes = unchanged === true ? [] : [change];
    const other = { ...far, lanes: 1, length: hitLength(plan, 1) };
    expect(packFitsOnPath(plan, changes, car, other)).toBe(fits);
    expect(packFitsOnPath(plan, changes, other, car)).toBe(fits);
  });
});

describe("packGap and packFitsOnPath over wide obstacles", () => {
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

  // The path changes from lane 0 to lane 2 between the two: as the nearer one passes the pack is
  // short of the first lane on the way it covers, and as the farther one meets it, past the last.
  it.each([
    { far: { lane: 0, lanes: 2 }, moves: 2, name: "1-3, then 0-1", near: { lane: 1, lanes: 3 } },
    { far: { lane: 0, lanes: 1 }, moves: 1, name: "1-3, then 0", near: { lane: 1, lanes: 3 } },
    { far: { lane: 0, lanes: 2 }, moves: 1, name: "2-4, then 0-1", near: { lane: 2, lanes: 3 } },
    { far: { lane: 0, lanes: 1 }, moves: 0, name: "2-4, then 0", near: { lane: 2, lanes: 3 } },
  ])("leaves room for $moves lane moves between wide obstacles $name", ({ far, moves, near }) => {
    const change: PathChange = { at: 1, from: 0, to: 2 };
    const nearer = { ...near, distance: 0, length: hitLength(plan, 1) };
    const at = (gap: number) => ({ ...far, distance: nearer.length + gap, length: nearer.length });
    const tightest = moves === 0 ? 1 : packGap(margined, moves);
    for (const [a, b] of [
      [nearer, at(tightest - 1)],
      [at(tightest - 1), nearer],
    ] as const) {
      expect(packFitsOnPath(margined, [change], a, b)).toBe(moves === 0);
    }
    expect(packFitsOnPath(margined, [change], nearer, at(tightest))).toBe(true);
  });
});

// The independent check the planner tests use: a path holding lane 1 on the rows at 100 and 200
// and changing to lane 2 at 300, halfway at 250, a 30px pack and 150px of road per lane move.
describe("pathShortfalls", () => {
  const path = [
    { distance: 100, lane: 1 },
    { distance: 200, lane: 1 },
    { distance: 300, lane: 2 },
  ];
  const contact = (lane: number, start: number): Contact => ({
    end: start + 20,
    label: `lane ${lane} at ${start}`,
    lanes: new Set([lane]),
    start,
  });
  it.each([
    { contacts: [contact(1, 160)], name: "an obstacle in the path's lane", shortfalls: 1 },
    {
      contacts: [contact(2, 150), contact(1, 300)],
      name: "obstacles either side of the change with 130px between them",
      shortfalls: 1,
    },
    {
      contacts: [contact(2, 150), contact(1, 320)],
      name: "obstacles either side of the change with 150px between them",
      shortfalls: 0,
    },
    { contacts: [contact(1, 300)], name: "an obstacle after the change alone", shortfalls: 0 },
  ])("finds $shortfalls shortfalls with $name", ({ contacts, shortfalls }) => {
    expect(pathShortfalls(30, (moves) => 150 * moves, path, contacts)).toHaveLength(shortfalls);
  });
});

describe("planSpawns", () => {
  it("spawns exactly the count of each kind, sorted by distance", () => {
    const events = planSpawns(plannerStreams(1), plan).events;
    expect(countOf("obstacle", events)).toBe(6);
    expect(countOf("tip", events)).toBe(9);
    expect(countOf("treat", events)).toBe(3);
    const distances = events.map((event) => event.distance);
    expect(distances).toEqual([...distances].sort((a, b) => a - b));
  });

  it("puts every spawn on a row and in a lane, one spawn per cell", () => {
    const rows = spawnRowDistances(100, 1000);
    for (const seed of seeds) {
      const events = planSpawns(plannerStreams(seed), plan).events;
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
    expect(planSpawns(plannerStreams(9), plan).events).toEqual(
      planSpawns(plannerStreams(9), plan).events,
    );
    expect(planSpawns(plannerStreams(9), plan).events).not.toEqual(
      planSpawns(plannerStreams(10), plan).events,
    );
  });

  // 9 rows of 5 lanes, given more obstacles than fit: each row keeps open the lanes the path holds
  // on it, its own and on the row before a change every lane the change crosses, and at least
  // minOpenLanes; every other lane takes an obstacle.
  it.each([{ minOpenLanes: 1 }, { minOpenLanes: 2 }])(
    "fills every row but the lanes the path holds and $minOpenLanes more open, skipping the rest",
    ({ minOpenLanes }) => {
      const crowded: SpawnPlan<Kind> = {
        ...plan,
        minOpenLanes,
        quotas: [{ blocksLane: true, count: 9 * 4 + 1, kind: "obstacle" }],
      };
      for (const seed of seeds.slice(0, 10)) {
        const { events, path } = planSpawns(plannerStreams(seed), crowded);
        const kept = path.map(({ lane }, row) =>
          Math.max(minOpenLanes, Math.abs((path[row + 1]?.lane ?? lane) - lane) + 1),
        );
        const open = openLanesByRow(crowded, events).map((lanes) => lanes.length);
        expect(open, `seed ${seed}`).toEqual(kept);
        expect(countOf("obstacle", events)).toBe(kept.reduce((sum, lanes) => sum + 5 - lanes, 0));
      }
    },
  );

  // 29 rows, with one-cell obstacles each in view as its row comes on screen: placed one per
  // stretch at random, some stretches run quiet for longer than the cap, with room to move
  // obstacles into them. A run from the zone's first row or to its last may have half the cap,
  // rounded down, so the runs either side of two zones' meeting together keep near it.
  const sparse = (obstacles: number): SpawnPlan<Kind> => ({
    ...plan,
    quotas: [
      { blocksLane: true, count: obstacles, kind: "obstacle" },
      { blocksLane: false, count: 9, kind: "tip" },
    ],
    zoneLength: 3000,
  });
  // The quiet runs' lengths, in order along the zone, the first and the last included even when
  // they are empty.
  const quietRuns = (events: SpawnEvent<Kind>[]) => {
    const filled = new Set(events.filter(blocking).map(({ distance }) => distance));
    const runs = [0];
    for (const row of spawnRowDistances(plan.minSpacing, 3000)) {
      if (filled.has(row)) {
        runs.push(0);
      } else {
        runs[runs.length - 1] = (runs.at(-1) ?? 0) + 1;
      }
    }
    return runs;
  };
  const longestQuiet = (events: SpawnEvent<Kind>[]) => Math.max(...quietRuns(events));
  it.each([
    { maxEmptyRows: 3, obstacles: 10 },
    { maxEmptyRows: 4, obstacles: 7 },
  ])(
    "moves $obstacles obstacles into every run of more than $maxEmptyRows quiet rows, adding none",
    ({ maxEmptyRows, obstacles }) => {
      const uncapped = seeds
        .slice(0, 10)
        .map((seed) => planSpawns(plannerStreams(seed), sparse(obstacles)).events);
      expect(Math.max(...uncapped.map(longestQuiet))).toBeGreaterThan(maxEmptyRows);
      for (const seed of seeds.slice(0, 10)) {
        const events = planSpawns(plannerStreams(seed), {
          ...sparse(obstacles),
          maxEmptyRows,
        }).events;
        const runs = quietRuns(events);
        expect(Math.max(...runs), `seed ${seed}`).toBeLessThanOrEqual(maxEmptyRows);
        for (const edge of [runs[0], runs.at(-1)]) {
          expect(edge, `seed ${seed}`).toBeLessThanOrEqual(Math.floor(maxEmptyRows / 2));
        }
        expect(countOf("obstacle", events)).toBe(obstacles);
        expect(countOf("tip", events)).toBe(9);
      }
    },
  );

  it("throws when the rows cannot be planned", () => {
    for (const { error, unplannable } of [
      {
        error: /apart/,
        name: "the rows, with no lane move to space them, are too close for the pack to pass between them",
        unplannable: { ...plan, laneMoveSeconds: 0, packLength: 81, pathLaneMoveSeconds: 0 },
      },
      {
        error: /sight/,
        name: "the next row is out of sight before the pack must steer for it",
        unplannable: { ...plan, sightLength: 49 },
      },
    ] satisfies readonly { error: RegExp; name: string; unplannable: SpawnPlan<Kind> }[]) {
      expect(() => planSpawns(plannerStreams(1), unplannable).events).toThrow(error);
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
    const events = planSpawns(plannerStreams(1), tooBig).events;
    expect(countOf("obstacle", events)).toBeGreaterThan(0);
    expect(countOf("obstacle", events)).toBeLessThan(40);
    expect(countOf("tip", events)).toBe(9);
    expect(planSpawns(plannerStreams(1), tooBig).events).toEqual(events);
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
      const events = planSpawns(plannerStreams(seed), crowded).events;
      expect(countOf("tip", events)).toBe(30);
      expect(countOf("bench", events)).toBeGreaterThan(0);
      expect(countOf("bench", events)).toBeLessThanOrEqual(7);
    }
  });

  it("frees a one-cell spawn's kept cell once it is placed, for the bigger obstacles after it", () => {
    // 9 rows of 5 lanes: 25 treats placed first leave 20 cells, all free for benches off the
    // path; were the treats' kept cells still kept, no bench would leave room for them.
    const placedFirst: SpawnPlan<Kind> = {
      ...plan,
      quotas: [
        { blocksLane: true, count: 20, footprint: FOOTPRINTS.bench, kind: "bench" },
        { blocksLane: false, count: 25, first: true, kind: "treat" },
      ],
    };
    for (const seed of seeds.slice(0, 10)) {
      const events = planSpawns(plannerStreams(seed), placedFirst).events;
      expect(countOf("treat", events)).toBe(25);
      expect(countOf("bench", events)).toBeGreaterThan(0);
    }
  });

  it("places every obstacle at a tight reach, keeping the path passable", () => {
    for (const seed of seeds) {
      const planned = planSpawns(plannerStreams(seed), tight);
      expect(countOf("obstacle", planned.events)).toBe(27);
      expectPathPassable(tight, planned, `seed ${seed}`);
    }
  });

  // The path starts in pathStart, holds each lane for PATH_HOLD_ROWS rows or more, and changes by
  // pathReach lanes or fewer; its lane is open in every row, and so is every lane a change crosses
  // on the row before it.
  it.each([
    { name: "plan", spawnPlan: plan },
    { name: "tight", spawnPlan: tight },
    { name: "shaped", spawnPlan: shaped },
    { name: "reacting", spawnPlan: reacting },
  ])("holds the path's lanes clear in $name", ({ spawnPlan }) => {
    let changes = 0;
    for (const seed of seeds.slice(0, 20)) {
      const { events, path } = planSpawns(plannerStreams(seed), spawnPlan);
      const open = openLanesByRow(spawnPlan, events);
      expect(path.map(({ distance }) => distance)).toEqual(
        spawnRowDistances(rowSpacing(spawnPlan), spawnPlan.zoneLength),
      );
      expect(path[0]?.lane).toBe(spawnPlan.pathStart);
      let held = 0;
      path.forEach(({ lane }, row) => {
        const next = path[row + 1]?.lane ?? lane;
        held += 1;
        if (next !== lane) {
          changes += 1;
          expect(held).toBeGreaterThanOrEqual(PATH_HOLD_ROWS);
          expect(Math.abs(next - lane)).toBeLessThanOrEqual(pathReach(spawnPlan));
          held = 0;
        }
        for (let crossed = Math.min(lane, next); crossed <= Math.max(lane, next); crossed++) {
          expect(itemAt(open, row), `seed ${seed}, row ${row}`).toContain(crossed);
        }
      });
    }
    expect(changes).toBeGreaterThan(0);
  });

  // Eight wide footprints with a row between each leave 19 rows too few for every one at times,
  // so a hedge or a bench may be skipped; the one-cell obstacles never are.
  it("keeps a footprint on the road, its cells to itself, and two lanes open", () => {
    const kinds = new Set<Kind>();
    for (const seed of seeds) {
      const events = planSpawns(plannerStreams(seed), shaped).events;
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

  it("keeps the path passable through footprints over several lanes and rows", () => {
    for (const seed of seeds) {
      expectPathPassable(shaped, planSpawns(plannerStreams(seed), shaped), `seed ${seed}`);
    }
  });

  it("ends a footprint more than one row long within the zone's last row", () => {
    const cars: SpawnPlan<Kind> = {
      ...shaped,
      quotas: [{ blocksLane: true, count: 12, footprint: FOOTPRINTS.car, kind: "car" }],
    };
    for (const seed of seeds.slice(0, 10)) {
      for (const event of planSpawns(plannerStreams(seed), cars).events) {
        expect(event.distance + blockingLength(cars, 3)).toBeLessThanOrEqual(1900 + 70);
      }
    }
  });

  // Along the path, checked apart from the planner: at each change of lane, the road between the
  // hit boxes of obstacles met before and after it fits the 50px pack, the path's lane moves of
  // 25px, or 50px where the path is spaced for a pack changing lanes at half speed, and the
  // reaction margin. A 120px margin asks for more than the 180px between one-row obstacles two rows
  // apart. Obstacles WIDE_LANES wide or wider are two rows apart or more.
  it.each([
    { margin: 10, move: 25 },
    { margin: 120, move: 25 },
    { margin: 10, move: 50 },
  ])(
    "spaces obstacles for the path's $move px lane changes between them, with a $margin px margin",
    ({ margin, move }) => {
      const spaced = {
        ...reacting,
        pathLaneMoveSeconds: (reacting.laneMoveSeconds * move) / 25,
        reactionSeconds: margin / reacting.scrollSpeed,
      };
      for (const seed of seeds.slice(0, 5)) {
        const { events: planned, path } = planSpawns(plannerStreams(seed), spaced);
        const events = planned.filter(blocking);
        expect(events.filter((event) => footprintOf(event.kind).lanes > 1).length).toBeGreaterThan(
          4,
        );
        const gap = (moves: number) => 50 + move * moves + margin - 1e-6;
        expect(pathShortfalls(50, gap, path, contactsOf(spaced, events))).toEqual([]);
        events.forEach((near, i) => {
          for (const far of events.slice(i + 1)) {
            if (
              footprintOf(near.kind).lanes >= WIDE_LANES &&
              footprintOf(far.kind).lanes >= WIDE_LANES
            ) {
              expect(far.distance - near.distance).toBeGreaterThanOrEqual(2 * 100);
            }
          }
        });
      }
    },
  );

  // A moving prize, stepping as the friendly neighbour does or darting as a squirrel does, is
  // placed after every spawn the pack steers around, a lane-blocking dart included, which it
  // leaves where they were: it blocks no lane and takes no dart's place on screen. A long zone
  // gives it room to move; a zone shorter than the road gives a stepper none, so it stands still.
  // Either way none is skipped.
  it.each([
    { kind: "neighbour", mover: STROLLING, moves: 3, name: "a long zone", zoneLength: 6000 },
    { kind: "neighbour", mover: STROLLING, moves: 0, name: "a short zone", zoneLength: 1000 },
    { kind: "squirrel", mover: DARTING, moves: 3, name: "a long zone", zoneLength: 6000 },
  ] as const)(
    "places every moving $kind in $name, leaving the rest as they were",
    ({ kind, mover, moves, zoneLength }) => {
      const without: SpawnPlan<Kind> = {
        ...plan,
        quotas: [...plan.quotas, { blocksLane: true, count: 2, kind: "cat", mover: DARTING }],
        zoneLength,
      };
      const prize = { blocksLane: false, count: 3, kind, mover };
      const withPrizes: SpawnPlan<Kind> = { ...without, quotas: [...without.quotas, prize] };
      for (const seed of seeds) {
        const events = planSpawns(plannerStreams(seed), withPrizes).events;
        const prizes = events.filter((event) => event.kind === kind);
        expect(prizes).toHaveLength(prize.count);
        expect(prizes.filter(({ mover }) => mover !== undefined)).toHaveLength(moves);
        expect(events.filter(blocking)).toEqual(
          planSpawns(plannerStreams(seed), without).events.filter(blocking),
        );
      }
    },
  );

  // Cards (obstacles marked first) are placed before the darts, and benches and tips after. A dart
  // sets off over a card's cell; cards and benches may stand in the row before its own, and a bench
  // placed after it may take its row; no tip is in its row; and the pack has a way past every card,
  // dart and bench from the path's first lane. A straight dart's row is where it sets off, its
  // cue's lead less its cue.
  it.each([
    { cards: 8, minOpenLanes: 2 },
    { cards: 14, minOpenLanes: 1 },
  ])(
    "lets a dart set off over $cards cards' cells, with cards and benches in the row before",
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
      let beforeShared = 0;
      for (const seed of seeds.slice(0, 20)) {
        const events = planSpawns(plannerStreams(seed), darting).events;
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
          const before = lanes.count > 0 ? [row - spacing] : [];
          shared += at(row, ["obstacle"]).length;
          benchShared += at(row, ["bench"]).length;
          expect(at(row, ["tip"]), `seed ${seed}`).toEqual([]);
          for (const held of before) {
            beforeShared += at(held, ["obstacle", "bench"]).length;
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
        expect(lanesReachedAtEnd(darting, spans, darting.pathStart), `seed ${seed}`).not.toEqual(
          [],
        );
      }
      expect(shared).toBeGreaterThan(0);
      expect(benchShared).toBeGreaterThan(0);
      expect(beforeShared).toBeGreaterThan(0);
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
          { blocksLane: true, count: 40, kind: "obstacle" },
        ],
        zoneLength: 4000,
      };
      const spacing = rowSpacing(riding);
      const height = hitLength(riding, 1);
      let beside = 0;
      for (const seed of seeds.slice(0, 20)) {
        const events = planSpawns(plannerStreams(seed), riding).events;
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
        const events = planSpawns(plannerStreams(seed), riding).events;
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

  // A stepper ends its move in its last spot and stands there. A tip marked moversRestOn may lie
  // where a mover rests; a treat, or a tip without the mark, keeps off every row a spawn on which
  // would overlap the mover standing there.
  it.each([
    { kind: "tip", moversRestOn: true, onRest: true },
    { kind: "tip", moversRestOn: false, onRest: false },
    { kind: "treat", moversRestOn: undefined, onRest: false },
  ] as const)(
    "lays a $kind marked moversRestOn $moversRestOn where a mover rests: $onRest",
    ({ kind, moversRestOn, onRest }) => {
      const stepping: SpawnPlan<Kind> = {
        ...plan,
        quotas: [
          { blocksLane: true, count: 4, kind: "cat", mover: STROLLING },
          {
            blocksLane: false,
            count: 60,
            kind,
            moversPassOver: true,
            ...(moversRestOn === undefined ? {} : { moversRestOn }),
          },
        ],
        zoneLength: 4000,
      };
      let onRests = 0;
      for (const seed of seeds.slice(0, 20)) {
        const events = planSpawns(plannerStreams(seed), stepping).events;
        for (const { distance, mover } of events) {
          if (mover === undefined) {
            continue;
          }
          for (const rest of moverRests(stepping.laneCount, distance, mover)) {
            onRests += events.filter(
              (spawn) =>
                spawn.kind === kind &&
                spawn.lane === rest.lane &&
                spawn.distance > rest.distance - hitLength(stepping, 1) &&
                spawn.distance < rest.distance + hitLength(stepping, 1),
            ).length;
          }
        }
      }
      expect(onRests > 0).toBe(onRest);
    },
  );

  // Twenty wide footprints with a row between each never all fit in 19 rows: the hedges and the
  // benches take turns along the zone, so neither kind takes the room first. A hedge, three lanes
  // wide beside the path's lane and two kept open, fits fewer rows than a bench, so it keeps less.
  it("keeps each standing kind's share of what is placed when room runs short", () => {
    const crowded: SpawnPlan<Kind> = {
      ...shaped,
      quotas: [
        { blocksLane: true, count: 10, footprint: FOOTPRINTS.hedge, kind: "hedge" },
        { blocksLane: true, count: 10, footprint: FOOTPRINTS.bench, kind: "bench" },
      ],
    };
    const placed = seeds.map((seed) => planSpawns(plannerStreams(seed), crowded).events);
    const total = (kind: Kind) => placed.reduce((sum, events) => sum + countOf(kind, events), 0);
    expect(total("hedge") + total("bench")).toBeLessThan(20 * seeds.length);
    for (const kind of ["hedge", "bench"] as const) {
      expect(total(kind) / (total("hedge") + total("bench"))).toBeGreaterThan(0.3);
    }
  });

  // Ten hedges, or twenty benches, never all fit shaped's 19 rows. Each with no room is swapped
  // for one of the fixed kinds narrower than it, a lane at a time, drawn by their weights among
  // those that fit, so the zone keeps its count; a kind that is not fixed is skipped instead.
  it.each<{
    count: number;
    fixed: Partial<Record<Kind, number>>;
    kind: Kind;
    name: string;
    swaps: Partial<Record<Kind, number>>;
  }>([
    {
      count: 10,
      fixed: { bench: 1, hedge: 1, obstacle: 1 },
      kind: "hedge",
      name: "a hedge for the two-lane kind",
      swaps: { bench: 1 },
    },
    {
      count: 10,
      fixed: { bench: 3, hedge: 1, rope: 1 },
      kind: "hedge",
      name: "a hedge for two-lane kinds by their weights",
      swaps: { bench: 0.75, rope: 0.25 },
    },
    {
      count: 10,
      fixed: { hedge: 1, obstacle: 1 },
      kind: "hedge",
      name: "a hedge for a one-lane kind with no two-lane one",
      swaps: { obstacle: 1 },
    },
    {
      count: 20,
      fixed: { bench: 1, hedge: 1, obstacle: 1 },
      kind: "bench",
      name: "a bench for a one-lane kind, never a wider one",
      swaps: { obstacle: 1 },
    },
    {
      count: 10,
      fixed: { bench: 1, obstacle: 1 },
      kind: "hedge",
      name: "no hedge that is not fixed",
      swaps: {},
    },
  ])("swaps $name when it has no room", ({ count, fixed, kind, swaps }) => {
    const swapping: SpawnPlan<Kind> = {
      ...shaped,
      fixedKinds: Object.entries(fixed).map(([fixedKind, weight]) => ({
        footprint: footprintOf(fixedKind as Kind),
        kind: fixedKind as Kind,
        weight,
      })),
      quotas: [
        { blocksLane: true, count, footprint: footprintOf(kind), kind },
        { blocksLane: false, count: 9, kind: "tip" },
      ],
    };
    const placed = seeds.map((seed) => planSpawns(plannerStreams(seed), swapping));
    const total = (other: Kind) =>
      placed.reduce((sum, { events }) => sum + countOf(other, events), 0);
    const swapped = keysOf(swaps);
    placed.forEach((planned, i) => {
      expectPathPassable(swapping, planned, `seed ${itemAt(seeds, i)}`);
      expect(countOf("tip", planned.events)).toBe(9);
      expect(planned.events.filter(blocking).length).toBe(
        swapped.length > 0 ? count : countOf(kind, planned.events),
      );
    });
    expect(total(kind)).toBeLessThan(count * seeds.length);
    const allSwaps = swapped.reduce((sum, other) => sum + total(other), 0);
    for (const other of swapped) {
      expect(total(other) / allSwaps).toBeCloseTo(swaps[other] ?? 0, 1);
    }
  });

  it("spreads each kind over the zone, one per equal stretch of rows", () => {
    // 3 treats over 9 rows: one in rows 100-300, one in 400-600, one in 700-900.
    for (const seed of seeds) {
      const treats = planSpawns(plannerStreams(seed), plan).events.filter(
        (e) => e.kind === "treat",
      );
      expect(treats.map(({ distance }) => Math.floor((distance - 100) / 300))).toEqual([0, 1, 2]);
    }
  });
});

describe("pathReach and rowSpacing", () => {
  // tight's 70px window leaves 30px between rows 100px apart. A move lasts whole 0.05s steps,
  // and needs a step to spare. The path changes by up to two lanes where the pack fits past them
  // on the road between one-row spawns two rows apart.
  it.each([
    { name: "a step and a move fit", reach: 2, spaced: tight, spacing: 100 },
    {
      name: "52px between rows fits two 25px moves but not their step to spare",
      reach: 2,
      spaced: { ...tight, packHitLength: 28, packLength: 28 },
      spacing: 100,
    },
    {
      name: "a 0.26s move lasts six steps, 30px",
      reach: 2,
      spaced: { ...tight, laneMoveSeconds: 0.26, pathLaneMoveSeconds: 0.26 },
      spacing: 105,
    },
    {
      name: "at 200px/s a 10px step and a 50px move need 60px",
      reach: 2,
      spaced: { ...tight, scrollSpeed: 200 },
      spacing: 130,
    },
    {
      name: "a hit box 30px longer than its row widens a 120px window's rows past minSpacing",
      reach: 2,
      spaced: { ...tight, cellInset: -20 },
      spacing: 150,
    },
    {
      name: "a 1.2s reaction margin leaves room for one move at most",
      reach: 1,
      spaced: { ...tight, reactionSeconds: 1.2 },
      spacing: 100,
    },
    {
      name: "two lanes leave one to change to",
      reach: 1,
      spaced: { ...plan, laneCount: 2, laneMoveSeconds: 0, pathLaneMoveSeconds: 0, pathStart: 0 },
      spacing: 100,
    },
  ] satisfies readonly {
    name: string;
    reach: number;
    spaced: SpawnPlan<Kind>;
    spacing: number;
  }[])("spaces rows and reaches $reach lanes when $name", ({ reach, spaced, spacing }) => {
    expect(rowSpacing(spaced)).toBe(spacing);
    expect(pathReach(spaced)).toBe(reach);
  });

  it("plans the spawns on rows that far apart", () => {
    const fast = { ...tight, quotas: plan.quotas, scrollSpeed: 200 };
    const distances = planSpawns(plannerStreams(1), fast).events.map(({ distance }) => distance);
    expect(distances.length).toBeGreaterThan(0);
    expect(distances.every((distance) => distance % rowSpacing(fast) === 0)).toBe(true);
  });
});

// On a road of 5 lanes, written lane 0 first: each stretch between walls (W) keeps a lane the darts
// (D) leave open (.), wherever the walls stand.
describe("openStretches", () => {
  const masks = (road: string) =>
    [..."WD"].map((mark) =>
      [...road].reduce((mask, cell, lane) => (cell === mark ? mask | (1 << lane) : mask), 0),
    );
  it.each([
    { open: true, road: "....." },
    { open: true, road: "DDDD." },
    { open: false, road: "DDDDD" },
    { open: true, road: ".DWD." },
    { open: false, road: "..WDD" },
    { open: true, road: "D.WD." },
    { open: false, road: "DWDW." },
    { open: true, road: "WWW.D" },
    { open: false, road: "WWWDD" },
  ])("leaves a stretch of $road open: $open", ({ open, road }) => {
    const [walls = 0, darts = 0] = masks(road);
    expect(openStretches(5, walls, darts)).toBe(open);
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
