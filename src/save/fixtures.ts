// Shared test fixtures, with real dog, gear and walker ids and stand-ins for the rest.
import { cents } from "../rules/units";
import type { KnownIdsOutsideData, SaveContext } from "./load";
import type { SaveDocument } from "./schema";

export const knownOutsideData: KnownIdsOutsideData = {
  accessories: new Set(["bandana", "bowTie", "raincoat"]),
  courses: new Set(["heel", "goodManners"]),
  decor: new Set(["dogBed", "plant", "rug"]),
  helpTopics: new Set(["lanes", "cards", "shop"]),
  leashColors: new Set(["red", "teal", "gold"]),
  walkerKit: new Set(["quickFeet", "treatBelt", "businessCards", "firmGrip"]),
};

// One free walker, as the shop plans it.
export const testContext: SaveContext = {
  defaults: {
    dogSlots: 1,
    freeDogs: ["biscuit", "duchess", "koda"],
    freeWalkers: ["casey"],
    lastLoadout: { dogs: ["biscuit"], gear: null },
    walker: "casey",
  },
  known: {
    ...knownOutsideData,
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
    walkers: new Set(["casey", "jordan", "morgan", "robin"]),
  },
};

export const newPlayerSave: SaveDocument = {
  bankCents: cents(0),
  checkpoint: null,
  cosmetics: {
    accessories: { equipped: {}, owned: {} },
    decor: { owned: [], placed: [] },
    leashColors: { equipped: null, owned: [] },
  },
  helpSeen: [],
  lastLoadout: { dogs: ["biscuit"], gear: null },
  owned: {
    dogSlots: 1,
    dogs: ["biscuit", "duchess", "koda"],
    gear: [],
    walkerKit: [],
    walkers: ["casey"],
  },
  settings: {},
  stats: {
    bestRunCents: cents(0),
    bestZoneReached: 0,
    dogs: {},
    lifetimeCents: cents(0),
    runs: { finished: 0, noDogs: 0, wentHome: 0 },
    timesFired: 0,
  },
  training: {},
  version: 1,
  walker: "casey",
};

// A player several runs in, with every field away from its default.
export function veteranSave(): SaveDocument {
  return {
    bankCents: cents(12_345),
    checkpoint: null,
    cosmetics: {
      accessories: {
        equipped: { koda: "bandana" },
        owned: { koda: ["bandana", "raincoat"], waffles: ["bowTie"] },
      },
      decor: { owned: ["plant", "rug"], placed: ["rug"] },
      leashColors: { equipped: "teal", owned: ["red", "teal"] },
    },
    helpSeen: ["lanes", "cards"],
    lastLoadout: { dogs: ["koda", "waffles"], gear: "whistle" },
    owned: {
      dogSlots: 2,
      dogs: ["biscuit", "duchess", "koda", "waffles"],
      gear: ["fannyPack", "whistle"],
      walkerKit: ["quickFeet", "firmGrip"],
      walkers: ["casey", "jordan"],
    },
    settings: {},
    stats: {
      bestRunCents: cents(9_000),
      bestZoneReached: 3,
      dogs: {
        biscuit: { timesFired: 0, walks: 2, zonesFinished: 6 },
        koda: { timesFired: 1, walks: 5, zonesFinished: 12 },
      },
      lifetimeCents: cents(30_000),
      runs: { finished: 2, noDogs: 1, wentHome: 2 },
      timesFired: 1,
    },
    training: { biscuit: ["heel"], koda: ["heel", "goodManners"] },
    version: 1,
    walker: "jordan",
  };
}
