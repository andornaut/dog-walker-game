import type { Walker } from "./types";

// The walkers the player picks from, all free. spriteKey and portraitKey are keys into the
// art manifest.
export const WALKERS = {
  ada: {
    name: "Ada",
    portraitKey: "face-walker-ada",
    spriteKey: "walker-ada",
    unlock: "start",
  },
  ben: {
    name: "Ben",
    portraitKey: "face-walker-ben",
    spriteKey: "walker-ben",
    unlock: "start",
  },
  casey: {
    name: "Casey",
    portraitKey: "face-walker-casey",
    spriteKey: "walker-casey",
    unlock: "start",
  },
  trista: {
    name: "Trista",
    portraitKey: "face-walker-trista",
    spriteKey: "walker-trista",
    unlock: "start",
  },
} as const satisfies Record<string, Walker>;

// The walker a new player starts with.
export const DEFAULT_WALKER = "casey" satisfies keyof typeof WALKERS;
