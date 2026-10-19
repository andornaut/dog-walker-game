import { describe, expect, it } from "vitest";

import { DOGS } from "../data/dogs";
import type { Modifier } from "../data/types";
import { TEST_TUNING } from "../testing/tuning";
import {
  catchChance,
  inputLockSeconds,
  maxHearts,
  pullIntervalSeconds,
  startHearts,
  zoneFee,
} from "./dogs";
import { zoneStats } from "./zones";

describe("dog stats", () => {
  it("derives start and max hearts, fee, pull interval, input lock and catch chance", () => {
    const { duchess, waffles } = DOGS;
    expect(startHearts(TEST_TUNING, [], duchess)).toBe(6);
    expect(maxHearts(TEST_TUNING, [], waffles)).toBe(10);
    expect(zoneFee(TEST_TUNING, [], waffles)).toBe(1300);
    expect(pullIntervalSeconds(TEST_TUNING, [], waffles)).toBe(60);
    expect(inputLockSeconds(TEST_TUNING, [], waffles)).toBe(0.5);
    expect(catchChance(TEST_TUNING, duchess)).toBe(0.25);
  });

  it("divides the pull interval by a pullFrequency factor", () => {
    // No content halves pulls now; any 0.5 factor stands in for one that does.
    const halfAsOften: Modifier = { by: "stinkyTip", operation: "multiply", stat: "pullFrequency" };
    expect(pullIntervalSeconds(TEST_TUNING, [halfAsOften], DOGS.zippy)).toBe(30);
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
});

describe("zoneStats", () => {
  it("raises the speed per zone, so the same distance takes less time", () => {
    const first = zoneStats(TEST_TUNING, 0);
    const fourth = zoneStats(TEST_TUNING, 3);
    expect(first.scrollSpeed).toBe(80);
    expect(fourth.scrollSpeed).toBeCloseTo(80 * 1.6);
    expect(first.duration).toBe(240);
    expect(fourth.duration).toBeCloseTo(240 / 1.6);
  });

  it("adds obstacles and tips per later zone", () => {
    const { counts } = TEST_TUNING;
    expect(zoneStats(TEST_TUNING, 2).obstacles).toBe(
      counts.obstaclesFirstZone + 2 * counts.obstaclesGainPerZone,
    );
    expect(zoneStats(TEST_TUNING, 2).tips).toBe(counts.tipsFirstZone + 2 * counts.tipsGainPerZone);
  });
});
