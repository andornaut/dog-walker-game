import { DOGS } from "../data/dogs";
import { LANE_COUNT, SCREEN_CONFIG } from "../data/screen";
import type { DogId, Size, WalkerId } from "../data/types";
import { itemAt } from "../lib/arrays";
import { packOrder } from "../state/pack";
import { distanceAtY, type RoadProjection, scaleAt } from "./projection";

// The pack walks in a formation set by its dogs' sizes, close in front of the walker, and
// collides as it is drawn: an obstacle hits the walker's or a dog's rectangle, just inside its
// opaque pixels, and a pickup touches the outline around them all, leashes included.

// A sprite's opaque pixels over its walk loop, from the column it is placed on and its feet row:
// left and right columns (right exclusive), and the rows above the feet row. Measured on the
// full-size art; packFormation.test.ts checks them against it.
export interface Silhouette {
  above: number;
  left: number;
  right: number;
}

export const WALKER_SILHOUETTES: Readonly<Record<WalkerId, Silhouette>> = {
  ada: { above: 55, left: -15, right: 15 },
  casey: { above: 65, left: -17, right: 18 },
  mrB: { above: 65, left: -17, right: 18 },
  trista: { above: 65, left: -17, right: 24 },
};

export const DOG_SILHOUETTES: Readonly<Record<DogId, Silhouette>> = {
  archie: { above: 39, left: -11, right: 12 },
  biscuit: { above: 38, left: -12, right: 12 },
  duchess: { above: 32, left: -10, right: 10 },
  kilo: { above: 45, left: -15, right: 15 },
  penny: { above: 42, left: -14, right: 14 },
  pierre: { above: 39, left: -13, right: 13 },
  reggie: { above: 31, left: -10, right: 10 },
  snowball: { above: 46, left: -15, right: 15 },
  zippy: { above: 31, left: -9, right: 10 },
};

// How far a dog reaches either side of its column, mirrored too, as a pull draws it.
function dogHalfWidth(dog: Silhouette): number {
  return Math.max(-dog.left, dog.right);
}

// Half a lane's width at the walker's feet: the pack's box stays inside it, so a pack settled in
// a lane never touches anything in the lane beside it.
export const LANE_HALF_WIDTH = SCREEN_CONFIG.roadWidth / LANE_COUNT / 2;

// Where a dog walks, in screen pixels from the walker's feet: dx across from the walker's lane
// centre as drawn on the dog's feet row (negative to the left), and footDy up the screen
// (negative). Every dog walks in front of the walker on a leash from the walker's hand to its
// collar, and is drawn by depth: the farthest feet first, then the leashes, then the walker.
export interface PackPlacement {
  dx: number;
  footDy: number;
}

// A place in a formation: the lead in the centre, or a side.
export type PackSlot = "lead" | "left" | "right";

const SIDES: Readonly<Record<PackSlot, -1 | 0 | 1>> = { lead: 0, left: -1, right: 1 };

// Indexed by pack size - 1, the slots in formation order (formationOrder): one dog leads in
// the centre; two walk side by side, the front dog on the left; three walk in a triangle, the
// lead out front and the others front-left and front-right. A larger pack takes the largest
// formation.
export const PACK_SLOTS: readonly (readonly PackSlot[])[] = [
  ["lead"],
  ["left", "right"],
  ["lead", "left", "right"],
];

// The feet rows, up the screen from the walker's feet, by the dogs' sizes: a lone dog's; a
// side dog's, of two or three; a side dog's of three large dogs, closer in; and the lead's of
// three, keyed by the lead's, the left dog's and the right dog's sizes.
export const PACK_FEET = {
  lead: { large: -49, medium: -50, small: -54 },
  side: { large: -45, medium: -45, small: -48 },
  sideOfThreeLarge: -37,
  trioLead: {
    "large large large": -53,
    "large large medium": -60,
    "large large small": -60,
    "large medium medium": -52,
    "large medium small": -52,
    "large small small": -50,
    "medium medium medium": -50,
    "medium medium small": -56,
    "medium small small": -50,
    "small small small": -54,
  } as Readonly<Record<string, number>>,
} as const;

const ROSTER = Object.keys(DOGS) as DogId[];

// The pack's dogs in formation order, by the roster's sizes (packOrder).
export function formationOrder(dogs: readonly DogId[]): DogId[] {
  return [...packOrder(DOGS, dogs)];
}

// Each dog's feet row, the dogs' sizes in formation order.
function feetRows(sizes: readonly Size[]): number[] {
  if (sizes.length === 1) {
    return [PACK_FEET.lead[itemAt(sizes, 0)]];
  }
  const sides = sizes.slice(-2);
  const threeLarge = sizes.length === 3 && sizes.every((size) => size === "large");
  const sideRows = sides.map((size) =>
    threeLarge ? PACK_FEET.sideOfThreeLarge : PACK_FEET.side[size],
  );
  if (sizes.length === 2) {
    return sideRows;
  }
  const lead = PACK_FEET.trioLead[sizes.join(" ")];
  if (lead === undefined) {
    throw new Error(
      `No lead's feet row for ${sizes.join(", ")}: the dogs must be in formation order`,
    );
  }
  return [lead, ...sideRows];
}

type Lens = Pick<RoadProjection, "focal" | "footY" | "horizonY">;

// The road's scale on the row footDy up the screen from the walker's feet.
function rowScale(projection: Lens, footDy: number): number {
  return scaleAt(projection, distanceAtY(projection, projection.footY + footDy));
}

// A dog's silhouette and size.
interface PackDog {
  silhouette: Silhouette;
  size: Size;
}

