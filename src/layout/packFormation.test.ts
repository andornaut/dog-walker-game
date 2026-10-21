import { describe, expect, it } from "vitest";

import { LANE_COUNT, SCREEN_CONFIG } from "../data/screen";
import {
  type DrawnDog,
  drawnPackBand,
  hitPackPlacements,
  laneHalfWidth,
  leashHand,
  PACK_DRAW_SCALE,
  packBand,
  packClearance,
  type PackPlacement,
  packPlacements,
  sideDx,
  tallestPackBand,
  tautLeashLine,
  WALKER_HANDS,
} from "./packFormation";

const WALKER = { feetY: 68 };
// A big, a medium and a small dog, as drawn.
const DOGS: readonly DrawnDog[] = [
  { feetY: 55, frameHeight: 58, opaqueWidth: 38 },
  { feetY: 45, frameHeight: 48, opaqueWidth: 24 },
  { feetY: 36, frameHeight: 38, opaqueWidth: 21 },
];
const packOf = (count: number) => DOGS.slice(0, count);

// The widest dog's opaque pixels across a frame at the hit size.
const WIDEST_DOG = 24;
const LANE_WIDTH = SCREEN_CONFIG.roadWidth / LANE_COUNT;
const FOOT_Y = 634;

describe("packPlacements", () => {
  // One dog per pack member, all ahead of the walker, each dog within the lane at the hit size.
  it.each([1, 2, 3])("places a pack of %d ahead of the walker, within the lane", (count) => {
    const placements = hitPackPlacements(count);
    expect(placements).toHaveLength(count);
    for (const { dx, footDy } of placements) {
      expect(footDy).toBeLessThan(0);
      expect(Math.abs(dx) + WIDEST_DOG / 2).toBeLessThanOrEqual(LANE_WIDTH / 2);
    }
  });

  // The hit formation's sides and stagger at the draw scale, its nearest dog packClearance up.
  it.each([1, 2, 3])("draws a pack of %d at its hit stagger times the draw scale", (count) => {
    const dogs = packOf(count);
    const hit = hitPackPlacements(count);
    const nearest = Math.max(...hit.map(({ footDy }) => footDy));
    const clearance = packClearance(WALKER, dogs);
    const placements = packPlacements(WALKER, dogs);
    expect(placements.map(({ footDy }) => footDy)).toEqual(
      hit.map(({ footDy }) => Math.round((footDy - nearest) * PACK_DRAW_SCALE) - clearance),
    );
    expect(placements.map(({ dx }) => Math.sign(dx))).toEqual(hit.map(({ dx }) => Math.sign(dx)));
  });

  it.each([1, 2, 3])("draws every dog of a pack of %d ahead of the walker's frame", (count) => {
    const placements = packPlacements(WALKER, packOf(count));
    const nearest = Math.max(...placements.map(({ footDy }) => footDy));
    expect(nearest).toBe(-packClearance(WALKER, packOf(count)));
    expect(nearest).toBeLessThan(-WALKER.feetY);
  });

  it.each(DOGS.map((dog) => [dog.opaqueWidth, dog] as const))(
    "keeps a %dpx-wide side dog inside the lane's edge",
    (_width, dog) => {
      const [left, right] = packPlacements(WALKER, [dog, dog]).map(({ dx }) => dx);
      expect(right).toBe(sideDx(dog.opaqueWidth));
      expect(left).toBe(-sideDx(dog.opaqueWidth));
      expect(sideDx(dog.opaqueWidth) + dog.opaqueWidth / 2).toBeLessThanOrEqual(laneHalfWidth());
      expect(sideDx(dog.opaqueWidth) + dog.opaqueWidth / 2).toBeGreaterThan(laneHalfWidth() - 1);
    },
  );

  // The drawn band runs from the lead dog's feet less the hit body height at the draw scale to
  // the hit band's bottom at the draw scale, give or take each length's rounding.
  it.each([1, 2, 3])("draws a pack of %d's band from its drawn lead dog", (count) => {
    const clearance = packClearance(WALKER, packOf(count));
    const hit = packBand(count, FOOT_Y);
    const drawn = drawnPackBand(count, FOOT_Y, clearance);
    const leadOf = (placements: readonly PackPlacement[]) =>
      FOOT_Y + Math.min(...placements.map(({ footDy }) => footDy));
    const hitBody = leadOf(hitPackPlacements(count)) - hit.top;
    const drawnBody = leadOf(packPlacements(WALKER, packOf(count))) - drawn.top;
    expect(drawn.top).toBeLessThan(FOOT_Y - clearance);
    expect(Math.abs(drawnBody - hitBody * PACK_DRAW_SCALE)).toBeLessThanOrEqual(1);
    expect(
      Math.abs(FOOT_Y - drawn.bottom - (FOOT_Y - hit.bottom) * PACK_DRAW_SCALE),
    ).toBeLessThanOrEqual(1);
  });

  it("staggers dogs side by side so no two share a spot", () => {
    const spots = packPlacements(WALKER, DOGS).map(({ dx, footDy }) => `${dx},${footDy}`);
    expect(new Set(spots).size).toBe(3);
  });

  it("draws no dogs for an empty pack, and a larger pack in the largest formation", () => {
    expect(packPlacements(WALKER, [])).toEqual([]);
    expect(packPlacements(WALKER, [...DOGS, ...DOGS])).toEqual(packPlacements(WALKER, DOGS));
  });
});

describe("packClearance", () => {
  const walker = WALKER;
  it.each([
    ["the walker's frame above its feet, with no dogs", [], 68],
    ["and a dog's rows below its feet", [{ feetY: 45, frameHeight: 48 }], 71],
    [
      "and the most rows any dog has below its feet",
      [
        { feetY: 47, frameHeight: 48 },
        { feetY: 44, frameHeight: 48 },
      ],
      72,
    ],
  ])("is %s", (_name, dogs, expected) => {
    expect(packClearance(walker, dogs)).toBe(expected);
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
