import { describe, expect, it } from "vitest";

import { DOGS } from "../data/dogs";
import { TUNING as REAL_TUNING } from "../data/tuning";
import type { Modifier, PackSize } from "../data/types";
import { TEST_TUNING } from "../testing/tuning";
import { maxHearts, packSizeBonus, packSizeRaise, sizeHearts, startHearts } from "./dogs";
import { zoneStats } from "./zones";

const PACK_SIZES: readonly PackSize[] = [1, 2, 3];

describe("dog stats", () => {
  it("starts every owner full, with or without a raised max, in a pack of any size", () => {
    for (const [, modifiers] of [
      ["with no gear", []],
      ["with a raised max", [{ by: "luckyCollarMax", operation: "add", stat: "maxHearts" }]],
    ] satisfies readonly [string, readonly Modifier[]][]) {
      for (const packSize of PACK_SIZES) {
        for (const dog of Object.values(DOGS)) {
          expect(startHearts(TEST_TUNING, modifiers, packSize, dog)).toBe(
            maxHearts(TEST_TUNING, modifiers, packSize, dog),
          );
        }
      }
    }
  });

  it.each(PACK_SIZES)("adds a pack of %i's bonus to every owner's max, under the cap", (size) => {
    const { hearts } = TEST_TUNING;
    const bonus = hearts.packSizeBonus[size];
    expect(packSizeBonus(TEST_TUNING, size)).toBe(bonus);
    for (const dog of Object.values(DOGS)) {
      const max = Math.min(hearts.maxOwnerHearts, sizeHearts(TEST_TUNING, dog) + bonus);
      expect(maxHearts(TEST_TUNING, [], size, dog)).toBe(max);
      expect(packSizeRaise(TEST_TUNING, [], size, dog)).toBe(max - sizeHearts(TEST_TUNING, dog));
    }
  });

  it.each(PACK_SIZES)("holds every owner's max to the cap walking %i, gear and all", (size) => {
    const collar: readonly Modifier[] = [
      { by: "luckyCollarMax", operation: "add", stat: "maxHearts" },
    ];
    for (const dog of Object.values(DOGS)) {
      expect(maxHearts(REAL_TUNING, collar, size, dog)).toBeLessThanOrEqual(
        REAL_TUNING.hearts.maxOwnerHearts,
      );
    }
  });
});

describe("zoneStats", () => {
  const plain = { density: { luckyFinds: 1, obstacles: 1, tips: 1 }, speed: 1 };

  it("raises the speed per zone, so the same distance takes less time", () => {
    const first = zoneStats(TEST_TUNING, plain, 0);
    const fourth = zoneStats(TEST_TUNING, plain, 3);
    expect(first.scrollSpeed).toBe(80);
    expect(fourth.scrollSpeed).toBeCloseTo(80 * 1.6);
    expect(first.duration).toBe(240);
    expect(fourth.duration).toBeCloseTo(240 / 1.6);
  });

  it("adds obstacles and tips per later zone", () => {
    const { counts } = TEST_TUNING;
    expect(zoneStats(TEST_TUNING, plain, 2).obstacles).toBe(
      counts.obstaclesFirstZone + 2 * counts.obstaclesGainPerZone,
    );
    expect(zoneStats(TEST_TUNING, plain, 2).tips).toBe(
      counts.tipsFirstZone + 2 * counts.tipsGainPerZone,
    );
  });

  it("multiplies the speed and the counts by the zone's own, rounding the counts", () => {
    const { counts } = TEST_TUNING;
    const busy = { density: { luckyFinds: 2, obstacles: 0.5, tips: 1.5 }, speed: 1.25 };
    const stats = zoneStats(TEST_TUNING, busy, 0);
    expect(stats.scrollSpeed).toBe(80 * 1.25);
    expect(stats.duration).toBe(240 / 1.25);
    expect(stats.obstacles).toBe(Math.round(counts.obstaclesFirstZone * 0.5));
    expect(stats.tips).toBe(Math.round(counts.tipsFirstZone * 1.5));
    expect(stats.luckyEncounters).toBe(counts.luckyEncountersPerZone * 2);
  });
});
