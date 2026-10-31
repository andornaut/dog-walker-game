import { describe, expect, it } from "vitest";

import { DOGS } from "../data/dogs";
import type { Modifier } from "../data/types";
import { activeModifier, testState } from "../testing/runState";
import { TEST_TUNING } from "../testing/tuning";
import {
  maxHearts,
  ownerMaxHearts,
  packPlace,
  packSizeBonus,
  packSizeRaise,
  sizeHearts,
  startHearts,
} from "./dogs";
import { zoneStats } from "./zones";

const collar: readonly Modifier[] = [{ by: "luckyCollarMax", operation: "add", stat: "maxHearts" }];

describe("dog stats", () => {
  it.each([
    ["small", { lead: true, size: 2 }, []],
    ["medium", { lead: false, size: 3 }, collar],
    ["large", { lead: true, size: 1 }, collar],
  ] as const)(
    "starts a %s dog's owner full, including raised and capped maxima",
    (size, place, modifiers) => {
      const dog = { size };
      expect(startHearts(TEST_TUNING, modifiers, place, dog)).toBe(
        maxHearts(TEST_TUNING, modifiers, place, dog),
      );
    },
  );

  it.each([
    ["small", { lead: true, size: 1 }],
    ["medium", { lead: true, size: 2 }],
    ["large", { lead: true, size: 3 }],
    ["small", { lead: false, size: 2 }],
    ["medium", { lead: false, size: 3 }],
  ] as const)("adds only the lead's pack-size bonus to a %s dog's max at %j", (size, place) => {
    const dog = { size };
    const bonus = place.lead ? TEST_TUNING.hearts.packSizeBonus[place.size] : 0;
    expect(packSizeBonus(TEST_TUNING, place)).toBe(bonus);
    expect(maxHearts(TEST_TUNING, [], place, dog)).toBe(sizeHearts(TEST_TUNING, dog) + bonus);
    expect(packSizeRaise(TEST_TUNING, [], place, dog)).toBe(bonus);
  });

  it("caps gear and pack bonuses together and reports only the remaining pack raise", () => {
    const place = { lead: true, size: 1 } as const;
    const dog = { size: "large" } as const;
    expect(maxHearts(TEST_TUNING, collar, place, dog)).toBe(TEST_TUNING.hearts.maxOwnerHearts);
    expect(packSizeRaise(TEST_TUNING, collar, place, dog)).toBe(1);
  });

  it.each([
    [["kilo"], "kilo", { lead: true, size: 1 }],
    [["kilo", "ginger"], "kilo", { lead: true, size: 2 }],
    [["kilo", "ginger"], "ginger", { lead: false, size: 2 }],
  ] as const)("places a dog in the pack %j: %s", (order, dog, place) => {
    expect(packPlace(order, dog)).toEqual(place);
  });
});

describe("ownerMaxHearts", () => {
  // A fired dog keeps its place, so the pack is the size it set out with.
  const collar = activeModifier(
    { gear: "luckyCollar", kind: "gear" },
    { by: "luckyCollarMax", operation: "add", stat: "maxHearts" },
  );
  const run = testState({ buddy: 2, kilo: 3, lady: "fired" }, { modifiers: [collar] });
  it.each([
    ["lady", { lead: true, size: 3 }],
    ["kilo", { lead: false, size: 3 }],
  ] as const)(
    "caps %s's owner at the max of its place in the pack it set out with",
    (dog, place) => {
      expect(ownerMaxHearts({ dogs: DOGS, tuning: TEST_TUNING }, run, dog)).toBe(
        maxHearts(TEST_TUNING, run.modifiers, place, DOGS[dog]),
      );
    },
  );
});

describe("zoneStats", () => {
  const plain = { density: { cards: 1, luckyFinds: 1, minorObstacles: 1, tips: 1 }, speed: 1 };

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
    const busy = {
      density: { cards: 0.5, luckyFinds: 2, minorObstacles: 0.75, tips: 1.5 },
      speed: 1.25,
    };
    const stats = zoneStats(TEST_TUNING, busy, 0);
    expect(stats.scrollSpeed).toBe(80 * 1.25);
    expect(stats.duration).toBe(240 / 1.25);
    expect(stats.minorObstacles).toBe(Math.round(counts.minorObstaclesFirstZone * 0.75));
    expect(stats.obstacles).toBe(Math.round(counts.obstaclesFirstZone * 0.5));
    expect(stats.tips).toBe(Math.round(counts.tipsFirstZone * 1.5));
    expect(stats.luckyFinds).toEqual(
      Object.fromEntries(
        Object.entries(counts.luckyFindsPerZone).map(([id, count]) => [id, count * 2]),
      ),
    );
  });
});
