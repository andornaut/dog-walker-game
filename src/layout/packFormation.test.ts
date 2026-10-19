import { describe, expect, it } from "vitest";

import { LANE_COUNT, SCREEN_CONFIG } from "../data/screen";
import {
  leashHand,
  packBand,
  packPlacements,
  tallestPackBand,
  tautLeashLine,
  WALKER_HANDS,
} from "./packFormation";

// The widest dog's drawn pixels across its 40px frame.
const WIDEST_DOG = 24;
const LANE_WIDTH = SCREEN_CONFIG.roadWidth / LANE_COUNT;

describe("packPlacements", () => {
  // One dog per pack member, all ahead of the walker, each dog's drawn pixels within the lane.
  it.each([1, 2, 3])("places a pack of %d ahead of the walker, within the lane", (count) => {
    const placements = packPlacements(count);
    expect(placements).toHaveLength(count);
    for (const { dx, footDy } of placements) {
      expect(footDy).toBeLessThan(0);
      expect(Math.abs(dx) + WIDEST_DOG / 2).toBeLessThanOrEqual(LANE_WIDTH / 2);
    }
  });

  it("staggers dogs side by side so no two share a spot", () => {
    const spots = packPlacements(3).map(({ dx, footDy }) => `${dx},${footDy}`);
    expect(new Set(spots).size).toBe(3);
  });

  it.each([
    [0, 1],
    [5, 3],
  ])("clamps a count of %d to the formation for %d", (count, nearest) => {
    expect(packPlacements(count)).toEqual(packPlacements(nearest));
  });
});

describe("leashHand", () => {
  it("holds a dog on the left in the left hand, and the rest in the right", () => {
    expect(leashHand({ dx: -12, footDy: -40 }).dx).toBe(WALKER_HANDS.leftDx);
    expect(leashHand({ dx: 0, footDy: -40 }).dx).toBe(WALKER_HANDS.rightDx);
    expect(leashHand({ dx: 12, footDy: -40 }).dy).toBe(-WALKER_HANDS.heightAboveFeet);
  });
});

describe("tautLeashLine", () => {
  it.each([
    ["a steep leash a pixel left", { x: 10, y: 50 }, { x: 14, y: 20 }, { x: -1, y: 0 }],
    ["a shallow leash a pixel up", { x: 10, y: 50 }, { x: 40, y: 44 }, { x: 0, y: -1 }],
    [
      "a leash at 45 degrees left, as a steep one",
      { x: 0, y: 10 },
      { x: 10, y: 0 },
      { x: -1, y: 0 },
    ],
  ])("shifts %s", (_name, from, to, shift) => {
    const moved = (point: { x: number; y: number }) => ({
      x: point.x + shift.x,
      y: point.y + shift.y,
    });
    expect(tautLeashLine(from, to)).toEqual({ from: moved(from), to: moved(to) });
  });
});

describe("packBand", () => {
  it("runs from above the leading dog to just above the walker's feet", () => {
    const band = packBand(3, 634);
    expect(band.bottom).toBeLessThan(634);
    expect(band.top).toBeLessThan(634 - 58);
  });

  it("is taller for a pack whose lead dog walks further ahead", () => {
    const one = packBand(1, 634);
    const three = packBand(3, 634);
    expect(three.top).toBeLessThan(one.top);
    expect(three.bottom).toBe(one.bottom);
  });
});

describe("tallestPackBand", () => {
  it("is the height of the tallest formation's band", () => {
    const { bottom, top } = packBand(3, 634);
    expect(tallestPackBand(634)).toBe(bottom - top);
  });
});
