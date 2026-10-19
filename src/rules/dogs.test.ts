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

  it("halves how often a dog pulls with Steady hands, which doubles the interval", () => {
    const steadyHands: Modifier = {
      by: "steadyHandsPullFrequency",
      operation: "multiply",
      stat: "pullFrequency",
    };
    expect(pullIntervalSeconds(TEST_TUNING, [steadyHands], DOGS.zippy)).toBe(30);
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
