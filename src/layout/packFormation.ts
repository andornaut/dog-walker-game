import { clampIndex, itemAt } from "../arrays";

// Where a dog walks, relative to the walker's feet: dx across, footDy up the screen
// (negative). Dogs walk just ahead of the walker in the same lane, staggered because three
// 32px dogs do not fit side by side in a 56px lane.
export interface PackPlacement {
  dx: number;
  footDy: number;
}

// Indexed by pack size - 1; the first dog picked leads.
const FORMATIONS: readonly (readonly PackPlacement[])[] = [
  [{ dx: 0, footDy: -44 }],
  [
    { dx: -12, footDy: -48 },
    { dx: 12, footDy: -44 },
  ],
  [
    { dx: 0, footDy: -58 },
    { dx: -14, footDy: -42 },
    { dx: 14, footDy: -40 },
  ],
];

// The pack's dogs are drawn at full size: their formation keeps them at a fixed depth just
// ahead of the walker (projected 0.92 to 0.94), so they never change size, and following the
// projection there would drop two or three pixel rows from every dog. Their status loops
// follow, at full size.
export const PACK_DEPTH = 1;

// The walker sprite's hands, relative to its feet.
export const WALKER_HANDS = { heightAboveFeet: 13, leftDx: -11, rightDx: 10 };
// A dog's collar, above its feet, on every 32x32 dog sprite.
export const COLLAR_HEIGHT = 14;
// How far a dog's body reaches up from its feet, for collisions.
const DOG_BODY_HEIGHT = 22;
// The walker's legs below the collision band, so things brushing their feet miss.
const WALKER_FEET_CLEARANCE = 4;

export function packPlacements(dogCount: number): readonly PackPlacement[] {
  return itemAt(FORMATIONS, clampIndex(FORMATIONS.length, dogCount - 1));
}

// A dog on the left of the walker is held in the left hand.
export function leashHand(placement: PackPlacement): { dx: number; dy: number } {
  return {
    dx: placement.dx < 0 ? WALKER_HANDS.leftDx : WALKER_HANDS.rightDx,
    dy: -WALKER_HANDS.heightAboveFeet,
  };
}

// A taut leash's highlight runs along its upper-left side: a pixel left of a steep leash, or
// a pixel above a shallow one.
export function tautLeashLine(
  from: { x: number; y: number },
  to: { x: number; y: number },
): { from: { x: number; y: number }; to: { x: number; y: number } } {
  const side =
    Math.abs(to.y - from.y) >= Math.abs(to.x - from.x) ? { x: -1, y: 0 } : { x: 0, y: -1 };
  const shift = (point: { x: number; y: number }) => ({
    x: point.x + side.x,
    y: point.y + side.y,
  });
  return { from: shift(from), to: shift(to) };
}

// The pack's vertical band in screen pixels, from the leading dog's head to the walker's
// feet: the pack collides as one unit.
export function packBand(dogCount: number, walkerFootY: number): { bottom: number; top: number } {
  const lead = Math.min(...packPlacements(dogCount).map(({ footDy }) => footDy));
  return {
    bottom: walkerFootY - WALKER_FEET_CLEARANCE,
    top: walkerFootY + lead - DOG_BODY_HEIGHT,
  };
}

// The tallest band any pack can have, so spawns stay avoidable whoever is walking.
export function tallestPackBand(walkerFootY: number): number {
  return Math.max(
    ...FORMATIONS.map((_, i) => {
      const { bottom, top } = packBand(i + 1, walkerFootY);
      return bottom - top;
    }),
  );
}
