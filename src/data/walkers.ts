import type { Walker, WalkerTrait } from "./types";

// A walker's pace is the difficulty: a slow walker's road scrolls slower and pays lower fees,
// a fast walker's faster with higher fees. The art is icon-pace-<id>.
export const WALKER_PACES = {
  fast: {
    effects: [
      { by: "fastWalkerSpeed", kind: "modifier", operation: "multiply", stat: "scrollSpeed" },
      { by: "fastWalkerFees", kind: "modifier", operation: "multiply", stat: "fees" },
    ],
    name: "Fast",
  },
  slow: {
    effects: [
      { by: "slowWalkerSpeed", kind: "modifier", operation: "multiply", stat: "scrollSpeed" },
      { by: "slowWalkerFees", kind: "modifier", operation: "multiply", stat: "fees" },
    ],
    name: "Slow",
  },
} as const satisfies Record<string, WalkerTrait>;

// A walker's style is the play style: a charmer's owners start happier but tip less, a
// hustler's tip more. The art is icon-style-<id>.
export const WALKER_STYLES = {
  charm: {
    effects: [
      { by: "charmerStart", kind: "modifier", operation: "add", stat: "startHearts" },
      { by: "charmerTip", kind: "modifier", operation: "multiply", stat: "tipValue" },
    ],
    name: "Charmer",
  },
  hustle: {
    effects: [{ by: "hustlerTip", kind: "modifier", operation: "multiply", stat: "tipValue" }],
    name: "Hustler",
  },
} as const satisfies Record<string, WalkerTrait>;

// The walkers the player picks from, never sold: each walks from the start or unlocks the
// first time any walk finishes its zone. spriteKey and portraitKey are keys into the art
// manifest.
export const WALKERS = {
  ada: {
    name: "Ada",
    pace: "fast",
    portraitKey: "face-walker-ada",
    spriteKey: "walker-ada",
    style: "charm",
    unlock: "finishZone",
    zone: 2,
  },
  ben: {
    name: "Ben",
    pace: "slow",
    portraitKey: "face-walker-ben",
    spriteKey: "walker-ben",
    style: "hustle",
    unlock: "finishZone",
    zone: 1,
  },
  casey: {
    name: "Casey",
    pace: "slow",
    portraitKey: "face-walker-casey",
    spriteKey: "walker-casey",
    style: "charm",
    unlock: "start",
  },
  trista: {
    name: "Trista",
    pace: "fast",
    portraitKey: "face-walker-trista",
    spriteKey: "walker-trista",
    style: "hustle",
    unlock: "finishZone",
    zone: 3,
  },
} as const satisfies Record<string, Walker>;

// The walker a new player starts with.
export const DEFAULT_WALKER = "casey" satisfies keyof typeof WALKERS;
