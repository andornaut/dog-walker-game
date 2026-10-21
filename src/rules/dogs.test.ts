import { describe, expect, it } from "vitest";

import { DOGS } from "../data/dogs";
import type { Modifier } from "../data/types";
import { TEST_TUNING } from "../testing/tuning";
import { maxHearts, startHearts } from "./dogs";
import { zoneStats } from "./zones";

describe("dog stats", () => {
  it.each(Object.values(DOGS))("derives $name's max hearts from its size", (dog) => {
    expect(maxHearts(TEST_TUNING, [], dog)).toBe(TEST_TUNING.hearts.maxBySize[dog.size]);
  });

  it.each<[string, readonly Modifier[]]>([
    ["with no gear", []],
    ["with a raised max", [{ by: "luckyCollarMax", operation: "add", stat: "maxHearts" }]],
  ])("starts every owner full, %s", (_, modifiers) => {
    for (const dog of Object.values(DOGS)) {
      expect(startHearts(TEST_TUNING, modifiers, dog)).toBe(maxHearts(TEST_TUNING, modifiers, dog));
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
