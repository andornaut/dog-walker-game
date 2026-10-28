// Shared save fixtures, with real dog, gear, hint and walker ids.
import { gameData } from "../data";
import type { DogId } from "../data/types";
import { keysOf } from "../lib/records";
import { cents } from "../lib/units";
import type { RunCounters } from "../rules/achievements";
import type { AwardContext } from "../save/achievements";
import type { SaveContext } from "../save/load";
import { createDefaultSave, SAVE_VERSION, type SaveDocument } from "../save/schema";
import type { SaveStorage } from "../save/storage";

// The dogs every player owns from the start, as the data marks them.
export const STARTER_DOGS: readonly DogId[] = keysOf(gameData.dogs).filter(
  (id) => gameData.dogs[id].unlock === "start",
);

export const testContext: SaveContext = {
  defaults: {
    dogSlots: [1],
    freeDogs: STARTER_DOGS,
    freeWalkers: ["casey"],
    walker: "casey",
  },
  known: {
    achievements: new Set(gameData.achievements.map(({ id }) => id)),
    debuffs: new Set(["stinky"]),
    dogSlots: new Set([1, 2, 3]),
    dogs: new Set([
      "archie",
      "biscuit",
      "duchess",
      "kilo",
      "reggie",
      "penny",
      "pierre",
      "snowball",
      "buddy",
    ]),
    gear: new Set(["fannyPack", "hallPass", "luckyCollar", "runningShoes"]),
    hints: new Set(["card", "puddle", "tip"]),
    minorObstacles: new Set(["bench", "pigeons", "raccoon"]),
    options: new Map([["capybara", new Set(["callZoo", "help"])]]),
    walkers: new Set(["ada", "mrB", "casey", "trista"]),
    zones: new Set(["homeStretch", "park", "pawsPromenade", "shops", "snoozeCrescent", "street"]),
  },
};

// Awards from the live game data, stamped at a fixed time.
export const testAwards: AwardContext = { data: gameData, now: 1_800_000_000_000 };

// A run with no bumps, debuffs, option picks, tallies or starting money.
export const quietCounters = (): RunCounters => ({
  bumpsByKind: {},
  bumpsByZone: [],
  debuffsGot: {},
  firstZone: 0,
  lastHeartOwners: 0,
  optionPicks: {},
  startCents: cents(0),
  tallies: {},
});

// A new player: the free dogs, one slot, and the starter dog picked.
export const newPlayerSave: SaveDocument = createDefaultSave(testContext.defaults);

// A player several runs in, with every field away from its default. It has finished every zone,
// so it holds the badge for that.
export function veteranSave(): SaveDocument {
  return {
    achievements: {
      squirrel: 1_700_000_100_000,
      wholeCity: 1_700_000_000_000,
    },
    bankCents: cents(12_345),
    checkpoint: null,
    helpSeen: true,
    lastLoadout: { dogs: ["kilo", "penny"], gear: "fannyPack" },
    owned: {
      // Slot 3 bought before slot 2.
      dogSlots: [1, 3],
      // The starters first, as a load lists them.
      dogs: [...new Set<DogId>([...STARTER_DOGS, "biscuit", "duchess", "kilo", "penny"])],
      gear: ["fannyPack", "runningShoes"],
      walkers: ["casey", "ada", "mrB", "trista"],
    },
    settings: { musicVolume: 0.25, muted: true, reducedMotion: true, sfxVolume: 0.5 },
    shownHints: ["card", "tip"],
    stats: {
      bestCentsByPackSize: { 2: cents(9_000) },
      bestWalk: { dogs: ["kilo", "penny"], earnedCents: cents(9_000), zonesFinished: 4 },
      bestZoneFinished: 4,
      bumpsByKind: { pigeons: 3 },
      dogs: {
        biscuit: { timesFired: 0, walks: 2, zonesFinished: 6 },
        kilo: { timesFired: 1, walks: 5, zonesFinished: 12 },
      },
      dogsFinishedWith: ["biscuit"],
      lastWalk: {
        dogs: ["kilo"],
        earnedCents: cents(2_500),
        firings: [{ dog: "kilo", zone: 2 }],
        outcome: "wentHome",
        route: ["street", "park"],
        zonesFinished: 2,
      },
      lifetimeCents: cents(30_000),
      lifetimeStartCents: cents(2_000),
      noFiringStreak: 2,
      optionPicks: { capybara: { help: 2 } },
      runs: { finished: 2, noDogs: 1, wentHome: 2 },
      tallies: { squirrelPulls: 5 },
      timesFired: 1,
      walkersFinishedWith: ["casey"],
      zonesEverFinished: [
        "homeStretch",
        "park",
        "pawsPromenade",
        "shops",
        "snoozeCrescent",
        "street",
      ],
    },
    version: SAVE_VERSION,
    walker: "ada",
  };
}

export function memoryStorage(entries: Map<string, string> = new Map()): SaveStorage {
  return {
    read: async (key) => entries.get(key) ?? null,
    write: async (key, value) => {
      entries.set(key, value);
    },
  };
}
