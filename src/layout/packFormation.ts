import { clampIndex, itemAt } from "../arrays";
import { ROAD_HIT_SIZE, ROAD_SPRITE_SIZE } from "../assets/spriteKeys";
import { LANE_COUNT, SCREEN_CONFIG } from "../data/screen";
import type { DogId } from "../data/types";

// Where a dog walks, relative to the walker's feet: dx across, footDy up the screen
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

// Indexed by pack size - 1; the first dog picked leads. At the hit size, before the hit
// formation brings the side dogs in and the drawn formation sets them by their width.
const LAID_OUT: readonly (readonly PackPlacement[])[] = [
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

// The farthest a dog's hit box sits from the lane's centre: half a 64px lane less half a box,
// so no box reaches into the next lane and a pack settled in a lane never touches an obstacle
// beside it.
const HIT_SIDE_DX = 12;

// Where the dogs stand for collisions: as laid out, side dogs brought in to HIT_SIDE_DX.
const HIT_FORMATIONS = LAID_OUT.map((formation) =>
  formation.map(({ dx, footDy }) => ({
    dx: Math.sign(dx) * Math.min(Math.abs(dx), HIT_SIDE_DX),
    footDy,
  })),
);

// A drawn formation's place: the side of the walker a dog walks on (-1 left, 0 centre, 1
// right), and its feet from the nearest dog's, up the screen in pixels.
export interface DrawnSlot {
  footDy: number;
  side: number;
}

// The drawn formations' shapes: the laid-out sides, and their stagger at the draw scale.
export const DRAWN_SHAPES: readonly (readonly DrawnSlot[])[] = LAID_OUT.map((formation) => {
  const nearest = Math.max(...formation.map(({ footDy }) => footDy));
  return formation.map(({ dx, footDy }) => ({
    footDy: drawn(footDy - nearest),
    side: Math.sign(dx),
  }));
});

// Half a lane's width at the walker's feet: a side dog walks inside it. A function, since the
// screen config is not yet loaded while this module loads in an import cycle.
export function laneHalfWidth(): number {
  return SCREEN_CONFIG.roadWidth / LANE_COUNT / 2;
}

// The pack's dogs are drawn at full size: their formation keeps them at a fixed depth just
// ahead of the walker, so they never change size, and following the projection there would
// drop two or three pixel rows from every dog. Their status loops follow, at full size.
export const PACK_DEPTH = 1;

// How far a dog's body reaches up from its feet, for the drawn band: the shortest dog's height.
const DOG_BODY_HEIGHT = 26;
// The walker's legs below the drawn band.
const WALKER_FEET_CLEARANCE = 5;

// The walker sprite's hands, relative to its feet, as drawn at the sprite size.
export const WALKER_HANDS = { heightAboveFeet: 20, leftDx: -16, rightDx: 16 };
// Each dog's collar top, above its feet, as drawn on its road sprite: big dogs about 22,
// medium 21 and small 16.
export const COLLAR_HEIGHTS: Readonly<Record<DogId, number>> = {
  archie: 20,
  biscuit: 21,
  duchess: 16,
  koda: 21,
  nugget: 16,
  penny: 22,
  pierre: 21,
  snowball: 22,
  zippy: 16,
};

// The pack's vertical band, from the leading dog's head to the walker's feet, laid out by a
// formation table at a body height and feet clearance.
interface PackSize {
  bodyHeight: number;
  feetClearance: number;
  formations: readonly (readonly PackPlacement[])[];
}

// A sprite's frame rows from its top to its feet line, and its frame height.
export interface FrameFeet {
  feetY: number;
  frameHeight: number;
}

// A pack dog's drawn frame: its feet line, frame height and opaque width.
export interface DrawnDog extends FrameFeet {
  opaqueWidth: number;
}

// How far up the screen the nearest dog's feet stand from the walker's, so every dog walks
// ahead of the walker and its leash shows: the walker's frame above its feet, plus the most
// rows any dog's frame has below its feet, so no dog's frame overlaps the walker's.
export function packClearance(
  walker: Pick<FrameFeet, "feetY">,
  dogs: readonly FrameFeet[],
): number {
  return walker.feetY + Math.max(0, ...dogs.map((dog) => dog.frameHeight - dog.feetY));
}

function formationOf<T>(formations: readonly (readonly T[])[], dogCount: number): readonly T[] {
  return itemAt(formations, clampIndex(formations.length, dogCount - 1));
}

function bandOf(size: PackSize, dogCount: number, walkerFootY: number) {
  const lead = Math.min(...formationOf(size.formations, dogCount).map(({ footDy }) => footDy));
  return { bottom: walkerFootY - size.feetClearance, top: walkerFootY + lead - size.bodyHeight };
}

// How far across a side dog walks from the walker: its opaque half inside the lane's edge.
export function sideDx(opaqueWidth: number): number {
  return Math.floor(laneHalfWidth() - opaqueWidth / 2);
}

// Where each dog is drawn, in screen pixels from the walker's feet: the formation's shape with
// its nearest dog packClearance up the screen, so every dog walks ahead of the walker's frame,
// and each side dog sideDx across, so the pack stays in its lane.
export function packPlacements(
  walker: Pick<FrameFeet, "feetY">,
  dogs: readonly DrawnDog[],
): PackPlacement[] {
  if (dogs.length === 0) {
    return [];
  }
  const clearance = packClearance(walker, dogs);
  return formationOf(DRAWN_SHAPES, dogs.length).map(({ footDy, side }, i) => ({
    dx: side === 0 ? 0 : side * sideDx(itemAt(dogs, i).opaqueWidth),
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

// The centre of a dog's hit box, relative to the walker's feet: the middle of its sprite at the
// hit size, a square ROAD_HIT_SIZE tall standing on its feet.
export function dogHitCentre(placement: PackPlacement): { dx: number; dy: number } {
  return { dx: placement.dx, dy: placement.footDy - ROAD_HIT_SIZE / 2 };
}

// The pack's hit band in screen pixels, from the lead dog's box to the last dog's, with every
// box at the largest hit size, ROAD_HIT_SIZE. The walker has no box. The planner's pack-fit
// gap, the pulls and the bots read this band.
export function packBand(dogCount: number, walkerFootY: number): { bottom: number; top: number } {
  const feet = formationOf(HIT_FORMATIONS, dogCount).map(({ footDy }) => footDy);
  return {
    bottom: walkerFootY + Math.max(...feet),
    top: walkerFootY + Math.min(...feet) - ROAD_HIT_SIZE,
  };
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
    formations: DRAWN_SHAPES.map((shape) =>
      shape.map(({ footDy }) => ({ dx: 0, footDy: footDy - clearance })),
    ),
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
