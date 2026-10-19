import type { Walker, WalkerTrait } from "./types";

// A walker's pace is the difficulty: every zone takes the same time with any walker, so the
// speed factor scales the road's speed, the zone's length and the obstacles, tips and need
// spots in it. A fast walker meets more each second, with less time to react, and earns
// higher fees; a slow walker's is the reverse. The art is icon-pace-<id>.
export const WALKER_PACES = {
  fast: {
    effects: [
      { by: "fastWalkerSpeed", kind: "modifier", operation: "multiply", stat: "scrollSpeed" },
      { by: "fastWalkerSpeed", kind: "modifier", operation: "multiply", stat: "zoneLength" },
      { by: "fastWalkerSpeed", kind: "modifier", operation: "multiply", stat: "obstacleSpawns" },
      { by: "fastWalkerSpeed", kind: "modifier", operation: "multiply", stat: "tipSpawns" },
      { by: "fastWalkerSpeed", kind: "modifier", operation: "multiply", stat: "needSpotSpawns" },
      { by: "fastWalkerFees", kind: "modifier", operation: "multiply", stat: "fees" },
    ],
    name: "Fast",
  },
  slow: {
    effects: [
      { by: "slowWalkerSpeed", kind: "modifier", operation: "multiply", stat: "scrollSpeed" },
      { by: "slowWalkerSpeed", kind: "modifier", operation: "multiply", stat: "zoneLength" },
      { by: "slowWalkerSpeed", kind: "modifier", operation: "multiply", stat: "obstacleSpawns" },
      { by: "slowWalkerSpeed", kind: "modifier", operation: "multiply", stat: "tipSpawns" },
      { by: "slowWalkerSpeed", kind: "modifier", operation: "multiply", stat: "needSpotSpawns" },
      { by: "slowWalkerFees", kind: "modifier", operation: "multiply", stat: "fees" },
    ],
    name: "Slow",
  },
} as const satisfies Record<string, WalkerTrait>;

// A walker's style is the play style: a charmer's owners start happier but fewer tips appear,
// and more appear for a hustler. The art is icon-style-<id>.
export const WALKER_STYLES = {
  charm: {
    effects: [
      { by: "charmerStart", kind: "modifier", operation: "add", stat: "startHearts" },
      { by: "charmerTipSpawns", kind: "modifier", operation: "multiply", stat: "tipSpawns" },
    ],
    name: "Charmer",
  },
  hustle: {
    effects: [
      { by: "hustlerTipSpawns", kind: "modifier", operation: "multiply", stat: "tipSpawns" },
    ],
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
