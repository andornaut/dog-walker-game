import { describe, expect, it } from "vitest";

import { DOGS } from "../data/dogs";
import { TUNING as REAL_TUNING } from "../data/tuning";
import type { Modifier } from "../data/types";
import { PACK_PLACES, placeName } from "../testing/packPlaces";
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

const PLACES = PACK_PLACES.map((place) => [placeName(place), place] as const);

describe("dog stats", () => {
  it("starts every owner full, with or without a raised max, in a pack of any size", () => {
    for (const [, modifiers] of [
      ["with no gear", []],
      ["with a raised max", [{ by: "luckyCollarMax", operation: "add", stat: "maxHearts" }]],
    ] satisfies readonly [string, readonly Modifier[]][]) {
      for (const place of PACK_PLACES) {
        for (const dog of Object.values(DOGS)) {
          expect(startHearts(TEST_TUNING, modifiers, place, dog)).toBe(
            maxHearts(TEST_TUNING, modifiers, place, dog),
          );
        }
      }
    }
  });

  it.each(PLACES)("adds the pack's bonus to the lead's owner's max only, %s", (_name, place) => {
    const { hearts } = TEST_TUNING;
    const bonus = place.lead ? hearts.packSizeBonus[place.size] : 0;
    expect(packSizeBonus(TEST_TUNING, place)).toBe(bonus);
    for (const dog of Object.values(DOGS)) {
      const max = Math.min(hearts.maxOwnerHearts, sizeHearts(TEST_TUNING, dog) + bonus);
      expect(maxHearts(TEST_TUNING, [], place, dog)).toBe(max);
      expect(packSizeRaise(TEST_TUNING, [], place, dog)).toBe(max - sizeHearts(TEST_TUNING, dog));
    }
  });

  it.each(PLACES)("holds every owner's max to the cap, gear and all, %s", (_name, place) => {
    const collar: readonly Modifier[] = [
      { by: "luckyCollarMax", operation: "add", stat: "maxHearts" },
    ];
    for (const dog of Object.values(DOGS)) {
      expect(maxHearts(REAL_TUNING, collar, place, dog)).toBeLessThanOrEqual(
        REAL_TUNING.hearts.maxOwnerHearts,
      );
    }
  });

  it.each([
    [["kilo"], "kilo", { lead: true, size: 1 }],
    [["kilo", "duchess"], "kilo", { lead: true, size: 2 }],
    [["kilo", "duchess"], "duchess", { lead: false, size: 2 }],
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
  const run = testState({ biscuit: "fired", kilo: 3, zippy: 2 }, { modifiers: [collar] });
  it.each([
    ["biscuit", { lead: true, size: 3 }],
    ["kilo", { lead: false, size: 3 }],
    ["zippy", { lead: false, size: 3 }],
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
