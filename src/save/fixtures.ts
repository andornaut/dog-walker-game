// Shared test fixtures, with real dog, gear, hint and walker ids.
import { gameData } from "../data";
import type { RunCounters } from "../rules/achievements";
import { cents } from "../rules/units";
import type { AwardContext } from "./achievements";
import type { SaveContext } from "./load";
import { SAVE_VERSION, type SaveDocument } from "./schema";

export const testContext: SaveContext = {
  defaults: {
    dogSlots: 1,
    freeDogs: ["biscuit", "duchess", "koda"],
    walker: "casey",
  },
  known: {
    achievements: new Set(["bigPayday", "firstSteps", "fullKennel", "squirrel"]),
    debuffs: new Set(["stinky"]),
    dogs: new Set([
      "archie",
      "biscuit",
      "duchess",
      "koda",
      "nugget",
      "penny",
      "pierre",
      "snowball",
      "zippy",
    ]),
    gear: new Set(["fannyPack", "luckyCollar", "poopBags", "runningShoes", "whistle"]),
    hints: new Set(["card", "puddle", "tip"]),
    walkers: new Set(["ada", "ben", "casey", "trista"]),
  },
};

// Awards from the live game data, stamped at a fixed time.
export const testAwards: AwardContext = { data: gameData, now: 1_800_000_000_000 };

// A run with no bumps, debuffs or chases.
export const quietCounters = (): RunCounters => ({
  bumpsByZone: [],
  debuffZones: {},
  firstZone: 0,
  squirrelChases: 0,
});

// A new player: the free dogs, one slot, and no loadout until they pick a dog.
export const newPlayerSave: SaveDocument = {
  achievements: {},
  bankCents: cents(0),
  checkpoint: null,
  helpSeen: false,
  lastLoadout: { dogs: [], gear: null },
  owned: {
    dogSlots: 1,
    dogs: ["biscuit", "duchess", "koda"],
    gear: [],
  },
  settings: { musicVolume: 0.6, muted: false, reducedMotion: false, sfxVolume: 0.8 },
  shownHints: [],
  stats: {
    bestWalk: null,
    bestZoneFinished: 0,
    dogs: {},
    dogsFinishedWith: [],
    lastWalk: null,
    lifetimeCents: cents(0),
    runs: { finished: 0, noDogs: 0, wentHome: 0 },
    squirrelsChased: 0,
    timesFired: 0,
    walksWithoutFiring: 0,
  },
  version: SAVE_VERSION,
  walker: "casey",
};

// A player several runs in, with every field away from its default.
export function veteranSave(): SaveDocument {
  return {
    achievements: { firstSteps: 1_700_000_000_000, squirrel: 1_700_000_100_000 },
    bankCents: cents(12_345),
    checkpoint: null,
    helpSeen: true,
    lastLoadout: { dogs: ["koda", "penny"], gear: "whistle" },
    owned: {
      dogSlots: 2,
      dogs: ["biscuit", "duchess", "koda", "penny"],
      gear: ["fannyPack", "whistle"],
    },
    settings: { musicVolume: 0.25, muted: true, reducedMotion: true, sfxVolume: 0.5 },
    shownHints: ["card", "tip"],
    stats: {
      bestWalk: { dogs: ["koda", "penny"], earnedCents: cents(9_000), zonesFinished: 4 },
      bestZoneFinished: 4,
      dogs: {
        biscuit: { timesFired: 0, walks: 2, zonesFinished: 6 },
        koda: { timesFired: 1, walks: 5, zonesFinished: 12 },
      },
      dogsFinishedWith: ["biscuit"],
      lastWalk: {
        dogs: ["koda"],
        earnedCents: cents(2_500),
        firings: [{ dog: "koda", zone: 2 }],
        outcome: "wentHome",
        zonesFinished: 2,
      },
      lifetimeCents: cents(30_000),
      runs: { finished: 2, noDogs: 1, wentHome: 2 },
      squirrelsChased: 5,
      timesFired: 1,
      walksWithoutFiring: 2,
    },
    version: SAVE_VERSION,
    walker: "ada",
  };
}
