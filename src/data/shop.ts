import type { Gear } from "./types";

// Permanent gear, bought once at the Pet shop and kept. Up to counts.loadoutMax goes in the
// Pocket for a walk.
// Locked dogs are sold too: those with unlock "shop" in dogs.ts, at their price.
export const SHOP_GEAR = {
  fannyPack: {
    effects: [
      { by: "fannyPackCardCostFactor", kind: "modifier", operation: "multiply", stat: "cardCost" },
    ],
    name: "Fanny pack",
    price: "fannyPack",
    short: "Card cash options cost half",
  },
  hallPass: {
    effects: [{ kind: "skipOption" }],
    name: "Hall pass",
    price: "hallPass",
    short: "Skip 1 card each neighborhood",
  },
  luckyCollar: {
    effects: [{ by: "luckyCollarMax", kind: "modifier", operation: "add", stat: "maxHearts" }],
    name: "Lucky collar",
    price: "luckyCollar",
    short: "+1 max ♥ for every dog's owner",
  },
  runningShoes: {
    effects: [{ by: "runningShoesAgility", kind: "modifier", operation: "add", stat: "agility" }],
    name: "Running shoes",
    price: "runningShoes",
    short: "Lane changes +{percent}",
  },
  whistle: {
    effects: [{ chance: "whistleDodgeChance", kind: "dodge", sizes: ["medium", "large"] }],
    name: "Whistle",
    price: "whistle",
    short: "Medium and large dogs dodge too",
  },
} as const satisfies Record<string, Gear>;
