import { describe, expect, it } from "vitest";

import {
  leashHand,
  packBand,
  packPlacements,
  tallestPackBand,
  WALKER_HANDS,
} from "./packFormation";

describe("packPlacements", () => {
  it("places one dog per pack member, all ahead of the walker", () => {
    for (const count of [1, 2, 3]) {
      const placements = packPlacements(count);
      expect(placements).toHaveLength(count);
      for (const { footDy } of placements) {
        expect(footDy).toBeLessThan(0);
      }
    }
  });

  it("keeps every dog's 32px sprite within its 56px lane, centred on the walker", () => {
    for (const count of [1, 2, 3]) {
      for (const { dx } of packPlacements(count)) {
        expect(Math.abs(dx) + 16).toBeLessThanOrEqual(56 / 2 + 2);
      }
    }
  });

  it("staggers dogs side by side so no two share a spot", () => {
    const spots = packPlacements(3).map(({ dx, footDy }) => `${dx},${footDy}`);
    expect(new Set(spots).size).toBe(3);
  });

  it("clamps an out-of-range count to the nearest formation", () => {
    expect(packPlacements(0)).toEqual(packPlacements(1));
    expect(packPlacements(5)).toEqual(packPlacements(3));
  });
});

describe("leashHand", () => {
  it("holds a dog on the left in the left hand, and the rest in the right", () => {
    expect(leashHand({ dx: -12, footDy: -40 }).dx).toBe(WALKER_HANDS.leftDx);
    expect(leashHand({ dx: 0, footDy: -40 }).dx).toBe(WALKER_HANDS.rightDx);
    expect(leashHand({ dx: 12, footDy: -40 }).dy).toBe(-WALKER_HANDS.heightAboveFeet);
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
