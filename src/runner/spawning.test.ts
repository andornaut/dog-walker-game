import { describe, expect, it } from "vitest";

import { itemAt } from "../arrays";
import { lanesReachedAtEnd } from "../testing/avoidable";
import { seededRandom } from "./random";
import {
  blockingLength,
  everyLaneReaches,
  type Footprint,
  hitLength,
  laneMask,
  laneReach,
  planSpawns,
  type SpawnEvent,
  type SpawnPlan,
  spawnRowDistances,
  takeDueSpawns,
} from "./spawning";

type Kind = "bench" | "car" | "hedge" | "obstacle" | "skunk" | "tip" | "treat";

// 9 rows at 100..900, 5 lanes. A one-row hit box is 30 - 2 x 5 = 20px; with the 30px pack a
// row's window is 50px, leaving 50px of clear road between rows: at 100px/s that is 0.5s,
// time for 5 moves of 0.1s, so the pack can reach any lane from any row.
const plan: SpawnPlan<Kind> = {
  cellInset: 5,
  cellLength: 30,
  laneCount: 5,
  laneMoveSeconds: 0.1,
  minOpenLanes: 1,
  minSpacing: 100,
  packLength: 30,
  quotas: [
    { blocksLane: true, count: 6, kind: "obstacle" },
    { blocksLane: false, count: 9, kind: "tip" },
    { blocksLane: false, count: 3, kind: "treat" },
  ],
  roadLength: 1100,
  scrollSpeed: 100,
  sightLength: 1000,
  zoneLength: 1000,
};

// A 70px window leaves 0.3s between rows, which fits one 0.25s move; the 1.3s into the first
// row fits five.
const tight: SpawnPlan<Kind> = {
  ...plan,
  laneMoveSeconds: 0.25,
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

const blocking = (event: SpawnEvent<Kind>) => event.kind !== "tip" && event.kind !== "treat";

// The lanes no lane-blocking spawn overlaps in each row's window.
function openLanesByRow(spawnPlan: SpawnPlan<Kind>, events: SpawnEvent<Kind>[]): number[][] {
  const window = blockingLength(spawnPlan, 1);
  return spawnRowDistances(spawnPlan.minSpacing, spawnPlan.zoneLength).map((distance) => {
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
  });

  it("has no rows in a zone too short for one", () => {
    expect(spawnRowDistances(100, 150)).toEqual([]);
    expect(spawnRowDistances(100, 50)).toEqual([]);
  });

  it("rejects a spacing that is not positive", () => {
    expect(() => spawnRowDistances(0, 1000)).toThrow("minSpacing must be positive");
  });
});

describe("hitLength and blockingLength", () => {
  it("insets the hit box from its footprint at both ends, and adds the pack", () => {
    expect(hitLength(plan, 1)).toBe(20);
    expect(hitLength(plan, 3)).toBe(80);
    expect(blockingLength(plan, 2)).toBe(80);
  });
});

