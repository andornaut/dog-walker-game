// Shared test fixtures, with real dog, gear, hint and walker ids.
import { cents } from "../rules/units";
import type { SaveContext } from "./load";
import type { SaveDocument } from "./schema";

export const testContext: SaveContext = {
  defaults: {
    dogSlots: 1,
    freeDogs: ["biscuit", "duchess", "koda"],
    walker: "casey",
  },
  known: {
    dogs: new Set([
      "biscuit",
      "dash",
      "duchess",
      "koda",
      "nugget",
      "pierre",
      "snowball",
      "waffles",
      "zippy",
    ]),
    gear: new Set(["fannyPack", "luckyCollar", "poopBags", "runningShoes", "whistle"]),
    hints: new Set(["card", "puddle", "tip"]),
    walkers: new Set(["ada", "ben", "casey", "trista"]),
  },
};

// A new player: the free dogs, one slot, and no loadout until they pick a dog.
export const newPlayerSave: SaveDocument = {
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
    lastWalk: null,
    lifetimeCents: cents(0),
    runs: { finished: 0, noDogs: 0, wentHome: 0 },
    timesFired: 0,
  },
  version: 1,
  walker: "casey",
};

// A player several runs in, with every field away from its default.
export function veteranSave(): SaveDocument {
  return {
    bankCents: cents(12_345),
    checkpoint: null,
    helpSeen: true,
    lastLoadout: { dogs: ["koda", "waffles"], gear: "whistle" },
    owned: {
      dogSlots: 2,
      dogs: ["biscuit", "duchess", "koda", "waffles"],
      gear: ["fannyPack", "whistle"],
    },
    settings: { musicVolume: 0.25, muted: true, reducedMotion: true, sfxVolume: 0.5 },
    shownHints: ["card", "tip"],
    stats: {
      bestWalk: { dogs: ["koda", "waffles"], earnedCents: cents(9_000), zonesFinished: 4 },
      bestZoneFinished: 4,
      dogs: {
        biscuit: { timesFired: 0, walks: 2, zonesFinished: 6 },
        koda: { timesFired: 1, walks: 5, zonesFinished: 12 },
      },
      lastWalk: {
        dogs: ["koda"],
        earnedCents: cents(2_500),
        firings: [{ dog: "koda", zone: 2 }],
        outcome: "wentHome",
        zonesFinished: 2,
      },
      lifetimeCents: cents(30_000),
      runs: { finished: 2, noDogs: 1, wentHome: 2 },
      timesFired: 1,
    },
    version: 1,
    walker: "ada",
  };
}
