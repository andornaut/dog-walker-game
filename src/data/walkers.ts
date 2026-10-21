import type { Walker, WalkerPerk } from "./types";

// Each walker's one perk: its name, its effect in one line for the walker's detail card and
// the top bar's icon, and its effects, which last every walk the walker walks, as gear's do.
// The art is icon-perk-<kebab id>.
export const WALKER_PERKS = {
  calmVoice: {
    effect: "Debuffs last half as long",
    effects: [
      {
        by: "calmVoiceDebuffFactor",
        kind: "modifier",
        operation: "multiply",
        stat: "debuffSeconds",
      },
    ],
    name: "Calm voice",
  },
  kindWords: {
    effect: "First ♥ lost each neighborhood is forgiven",
    effects: [
      { by: "kindWordsForgiven", kind: "modifier", operation: "add", stat: "forgivenHearts" },
    ],
    name: "Kind words",
  },
  longReach: {
    effect: "Grabs tips and treats a lane to each side",
    effects: [
      { by: "longReachLanes", kind: "modifier", operation: "add", stat: "tipReach" },
      { by: "longReachLanes", kind: "modifier", operation: "add", stat: "treatReach" },
    ],
    name: "Long reach",
  },
  treatFinder: {
    effect: "1.5× as many treats appear",
    effects: [
      { by: "treatFinderSpawns", kind: "modifier", operation: "multiply", stat: "treatSpawns" },
    ],
    name: "Treat finder",
  },
} as const satisfies Record<string, WalkerPerk>;

// The walkers the player picks from, never sold: each walks from the start or unlocks the
// first time any walk finishes its zone. agility multiplies the pack's lane-change speed.
// spriteKey and portraitKey are keys into the art manifest.
export const WALKERS = {
  ada: {
    agility: 1.1,
    greeting: "Tidy lane work. May I walk with you?",
    name: "Ada",
    perk: "calmVoice",
    portraitKey: "face-walker-ada",
    spriteKey: "walker-ada",
    unlock: "finishZone",
    zone: "pawsPromenade",
  },
  ben: {
    agility: 0.9,
    greeting: "Nice pack! Mind if I tag along?",
    name: "Ben",
    perk: "treatFinder",
    portraitKey: "face-walker-ben",
    spriteKey: "walker-ben",
    unlock: "finishZone",
    zone: "park",
  },
  casey: {
    agility: 1,
    greeting: "Nice pack! Mind if I walk with you sometime?",
    name: "Casey",
    perk: "kindWords",
    portraitKey: "face-walker-casey",
    spriteKey: "walker-casey",
    unlock: "start",
  },
  trista: {
    agility: 1.2,
    greeting: "Great pace! Race you to the next one?",
    name: "Trista",
    perk: "longReach",
    portraitKey: "face-walker-trista",
    spriteKey: "walker-trista",
    unlock: "finishZone",
    zone: "homeStretch",
  },
} as const satisfies Record<string, Walker>;

// The walker a new player starts with.
export const DEFAULT_WALKER = "casey" satisfies keyof typeof WALKERS;