describe("planSpawns", () => {
  it("spawns exactly the count of each kind", () => {
    const events = planSpawns(seededRandom(1), plan);
    expect(countOf("obstacle", events)).toBe(6);
    expect(countOf("tip", events)).toBe(9);
    expect(countOf("treat", events)).toBe(3);
  });

  it("sorts the events by distance", () => {
    const distances = planSpawns(seededRandom(2), plan).map((event) => event.distance);
    expect(distances).toEqual([...distances].sort((a, b) => a - b));
  });

  it("puts every spawn on a row and in a lane, one spawn per cell", () => {
    const rows = spawnRowDistances(100, 1000);
    for (const seed of seeds) {
      const events = planSpawns(seededRandom(seed), plan);
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
    expect(planSpawns(seededRandom(9), plan)).toEqual(planSpawns(seededRandom(9), plan));
    expect(planSpawns(seededRandom(9), plan)).not.toEqual(planSpawns(seededRandom(10), plan));
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
      const events = planSpawns(seededRandom(seed), crowded);
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
      const open = openLanesByRow(crowded, planSpawns(seededRandom(seed), crowded));
      expect(open.every((lanes) => lanes.length === 2)).toBe(true);
    }
    const tooMany = {
      ...crowded,
      quotas: [{ blocksLane: true, count: 9 * 3 + 1, kind: "obstacle" as const }],
    };
    expect(() => planSpawns(seededRandom(1), tooMany)).toThrow(/obstacle/);
  });

  it("throws when the zone has no room for the obstacles asked for", () => {
    const tooMany: SpawnPlan<Kind> = {
      ...plan,
      quotas: [{ blocksLane: true, count: 9 * 4 + 1, kind: "obstacle" }],
    };
    expect(() => planSpawns(seededRandom(1), tooMany)).toThrow(/obstacle/);
  });

  it("skips an obstacle bigger than one cell that has no room left, the same way every time", () => {
    const tooBig: SpawnPlan<Kind> = {
      ...plan,
      quotas: [
        { blocksLane: true, count: 40, footprint: { lanes: 3, rows: 1 }, kind: "obstacle" },
        { blocksLane: false, count: 9, kind: "tip" },
      ],
    };
    const events = planSpawns(seededRandom(1), tooBig);
    expect(countOf("obstacle", events)).toBeGreaterThan(0);
    expect(countOf("obstacle", events)).toBeLessThan(40);
    expect(countOf("tip", events)).toBe(9);
    expect(planSpawns(seededRandom(1), tooBig)).toEqual(events);
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
      const events = planSpawns(seededRandom(seed), crowded);
      expect(countOf("tip", events)).toBe(30);
      expect(countOf("bench", events)).toBeGreaterThan(0);
      expect(countOf("bench", events)).toBeLessThanOrEqual(7);
    }
  });

  it("leaves an open lane within one move of every open lane on the row before", () => {
    for (const seed of seeds) {
      const open = openLanesByRow(tight, planSpawns(seededRandom(seed), tight));
      open.slice(1).forEach((lanes, i) => {
        for (const from of itemAt(open, i)) {
          expect(lanes.some((lane) => Math.abs(lane - from) <= 1)).toBe(true);
        }
      });
    }
  });

  it("still places every obstacle when the reach is tight", () => {
    for (const seed of seeds) {
      expect(countOf("obstacle", planSpawns(seededRandom(seed), tight))).toBe(27);
    }
  });

  it("keeps a footprint on the road, its cells to itself, and two lanes open", () => {
    for (const seed of seeds) {
      const events = planSpawns(seededRandom(seed), shaped);
      expect(events.filter(blocking)).toHaveLength(14);
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
  });

  it("leaves a way through footprints over several lanes and rows, from any lane", () => {
    for (const seed of seeds) {
      const spans = spansOf(shaped, planSpawns(seededRandom(seed), shaped));
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
      for (const event of planSpawns(seededRandom(seed), cars)) {
        expect(event.distance + blockingLength(cars, 3)).toBeLessThanOrEqual(1900 + 70);
      }
    }
  });

  it("throws when the rows are too close for the pack to pass between them", () => {
    expect(() => planSpawns(seededRandom(1), { ...plan, packLength: 81 })).toThrow(/minSpacing/);
  });

  it("throws when the next row is out of sight before the pack must steer for it", () => {
    expect(() => planSpawns(seededRandom(1), { ...plan, sightLength: 49 })).toThrow(/sight/);
  });

  it("throws when no obstacle can be placed without blocking every reachable lane", () => {
    // 100px of road into the first row at 100px/s is 1s, less than one 2s move, so every
    // lane of the first row must stay open, and then of every row after it.
    const unreachable: SpawnPlan<Kind> = {
      ...plan,
      laneMoveSeconds: 2,
      packLength: 80,
      quotas: [{ blocksLane: true, count: 1, kind: "obstacle" }],
    };
    expect(() => planSpawns(seededRandom(1), unreachable)).toThrow(/obstacle/);
  });

  it("spreads each kind over the zone, one per equal stretch of rows", () => {
    // 3 treats over 9 rows: one in rows 100-300, one in 400-600, one in 700-900.
    for (const seed of seeds) {
      const treats = planSpawns(seededRandom(seed), plan).filter((e) => e.kind === "treat");
      expect(treats.map(({ distance }) => Math.floor((distance - 100) / 300))).toEqual([0, 1, 2]);
    }
  });
});

describe("laneReach", () => {
  it("counts the whole lane moves that fit in the clear road between rows", () => {
    expect(laneReach(tight)).toEqual({ betweenRows: 1, entry: 4 });
    expect(laneReach({ ...tight, scrollSpeed: 200 })).toEqual({ betweenRows: 0, entry: 2 });
  });

  it("never reaches further than the road is wide", () => {
    expect(laneReach({ ...plan, laneMoveSeconds: 0 })).toEqual({ betweenRows: 4, entry: 4 });
  });
});

describe("laneMask", () => {
  it("sets bit n for lane n", () => {
    expect(laneMask([0, 2, 4])).toBe(0b10101);
    expect(laneMask([])).toBe(0);
  });
});

describe("everyLaneReaches", () => {
  const notLane1 = ~laneMask([1]);

  it("is true when every lane has a target within reach", () => {
    expect(everyLaneReaches(1, laneMask([0, 2]), laneMask([1]))).toBe(true);
  });

  it("is false when one lane has no target within reach", () => {
    expect(everyLaneReaches(1, laneMask([0, 4]), laneMask([1]))).toBe(false);
    expect(everyLaneReaches(4, laneMask([0]), 0)).toBe(false);
  });

  it("is true when there are no lanes to reach from", () => {
    expect(everyLaneReaches(0, 0, 0)).toBe(true);
  });

  it("is false when the only way crosses a lane that is not clear", () => {
    expect(everyLaneReaches(2, laneMask([0]), laneMask([2]), notLane1)).toBe(false);
    expect(everyLaneReaches(2, laneMask([0]), laneMask([0, 2]), notLane1)).toBe(true);
  });
});

describe("takeDueSpawns", () => {
  const events = [
    { distance: 100, kind: "tip", lane: 0 },
    { distance: 200, kind: "obstacle", lane: 1 },
    { distance: 300, kind: "tip", lane: 2 },
  ];

  it("splits the events into those reached and those still ahead", () => {
    expect(takeDueSpawns(250, events)).toEqual({ due: events.slice(0, 2), pending: [events[2]] });
  });

  it("counts an event as due at exactly its distance", () => {
    expect(takeDueSpawns(200, events).due).toEqual(events.slice(0, 2));
    expect(takeDueSpawns(199.9, events).due).toEqual(events.slice(0, 1));
  });
});