// A side dog stands across from the lane's centre the lane's half width on its feet row less
// half its opaque width, rounded in, so it is drawn inside its lane.
function sideDx(projection: Lens, footDy: number, dog: Silhouette): number {
  const width = dog.right - dog.left;
  return Math.floor(LANE_HALF_WIDTH * rowScale(projection, footDy) - Math.ceil(width / 2));
}

// Where each dog walks, the dogs in formation order and no more than the largest formation
// holds: its feet row, and for a side dog its sideDx.
export function packPlacements(projection: Lens, dogs: readonly PackDog[]): PackPlacement[] {
  if (dogs.length === 0) {
    return [];
  }
  const walking = dogs.slice(0, PACK_SLOTS.length);
  const rows = feetRows(walking.map(({ size }) => size));
  return itemAt(PACK_SLOTS, walking.length - 1).map((slot, i) => {
    const footDy = itemAt(rows, i);
    return { dx: SIDES[slot] * sideDx(projection, footDy, itemAt(walking, i).silhouette), footDy };
  });
}

// A box: x across, y down.
export interface PartBox {
  bottom: number;
  left: number;
  right: number;
  top: number;
}

// The pack's parts on the flat road: each part's opaque columns across from the walker's, a
// dog's at the road's scale on its feet row, and its rows from its top row's top edge down to
// its feet line as the road drawn there, y down the road from the walker's feet. scale is the
// road's on the part's feet row, which its columns are drawn at.
interface ScaledPartBox extends PartBox {
  scale: number;
}

interface PackParts {
  dogs: ScaledPartBox[];
  walker: ScaledPartBox;
}

// How far inside its drawn sprite a part's hit rectangle lies on every side, in screen pixels:
// an obstacle hits a dog or the walker only where it visibly overlaps them.
export const PART_INSET = 2;

// The road drawn on the row dy up the screen from the walker's feet, down from the feet.
function roadY(projection: Lens, dy: number): number {
  return -distanceAtY(projection, projection.footY + dy);
}

// The parts inset by inset screen pixels on every side: 0 for what is drawn. The dogs are in
// formation order.
function packParts(
  projection: Lens,
  inset: number,
  walker: Silhouette,
  dogs: readonly PackDog[],
): PackParts {
  return {
    dogs: packPlacements(projection, dogs).map(({ dx, footDy }, i) => {
      const { silhouette } = itemAt(dogs, i);
      const scale = rowScale(projection, footDy);
      const half = dogHalfWidth(silhouette) - inset;
      return {
        bottom: roadY(projection, footDy - inset),
        left: (dx - half) / scale,
        right: (dx + half) / scale,
        scale,
        top: roadY(projection, footDy - silhouette.above + inset),
      };
    }),
    walker: {
      bottom: roadY(projection, -inset),
      left: walker.left + inset,
      right: walker.right - inset,
      scale: 1,
      top: roadY(projection, -walker.above + inset),
    },
  };
}

// The bounding box of the parts.
export function unionBox(parts: readonly PartBox[]): PartBox {
  return {
    bottom: Math.max(...parts.map(({ bottom }) => bottom)),
    left: Math.min(...parts.map(({ left }) => left)),
    right: Math.max(...parts.map(({ right }) => right)),
    top: Math.min(...parts.map(({ top }) => top)),
  };
}

// The bounding box of what is drawn for the pack: the walker, the dogs and the leashes between.
export function packOutline(parts: PackParts): PartBox {
  return unionBox([parts.walker, ...parts.dogs]);
}

// The walker's and the dogs' sprites.
export interface PackSprites {
  dogs: readonly DogId[];
  walker: WalkerId;
}

export function packDogOf(dog: DogId): PackDog {
  return { silhouette: DOG_SILHOUETTES[dog], size: DOGS[dog].size };
}

// The parts with the dogs in formation order, whatever order they are given in.
export function packOnRoad(projection: Lens, inset: number, pack: PackSprites): PackParts {
  const dogs = formationOrder(pack.dogs).map(packDogOf);
  return packParts(projection, inset, WALKER_SILHOUETTES[pack.walker], dogs);
}

// Every pack of up to the largest formation's size the roster makes.
export function everyPack(): DogId[][] {
  const packs: DogId[][] = [[]];
  for (const dog of ROSTER) {
    for (const pack of [...packs]) {
      if (pack.length < PACK_SLOTS.length) {
        packs.push([...pack, dog]);
      }
    }
  }
  return packs.filter((pack) => pack.length > 0);
}

// The longest any pack's outline runs along the road, so spawns stay avoidable whoever walks.
export function tallestPackLength(projection: Lens): number {
  const packs = everyPack();
  return Math.max(
    ...(Object.keys(WALKER_SILHOUETTES) as WalkerId[]).flatMap((walker) =>
      packs.map((dogs) => {
        const box = packOutline(packOnRoad(projection, 0, { dogs, walker }));
        return box.bottom - box.top;
      }),
    ),
  );
}

// The pack's dogs are drawn at full size: their formation keeps them at a fixed depth around
// the walker, so they never change size. Their status loops follow, at full size.
export const PACK_DEPTH = 1;

// The walker sprite's hands, relative to its feet, as drawn at the sprite size.
export const WALKER_HANDS = { heightAboveFeet: 20, leftDx: -16, rightDx: 16 };
// Each dog's collar top, above its feet, as drawn on its road sprite: large dogs about 22,
// medium 21 and small 16.
export const COLLAR_HEIGHTS: Readonly<Record<DogId, number>> = {
  archie: 20,
  biscuit: 21,
  duchess: 16,
  kilo: 21,
  penny: 22,
  pierre: 21,
  reggie: 16,
  snowball: 22,
  zippy: 16,
};

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
