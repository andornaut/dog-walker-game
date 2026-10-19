import { describe, expect, it } from "vitest";

import { seededRandom } from "./random";
import { planSpawns, type SpawnPlan, spawnRowDistances, takeDueSpawns } from "./spawning";

type Kind = "obstacle" | "tip" | "treat";

// 9 rows at 100..900, 5 lanes.
const plan: SpawnPlan<Kind> = {
  laneCount: 5,
  minSpacing: 100,
  quotas: [
    { blocksLane: true, count: 6, kind: "obstacle" },
    { blocksLane: false, count: 9, kind: "tip" },
    { blocksLane: false, count: 3, kind: "treat" },
  ],
  zoneLength: 1000,
};

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

  it("spreads each kind over the zone, one per equal stretch of rows", () => {
    // 3 treats over 9 rows: one in rows 100-300, one in 400-600, one in 700-900.
    for (const seed of seeds) {
      const treats = planSpawns(seededRandom(seed), plan).filter((e) => e.kind === "treat");
      expect(treats.map(({ distance }) => Math.floor((distance - 100) / 300))).toEqual([0, 1, 2]);
    }
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
