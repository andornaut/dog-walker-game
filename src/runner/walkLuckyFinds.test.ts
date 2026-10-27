import { describe, expect, it } from "vitest";

import { LANE_COUNT } from "../data/screen";
import type { EncounterId, ZoneId } from "../data/types";
import { WORLD } from "../data/world";
import { currentZone } from "../rules/route";
import { zoneStats } from "../rules/zones";
import { plannerStreams } from "../testing/movers";
import { GAME_ROAD, inZone, LUCKY_IDS, REAL, type Real, realRun } from "../testing/planner";
import { itemCategory, planZone, spawnQuotas, startRoad, zoneLength } from "./walk";

// The seeds the quota draws sample, and the fewer the planner's placements do, each zone's plan
// taking a few hundred milliseconds.
const SEEDS = Array.from({ length: 12 }, (_, i) => i + 1);
const PLAN_SEEDS = SEEDS.slice(0, 2);
// Every zone at every walk position it can be walked at.
const PLACES = WORLD.zones.flatMap(({ id }): { position: number; zone: ZoneId }[] =>
  id === WORLD.firstZone
    ? [{ position: 0, zone: id as ZoneId }]
    : id === WORLD.lastZone
      ? [{ position: WORLD.walkLength - 1, zone: id as ZoneId }]
      : Array.from({ length: WORLD.walkLength - 2 }, (_, i) => ({
          position: i + 1,
          zone: id as ZoneId,
        })),
);

const isLucky = (kind: string) => itemCategory(REAL, kind as EncounterId) === "lucky";

type Place = { position: number; zone: ZoneId };
const zonedRun = (tuned: Real, place: Place) => inZone(realRun(tuned), place.zone, place.position);
// A zone's lucky find quotas, drawn as the planner draws them.
const quotasOf = (tuned: Real, place: Place, seed: number) =>
  spawnQuotas(tuned, plannerStreams(seed), zonedRun(tuned, place)).filter(({ kind }) =>
    isLucky(kind),
  );
// A zone's lucky finds as the planner places them.
const findsOf = (tuned: Real, place: Place, seed: number) =>
  planZone(tuned, GAME_ROAD, plannerStreams(seed), {
    road: startRoad(LANE_COUNT),
    run: zonedRun(tuned, place),
  }).road.pending.filter(({ kind }) => isLucky(kind));

// The data with every lucky find counted per zone as counts has it, and every zone's lucky finds
// at a density of 1.
const tunedWith = (counts: Readonly<Record<string, number>>): Real => ({
  ...REAL,
  tuning: {
    ...REAL.tuning,
    counts: {
      ...REAL.tuning.counts,
      luckyFindsPerZone: { ...REAL.tuning.counts.luckyFindsPerZone, ...counts },
    },
  },
  world: {
    ...REAL.world,
    zones: REAL.world.zones.map((zone) => ({
      ...zone,
      density: { ...zone.density, luckyFinds: 1 },
    })) as unknown as Real["world"]["zones"],
  },
});

// Each zone at the first walk position it can be walked at, for the slower sweeps.
const FIRST_PLACES = PLACES.filter(
  (place, i) => PLACES.findIndex(({ zone }) => zone === place.zone) === i,
);

describe("lucky finds", () => {
  it.each(PLACES)(
    "places each kind's count, its expected count rounded either way, in $zone at position $position",
    (place) => {
      const run = zonedRun(REAL, place);
      const expected = zoneStats(REAL.tuning, currentZone(REAL, run), place.position).luckyFinds;
      const countOf = (kinds: readonly { kind: string }[], kind: string) =>
        kinds.filter((quota) => quota.kind === kind).length;
      for (const seed of SEEDS) {
        const quotas = quotasOf(REAL, place, seed);
        for (const kind of LUCKY_IDS) {
          const mean = expected[kind as keyof typeof expected];
          expect([Math.floor(mean), Math.ceil(mean)], `seed ${seed}: ${kind}`).toContain(
            countOf(quotas, kind),
          );
        }
        expect(quotas.every(({ blocksLane, count }) => !blocksLane && count === 1)).toBe(true);
      }
      for (const seed of PLAN_SEEDS) {
        const [quotas, finds] = [quotasOf(REAL, place, seed), findsOf(REAL, place, seed)];
        for (const kind of LUCKY_IDS) {
          expect(countOf(finds, kind), `seed ${seed}: ${kind}`).toBe(countOf(quotas, kind));
        }
      }
    },
  );

  it.each(FIRST_PLACES)("places the same finds from the same seed in $zone", (place) => {
    expect(findsOf(REAL, place, 1)).toEqual(findsOf(REAL, place, 1));
  });

  // Two or three finds, a walking neighbour among them where the zone's mover share has one walk,
  // each in its own spaced stretch of the zone.
  const SPACINGS = [
    { counts: { lostWallet: 2, pettingNeighbour: 0 }, finds: 2 },
    { counts: { lostWallet: 1, pettingNeighbour: 1 }, finds: 2 },
    { counts: { lostWallet: 2, pettingNeighbour: 1 }, finds: 3 },
  ];
  it.each(SPACINGS.flatMap((spacing) => FIRST_PLACES.map((place) => ({ ...spacing, ...place }))))(
    "spaces $finds finds a stretch apart in $zone: $counts",
    ({ counts, finds, position, zone }) => {
      const tuned = tunedWith(counts);
      const stretch = zoneLength(tuned) / (2 * finds - 1);
      for (const seed of PLAN_SEEDS) {
        const placed = findsOf(tuned, { position, zone }, seed).map(({ distance }) => distance);
        expect(placed, `seed ${seed}`).toHaveLength(finds);
        const sorted = [...placed].sort((a, b) => a - b);
        for (const [i, distance] of sorted.slice(1).entries()) {
          expect(distance - (sorted[i] ?? 0), `seed ${seed}`).toBeGreaterThanOrEqual(
            stretch - tuned.tuning.pixels.spawnRowSpacing,
          );
        }
      }
    },
  );
});
