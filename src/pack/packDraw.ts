import type { DogId } from "../data/types";
import { COLLAR_HEIGHTS, leashHand, type PackPlacement } from "../layout/packFormation";

// How every screen draws the pack: the walk, the start screen's gate and the end screen's return
// home stand it through these, so their leashes and draw order agree.

export interface Point {
  x: number;
  y: number;
}

// Where a figure stands: the middle of its feet, in screen pixels.
export interface Feet {
  footY: number;
  x: number;
}

// A dog standing in the pack: its place beside the walker, which picks the hand that holds its
// leash, its feet on screen, and its rank in formation order, which sets the dog in front of
// another on its row.
export interface StandingDog {
  dog: DogId;
  feet: Feet;
  placement: PackPlacement;
  rank: number;
}

export interface LeashLine {
  from: Point;
  to: Point;
}

// The leash from the walker's hand on the dog's side to the top of its collar, at the depth scale
// its sprite is drawn at.
export function leashLine(walker: Feet, depth: number, dog: StandingDog): LeashLine {
  const hand = leashHand(dog.placement);
  return {
    from: { x: walker.x + hand.dx, y: walker.footY + hand.dy },
    to: { x: dog.feet.x, y: dog.feet.footY - Math.round(COLLAR_HEIGHTS[dog.dog] * depth) },
  };
}

type PackLayer = { dog: DogId; kind: "dog" } | { kind: "leash" } | { kind: "walker" };

// The pack's layers back to front, each with its depth over the pack's base depth: the dogs by
// their feet rows, the later in formation order in front on a shared row; then the leashes, just
// under the walker, whose body hides the part behind it, and over the dogs ahead; then the walker.
export function packLayers(
  walker: Feet,
  dogs: readonly StandingDog[],
): { depth: number; layer: PackLayer }[] {
  return [
    ...dogs.map(({ dog, feet, rank }) => ({
      depth: feet.footY + rank / 1000,
      layer: { dog, kind: "dog" } as const,
    })),
    { depth: walker.footY - 0.5, layer: { kind: "leash" } as const },
    { depth: walker.footY, layer: { kind: "walker" } as const },
  ].sort((a, b) => a.depth - b.depth);
}
