import { describe, expect, it } from "vitest";

import { DOGS } from "../data/dogs";
import type { Modifier } from "../data/types";
import { TEST_TUNING } from "../testing/tuning";
import { inputLockSeconds, maxHearts, needUrgentSeconds, startHearts, zoneFee } from "./dogs";
import { zoneStats } from "./zones";

describe("dog stats", () => {
  it("derives start and max hearts, fee, need urgency and input lock", () => {
    const { duchess, penny } = DOGS;
    expect(startHearts(TEST_TUNING, [], duchess)).toBe(6);
    expect(maxHearts(TEST_TUNING, [], penny)).toBe(10);
    expect(zoneFee(TEST_TUNING, [], penny)).toBe(1300);
    expect(needUrgentSeconds(TEST_TUNING, penny)).toBe(100);
    expect(inputLockSeconds(TEST_TUNING, [], penny)).toBe(0.5);
  });

  it("starts an owner no higher than their dog's max", () => {
    // Duchess starts at her max, so a raised start without a raised max is clamped.
    const raisedStart: Modifier = { by: "luckyCollarStart", operation: "add", stat: "startHearts" };
    expect(startHearts(TEST_TUNING, [raisedStart], DOGS.duchess)).toBe(6);
  });

  it("removes the input lock with running shoes", () => {
    const runningShoes: Modifier = {
      by: "runningShoesInputLock",
      operation: "multiply",
      stat: "inputLock",
    };
    expect(inputLockSeconds(TEST_TUNING, [runningShoes], DOGS.koda)).toBe(0);
  });

  it("never locks input after an acrobatic dog's pull, whatever its size", () => {
    const doubled: Modifier = { by: "rushHourObstacles", operation: "multiply", stat: "inputLock" };
    const acrobat = { ...DOGS.koda, quirk: "acrobatic" } as const;
    expect(inputLockSeconds(TEST_TUNING, [], DOGS.koda)).toBe(0.5);
    expect(inputLockSeconds(TEST_TUNING, [], acrobat)).toBe(0);
    expect(inputLockSeconds(TEST_TUNING, [doubled], acrobat)).toBe(0);
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
