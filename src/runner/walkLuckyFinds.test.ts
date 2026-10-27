import { describe, expect, it } from "vitest";

import { LANE_COUNT } from "../data/screen";
import type { EncounterId, ZoneId } from "../data/types";
import { WORLD } from "../data/world";
import { currentZone } from "../rules/route";
import { zoneStats } from "../rules/zones";
import { plannerStreams } from "../testing/movers";
import { GAME_ROAD, inZone, LUCKY_IDS, REAL, type Real, realRun } from "../testing/planner";
import { itemCategory, planZone, spawnQuotas, startRoad, zoneLength } from "./walk";

const SEEDS = Array.from({ length: 12 }, (_, i) => i + 1);
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

// A zone's lucky finds as planned and as placed, for the data tuned.
function planned(tuned: Real, place: { position: number; zone: ZoneId }, seed: number) {
  const run = inZone(realRun(tuned), place.zone, place.position);
  const quotas = spawnQuotas(tuned, plannerStreams(seed), run).filter(({ kind }) => isLucky(kind));
  const { pending } = planZone(tuned, GAME_ROAD, plannerStreams(seed), {
    road: startRoad(LANE_COUNT),
    run,
  }).road;
  return { finds: pending.filter(({ kind }) => isLucky(kind)), quotas, run };
}

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
const FEW_SEEDS = [1, 2, 3];

describe("lucky finds", () => {
  it.each(PLACES)(
    "places each kind's count, its expected count rounded either way, in $zone at position $position",
    (place) => {
      for (const seed of SEEDS) {
        const { finds, quotas, run } = planned(REAL, place, seed);
        const expected = zoneStats(REAL.tuning, currentZone(REAL, run), place.position).luckyFinds;
        for (const kind of LUCKY_IDS) {
          const count = quotas.filter((quota) => quota.kind === kind).length;
          const mean = expected[kind as keyof typeof expected];
          expect([Math.floor(mean), Math.ceil(mean)], `seed ${seed}: ${kind}`).toContain(count);
          expect(
            finds.filter((find) => find.kind === kind),
            `seed ${seed}: ${kind}`,
          ).toHaveLength(count);
        }
        expect(quotas.every(({ blocksLane, count }) => !blocksLane && count === 1)).toBe(true);
      }
    },
  );

  it.each(FIRST_PLACES)("places the same finds from the same seed in $zone", (place) => {
    for (const seed of FEW_SEEDS) {
      expect(planned(REAL, place, seed).finds).toEqual(planned(REAL, place, seed).finds);
    }
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
      for (const seed of FEW_SEEDS) {
        const placed = planned(tuned, { position, zone }, seed).finds.map(
          ({ distance }) => distance,
        );
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
