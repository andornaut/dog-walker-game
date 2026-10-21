import { describe, expect, it } from "vitest";

import { ROAD_HIT_SIZE } from "../assets/spriteKeys";
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
  packPlacements,
  sideDx,
  tallestPackBand,
  tautLeashLine,
  WALKER_HANDS,
} from "./packFormation";

const WALKER = { feetY: 68 };
// A big, a medium and a small dog, as drawn.
const DOGS: readonly DrawnDog[] = [
  { feetY: 52, frameHeight: 54, opaqueWidth: 36 },
  { feetY: 45, frameHeight: 48, opaqueWidth: 24 },
  { feetY: 36, frameHeight: 38, opaqueWidth: 19 },
];
const packOf = (count: number) => DOGS.slice(0, count);

const LANE_WIDTH = SCREEN_CONFIG.roadWidth / LANE_COUNT;
const FOOT_Y = 634;

describe("packPlacements", () => {
  // One dog per pack member, all ahead of the walker, each hit box within the lane.
  it.each([1, 2, 3])("places a pack of %d ahead of the walker, within the lane", (count) => {
    const placements = hitPackPlacements(count);
    expect(placements).toHaveLength(count);
    for (const { dx, footDy } of placements) {
      expect(footDy).toBeLessThan(0);
      expect(Math.abs(dx) + ROAD_HIT_SIZE / 2).toBeLessThanOrEqual(LANE_WIDTH / 2);
    }
  });

  // The laid-out sides and stagger at the draw scale, its nearest dog packClearance up.
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

  // No hit box sits farther out than its drawn dog.
  it.each(DOGS.map((dog) => [dog.opaqueWidth, dog] as const))(
    "keeps a %dpx-wide side dog inside the lane's edge, outside its hit box",
    (_width, dog) => {
      const [left, right] = packPlacements(WALKER, [dog, dog]).map(({ dx }) => dx);
      expect(right).toBe(sideDx(dog.opaqueWidth));
      expect(left).toBe(-sideDx(dog.opaqueWidth));
      expect(sideDx(dog.opaqueWidth) + dog.opaqueWidth / 2).toBeLessThanOrEqual(laneHalfWidth());
      expect(sideDx(dog.opaqueWidth) + dog.opaqueWidth / 2).toBeGreaterThan(laneHalfWidth() - 1);
      const hit = hitPackPlacements(2).map(({ dx }) => Math.abs(dx));
      expect(Math.min(Math.abs(left ?? 0), Math.abs(right ?? 0))).toBeGreaterThanOrEqual(
        Math.max(...hit),
      );
    },
  );

  // The drawn band reaches higher than the hit band, and on down to the walker's legs.
  it.each([1, 2, 3])("draws a pack of %d's band around its hit band", (count) => {
    const clearance = packClearance(WALKER, packOf(count));
    const hit = packBand(count, FOOT_Y);
    const drawn = drawnPackBand(count, FOOT_Y, clearance);
    expect(drawn.top).toBeLessThan(FOOT_Y - clearance);
    expect(drawn.top).toBeLessThan(hit.top);
    expect(drawn.bottom).toBeGreaterThan(hit.bottom);
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
  // Each dog's box is ROAD_HIT_SIZE tall, standing on its feet.
  it.each([1, 2, 3])("runs from the lead dog's box top to the last dog's feet, for %i", (count) => {
    const feet = hitPackPlacements(count).map(({ footDy }) => 634 + footDy);
    expect(packBand(count, 634)).toEqual({
      bottom: Math.max(...feet),
      top: Math.min(...feet) - ROAD_HIT_SIZE,
    });
  });
});

describe("tallestPackBand", () => {
  it("is the height of the tallest formation's band", () => {
    const { bottom, top } = packBand(3, 634);
    expect(tallestPackBand(634)).toBe(bottom - top);
  });
});
