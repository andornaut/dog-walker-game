import { clampIndex, itemAt } from "../arrays";
import { ROAD_HIT_SIZE, ROAD_SPRITE_SIZE } from "../assets/spriteKeys";

// Where a dog walks, relative to the walker's feet: dx across, footDy up the road or the screen
// (negative). Dogs walk just ahead of the walker in the same lane, staggered because three
// dogs do not fit side by side in a 64px lane: the centre dog of three stands behind the side
// dogs' heads.
export interface PackPlacement {
  dx: number;
  footDy: number;
}

// The pack is laid out at the hit size, ROAD_HIT_SIZE, where collisions read it, and drawn
// at the sprite size, ROAD_SPRITE_SIZE: the drawn formation's spread and stagger and the drawn
// band's lengths are their hit lengths times PACK_DRAW_SCALE, rounded. The hands and collar are
// measured on the drawn art.
export const PACK_DRAW_SCALE = ROAD_SPRITE_SIZE / ROAD_HIT_SIZE;
const drawn = (length: number) => Math.round(length * PACK_DRAW_SCALE);

// Indexed by pack size - 1; the first dog picked leads. At the hit size.
const HIT_FORMATIONS: readonly (readonly PackPlacement[])[] = [
  [{ dx: 0, footDy: -53 }],
  [
    { dx: -20, footDy: -53 },
    { dx: 20, footDy: -50 },
  ],
  [
    { dx: 0, footDy: -54 },
    { dx: -20, footDy: -49 },
    { dx: 20, footDy: -46 },
  ],
];

// The drawn formations' shapes, in screen pixels: each dog's feet from the nearest dog's.
const DRAWN_SHAPES = HIT_FORMATIONS.map((formation) => {
  const nearest = Math.max(...formation.map(({ footDy }) => footDy));
  return formation.map(({ dx, footDy }) => ({ dx: drawn(dx), footDy: drawn(footDy - nearest) }));
});

// The pack's dogs are drawn at full size: their formation keeps them at a fixed depth just
// ahead of the walker, so they never change size, and following the
// projection there would drop two or three pixel rows from every dog. Their status loops
// follow, at full size.
export const PACK_DEPTH = 1;

// How far a dog's body reaches up from its feet, for collisions: the shortest dog's height.
const DOG_BODY_HEIGHT = 26;
// The walker's legs below the collision band, so things brushing their feet miss.
const WALKER_FEET_CLEARANCE = 5;

// The walker sprite's hands, relative to its feet, as drawn at the sprite size.
export const WALKER_HANDS = { heightAboveFeet: 20, leftDx: -16, rightDx: 16 };
// A dog's collar, above its feet, on every dog sprite at the sprite size: the highest collar
// top.
export const COLLAR_HEIGHT = 21;

// The pack's vertical band, from the leading dog's head to the walker's feet, laid out by a
// formation table at a body height and feet clearance.
interface PackSize {
  bodyHeight: number;
  feetClearance: number;
  formations: readonly (readonly PackPlacement[])[];
}

const HIT_PACK: PackSize = {
  bodyHeight: DOG_BODY_HEIGHT,
  feetClearance: WALKER_FEET_CLEARANCE,
  formations: HIT_FORMATIONS,
};

// A sprite's frame rows from its top to its feet line, and its frame height.
interface FrameFeet {
  feetY: number;
  frameHeight: number;
}

// How far up the screen the nearest dog's feet stand from the walker's, so every dog walks
// ahead of the walker and its leash shows: the walker's frame above its feet, plus the most
// rows any dog's frame has below its feet, so no dog's frame overlaps the walker's.
export function packClearance(walker: FrameFeet, dogs: readonly FrameFeet[]): number {
  return walker.feetY + Math.max(0, ...dogs.map((dog) => dog.frameHeight - dog.feetY));
}

function formationOf(
  formations: PackSize["formations"],
  dogCount: number,
): readonly PackPlacement[] {
  return itemAt(formations, clampIndex(formations.length, dogCount - 1));
}

function bandOf(size: PackSize, dogCount: number, walkerFootY: number) {
  const lead = Math.min(...formationOf(size.formations, dogCount).map(({ footDy }) => footDy));
  return { bottom: walkerFootY - size.feetClearance, top: walkerFootY + lead - size.bodyHeight };
}

// Where each dog is drawn, in screen pixels from the walker's feet: the formation's shape with
// its nearest dog clearance pixels up the screen, from packClearance.
export function packPlacements(dogCount: number, clearance: number): readonly PackPlacement[] {
  return formationOf(DRAWN_SHAPES, dogCount).map(({ dx, footDy }) => ({
    dx,
    footDy: footDy - clearance,
  }));
}

// Where each dog stands for collisions.
export function hitPackPlacements(dogCount: number): readonly PackPlacement[] {
  return formationOf(HIT_FORMATIONS, dogCount);
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

// The pack's hit band in screen pixels, from the leading dog's head to the walker's feet, at
// the hit size: the pack collides as one unit. Every collision, the planner's pack-fit gap and
// the bots read this band.
export function packBand(dogCount: number, walkerFootY: number): { bottom: number; top: number } {
  return bandOf(HIT_PACK, dogCount, walkerFootY);
}

// The band as drawn, from the leading dog's head to the walker's feet, at the sprite size and
// the clearance. Nothing collides with it.
export function drawnPackBand(
  dogCount: number,
  walkerFootY: number,
  clearance: number,
): { bottom: number; top: number } {
  const drawnPack: PackSize = {
    bodyHeight: drawn(DOG_BODY_HEIGHT),
    feetClearance: drawn(WALKER_FEET_CLEARANCE),
    formations: DRAWN_SHAPES.map((_, i) => packPlacements(i + 1, clearance)),
  };
  return bandOf(drawnPack, dogCount, walkerFootY);
}

// The tallest hit band any pack can have, so spawns stay avoidable whoever is walking.
export function tallestPackBand(walkerFootY: number): number {
  return Math.max(
    ...HIT_FORMATIONS.map((_, i) => {
      const { bottom, top } = packBand(i + 1, walkerFootY);
      return bottom - top;
    }),
  );
}
