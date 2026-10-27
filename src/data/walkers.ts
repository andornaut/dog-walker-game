import type { Walker, WalkerPerk } from "./types";

// Each walker's one perk: its name, its effect in one line for the walker's detail card and
// the top bar's icon, and its effects, which last every walk the walker walks, as gear's do.
// The art is icon-perk-<kebab id>. An effect line's {percent} is how far the multiplier the perk's
// percent names is from 1, unsigned: 1.25 as "25%".
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
    name: "Second chance",
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
    effect: "Twice as many treats, {percent} more tips",
    effects: [
      { by: "treatFinderSpawns", kind: "modifier", operation: "multiply", stat: "treatSpawns" },
      { by: "treatFinderTipSpawns", kind: "modifier", operation: "multiply", stat: "tipSpawns" },
    ],
    name: "Treat finder",
    percent: "treatFinderTipSpawns",
  },
} as const satisfies Record<string, WalkerPerk>;

// The walkers the player picks from, never sold: each walks from the start or unlocks the
// first time any walk finishes its zone. agility multiplies the pack's lane-change speed.
// spriteKey and portraitKey are keys into the art manifest.
export const WALKERS = {
  ada: {
    agility: 1.2,
    greeting: "Tidy lane work. May I walk with you?",
    name: "Ada",
    perk: "calmVoice",
    portraitKey: "face-walker-ada",
    spriteKey: "walker-ada",
    unlock: "finishZone",
    zone: "pawsPromenade",
  },
  casey: {
    agility: 1.1,
    greeting: "Nice pack! Mind if I walk with you sometime?",
    name: "Casey",
    perk: "kindWords",
    portraitKey: "face-walker-casey",
    spriteKey: "walker-casey",
    unlock: "start",
  },
  mrB: {
    agility: 1,
    greeting: "Nice pack! Mind if I tag along?",
    name: "Mr. B",
    perk: "treatFinder",
    portraitKey: "face-walker-mr-b",
    spriteKey: "walker-mr-b",
    unlock: "finishZone",
    zone: "snoozeCrescent",
  },
  trista: {
    agility: 1.3,
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
