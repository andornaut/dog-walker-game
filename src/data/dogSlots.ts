import type { DogSlot } from "./types";

// The dog slots in order: the first is owned from the start, the others are bought on the
// home screen at any time.
export const DOG_SLOTS = [
  { unlock: "start" },
  { price: "dogSlot2", unlock: "shop" },
  { price: "dogSlot3", unlock: "shop" },
] as const satisfies readonly [DogSlot, ...DogSlot[]];
