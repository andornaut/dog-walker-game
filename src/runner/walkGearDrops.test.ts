import { describe, expect, it } from "vitest";

import { LANE_COUNT } from "../data/screen";
import { SHOP_GEAR } from "../data/shop";
import type { GearId } from "../data/types";
import { WORLD } from "../data/world";
import { gearDropCount, gearInEffect } from "../rules/gearDrops";
import { plannerStreams } from "../testing/movers";
import { GAME_ROAD, inZone, REAL, realRun } from "../testing/planner";
import { atPack, inLane, step, walkWith } from "../testing/walk";
import { spacedStretch } from "./spawning";
import { isGearDrop, planZone, spawnQuotas, startRoad, type Walk, zoneLength } from "./walk";

const GEAR = Object.keys(SHOP_GEAR) as GearId[];
const POSITIONS = Array.from({ length: WORLD.walkLength }, (_, position) => position);
// The seeds the quota draws sample, and the fewer the planner's placements do, each zone's plan
// taking a few hundred milliseconds.
const SEEDS = Array.from({ length: 12 }, (_, i) => i + 1);
const PLAN_SEEDS = SEEDS.slice(0, 4);

// The real run in the last zone at a walk position, with the Pocket's gear.
const zonedRun = (position: number, pocket: GearId | null = null) => ({
  ...inZone(realRun(REAL), WORLD.lastZone, position),
  gear: pocket,
});

describe("gear drops on the road", () => {
  it.each(GEAR)("grabs a %s drop the pack touches, for the rest of the walk", (gear) => {
    const walk = inLane(2, walkWith(["kilo"], [atPack(gear)]));
    const grabbed = step(walk);
    expect(grabbed.found.map((find) => [find.gear, find.replaced])).toEqual([[gear, null]]);
    expect(grabbed.collected.map(({ kind }) => kind)).toEqual([gear]);
    expect(grabbed.walk.road.items).toEqual([]);
    expect(gearInEffect(grabbed.walk.run)).toEqual([gear]);
    // No hit: no bump, no card, and no grace window.
    expect(grabbed.bumps).toEqual([]);
    expect(grabbed.cards).toEqual([]);
    expect(grabbed.walk.road.invulnerableSeconds).toBe(0);
  });

  it.each(GEAR)("swaps the found item for a %s drop the pack touches", (gear) => {
    const found = GEAR.find((other) => other !== gear) ?? gear;
    const walk = inLane(2, walkWith(["kilo"], [atPack(gear)]));
    const swapped = step({ ...walk, run: { ...walk.run, foundGear: found } });
    expect(swapped.found.map((find) => [find.gear, find.replaced])).toEqual([[gear, found]]);
    expect(swapped.walk.run.foundGear).toBe(gear);
  });

  it.each(GEAR)("loses a %s drop the pack misses", (gear) => {
    let walk: Walk = inLane(0, walkWith(["kilo"], [atPack(gear)]));
    for (let i = 0; i < 100 && walk.road.items.length > 0; i++) {
      const stepped = step(walk, 0.1);
      expect(stepped.found).toEqual([]);
      walk = stepped.walk;
    }
    expect(walk.road.items).toEqual([]);
    expect(walk.run.foundGear).toBeNull();
  });
});

describe("gear drop planning", () => {
  // Each zone's drops, counted and placed as the planner places them.
  // The zone's gear drop quotas, drawn as the planner draws them.
  const quotasOf = (position: number, seed: number, pocket: GearId | null = null) =>
    spawnQuotas(REAL, plannerStreams(seed), zonedRun(position, pocket)).filter(({ kind }) =>
      isGearDrop(REAL, kind),
    );
  // The zone's drops as the planner places them.
  const dropsOf = (position: number, seed: number) =>
    planZone(REAL, GAME_ROAD, plannerStreams(seed), {
      road: startRoad(LANE_COUNT),
      run: zonedRun(position),
    }).road.pending.filter(({ kind }) => isGearDrop(REAL, kind));

  it.each(POSITIONS)(
    "plans as many drops as the count rule draws at walk position %i, each its own item",
    (position) => {
      const counts = new Set<number>();
      for (const seed of PLAN_SEEDS) {
        const [drops, quotas] = [dropsOf(position, seed), quotasOf(position, seed)];
        expect(quotas.every(({ blocksLane, count }) => !blocksLane && count === 1)).toBe(true);
        expect(new Set(quotas.map(({ kind }) => kind)).size).toBe(quotas.length);
        expect(drops.map(({ kind }) => kind).sort()).toEqual(quotas.map(({ kind }) => kind).sort());
        counts.add(quotas.length);
      }
      const possible = [
        gearDropCount(REAL.tuning, () => 0.9999, position),
        gearDropCount(REAL.tuning, () => 0, position),
      ];
      expect([...counts].every((count) => possible.includes(count))).toBe(true);
    },
  );

  it.each(POSITIONS)("plans the same drops from the same seed at walk position %i", (position) => {
    expect(dropsOf(position, 1)).toEqual(dropsOf(position, 1));
  });

  // The planner places each quota it draws, so the Pocket's item is checked among the quotas.
  it.each(GEAR)("never drops the Pocket's %s", (pocket) => {
    for (const position of POSITIONS) {
      for (const seed of SEEDS) {
        expect(quotasOf(position, seed, pocket).map(({ kind }) => kind)).not.toContain(pocket);
      }
    }
  });

  it.each([1, 2, 3])("gives %i drops stretches of the zone a stretch apart", (count) => {
    const stretches = Array.from({ length: count }, (_, i) => spacedStretch(count, i));
    expect(stretches[0]?.[0]).toBe(0);
    expect(stretches.at(-1)?.[1]).toBe(1);
    for (const [i, [from, to]] of stretches.entries()) {
      expect(to - from).toBeCloseTo(1 / (2 * count - 1));
      const next = stretches[i + 1];
      if (next !== undefined) {
        expect(next[0] - to).toBeCloseTo(to - from);
      }
    }
  });

  it("places a zone's two drops at least a third of the zone apart, each in its stretch", () => {
    const tuning = {
      ...REAL.tuning,
      counts: { ...REAL.tuning.counts, gearDropsPerZone: { 1: 2, 2: 2, 3: 2, 4: 2 } },
    };
    const real = { ...REAL, tuning };
    const length = zoneLength(real);
    for (const position of POSITIONS) {
      for (const seed of PLAN_SEEDS) {
        const { pending } = planZone(real, GAME_ROAD, plannerStreams(seed), {
          road: startRoad(LANE_COUNT),
          run: zonedRun(position),
        }).road;
        const drops = pending.filter(({ kind }) => isGearDrop(real, kind));
        expect(drops, `seed ${seed} at ${position}`).toHaveLength(2);
        const [first, second] = drops.map(({ distance }) => distance) as [number, number];
        expect(second - first, `seed ${seed} at ${position}`).toBeGreaterThanOrEqual(
          length / 3 - real.tuning.pixels.spawnRowSpacing,
        );
      }
    }
  });
});
