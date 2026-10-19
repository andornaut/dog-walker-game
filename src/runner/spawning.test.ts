import { describe, expect, it } from "vitest";

import { defined } from "../testing/defined";
import { seededRandom } from "./random";
import {
  everyLaneReaches,
  laneReach,
  planSpawns,
  type SpawnEvent,
  type SpawnPlan,
  spawnRowDistances,
  takeDueSpawns,
} from "./spawning";

type Kind = "obstacle" | "tip" | "treat";

// 9 rows at 100..900, 5 lanes. 50px of clear road between rows at 100px/s is 0.5s,
// time for 5 moves of 0.1s, so the pack can reach any lane from any row.
const plan: SpawnPlan<Kind> = {
  blockingLength: 50,
  laneCount: 5,
  laneMoveSeconds: 0.1,
  minSpacing: 100,
  quotas: [
    { blocksLane: true, count: 6, kind: "obstacle" },
    { blocksLane: false, count: 9, kind: "tip" },
    { blocksLane: false, count: 3, kind: "treat" },
  ],
  scrollSpeed: 100,
  zoneLength: 1000,
};

// 0.3s between rows fits one 0.25s move; the 1.3s into the first row fits five.
const tight: SpawnPlan<Kind> = {
  ...plan,
  blockingLength: 70,
  laneMoveSeconds: 0.25,
  quotas: [
    { blocksLane: true, count: 27, kind: "obstacle" },
    { blocksLane: false, count: 9, kind: "tip" },
  ],
};

// The lanes no obstacle takes, row by row.
function openLanesByRow(events: SpawnEvent<Kind>[]): number[][] {
  return spawnRowDistances(100, 1000).map((distance) => {
    const blocked = events
      .filter((event) => event.distance === distance && event.kind === "obstacle")
      .map((event) => event.lane);
    return [0, 1, 2, 3, 4].filter((lane) => !blocked.includes(lane));
  });
}

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
  });

  it("rejects a spacing that is not positive", () => {
    expect(() => spawnRowDistances(0, 1000)).toThrow();
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

  it("throws when the zone has no room for the obstacles asked for", () => {
    const tooMany: SpawnPlan<Kind> = {
      ...plan,
      quotas: [{ blocksLane: true, count: 9 * 4 + 1, kind: "obstacle" }],
    };
    expect(() => planSpawns(seededRandom(1), tooMany)).toThrow(/obstacle/);
  });

  it("leaves an open lane within one move of every open lane on the row before", () => {
    for (const seed of seeds) {
      const open = openLanesByRow(planSpawns(seededRandom(seed), tight));
      open.slice(1).forEach((lanes, i) => {
        for (const from of defined(open[i])) {
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

  it("throws when the rows are too close for the pack to pass between them", () => {
    expect(() => planSpawns(seededRandom(1), { ...plan, blockingLength: 101 })).toThrow(
      /minSpacing/,
    );
  });

  it("throws when no obstacle can be placed without blocking every reachable lane", () => {
    // 100px of road into the first row at 100px/s is 1s, less than one 2s move, so every
    // lane of the first row must stay open, and then of every row after it.
    const unreachable: SpawnPlan<Kind> = {
      ...plan,
      blockingLength: 100,
      laneMoveSeconds: 2,
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

describe("everyLaneReaches", () => {
  it("is true when every lane has a target within reach", () => {
    expect(everyLaneReaches(1, [0, 2], [1])).toBe(true);
  });

  it("is false when one lane has no target within reach", () => {
    expect(everyLaneReaches(1, [0, 4], [1])).toBe(false);
    expect(everyLaneReaches(4, [0], [])).toBe(false);
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
