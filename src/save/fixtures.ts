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
    freeDogs: ["biscuit"],
    freeWalkers: ["casey"],
    walker: "casey",
  },
  known: {
    achievements: new Set(["bigPayday", "dreamTeam", "firstSteps", "fullKennel", "squirrel"]),
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
    gear: new Set(["fannyPack", "luckyCollar", "poopBags", "runningShoes"]),
    hints: new Set(["card", "puddle", "tip"]),
    walkers: new Set(["ada", "ben", "casey", "trista"]),
    zones: new Set(["homeStretch", "park", "pawsPromenade", "shops", "snoozeCrescent", "street"]),
  },
};

// Awards from the live game data, stamped at a fixed time.
export const testAwards: AwardContext = { data: gameData, now: 1_800_000_000_000 };

// A run with no bumps, debuffs, tallies or starting money.
export const quietCounters = (): RunCounters => ({
  bumpsByZone: [],
  debuffsGot: {},
  firstZone: 0,
  lastHeartOwners: 0,
  startCents: cents(0),
  tallies: {},
});

// A new player: the free dogs, one slot, and the starter dog picked.
export const newPlayerSave: SaveDocument = {
  achievements: {},
  bankCents: cents(0),
  checkpoint: null,
  helpSeen: false,
  lastLoadout: { dogs: ["biscuit"], gear: null },
  owned: {
    dogSlots: 1,
    dogs: ["biscuit"],
    gear: [],
    walkers: ["casey"],
  },
  settings: { musicVolume: 0.6, muted: false, reducedMotion: false, sfxVolume: 0.8 },
  shownHints: [],
  stats: {
    bestCentsByPackSize: {},
    bestWalk: null,
    bestZoneFinished: 0,
    dogs: {},
    dogsFinishedWith: [],
    lastWalk: null,
    lifetimeCents: cents(0),
    runs: { finished: 0, noDogs: 0, wentHome: 0 },
    tallies: {},
    timesFired: 0,
    walksWithoutFiring: 0,
  },
  version: SAVE_VERSION,
  walker: "casey",
};

// A player several runs in, with every field away from its default. It owns every walker, so it
// holds the badge for unlocking them all.
export function veteranSave(): SaveDocument {
  return {
    achievements: {
      dreamTeam: 1_700_000_200_000,
      firstSteps: 1_700_000_000_000,
      squirrel: 1_700_000_100_000,
    },
    bankCents: cents(12_345),
    checkpoint: null,
    helpSeen: true,
    lastLoadout: { dogs: ["koda", "penny"], gear: "fannyPack" },
    owned: {
      dogSlots: 2,
      dogs: ["biscuit", "duchess", "koda", "penny"],
      gear: ["fannyPack", "runningShoes"],
      walkers: ["casey", "ada", "ben", "trista"],
    },
    settings: { musicVolume: 0.25, muted: true, reducedMotion: true, sfxVolume: 0.5 },
    shownHints: ["card", "tip"],
    stats: {
      bestCentsByPackSize: { 2: cents(9_000) },
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
        route: ["street", "park"],
        zonesFinished: 2,
      },
      lifetimeCents: cents(30_000),
      runs: { finished: 2, noDogs: 1, wentHome: 2 },
      tallies: { squirrelPulls: 5 },
      timesFired: 1,
      walksWithoutFiring: 2,
    },
    version: SAVE_VERSION,
    walker: "ada",
  };
}
