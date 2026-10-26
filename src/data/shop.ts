import type { Gear } from "./types";

// Permanent gear, bought once at the Pet shop and kept. Up to counts.loadoutMax goes in the
// Pocket for a walk.
// Locked dogs are sold too: those with unlock "shop" in dogs.ts, at their price.
export const SHOP_GEAR = {
  dogWhistle: {
    effects: [{ chance: "dogWhistleDodgeChance", kind: "dodge", sizes: ["medium", "big"] }],
    name: "Dog whistle",
    price: "dogWhistle",
    short: "Big dogs dodge too",
  },
  fannyPack: {
    effects: [{ by: "fannyPackStart", kind: "modifier", operation: "add", stat: "startMoney" }],
    name: "Fanny pack",
    price: "fannyPack",
    short: "Start walks with +$20",
  },
  hallPass: {
    effects: [{ kind: "skipOption" }],
    name: "Hall pass",
    price: "hallPass",
    short: "1 skip per neighborhood",
  },
  luckyCollar: {
    effects: [{ by: "luckyCollarMax", kind: "modifier", operation: "add", stat: "maxHearts" }],
    name: "Lucky collar",
    price: "luckyCollar",
    short: "Every owner +1♥ max",
  },
  runningShoes: {
    effects: [{ by: "runningShoesAgility", kind: "modifier", operation: "add", stat: "agility" }],
    name: "Running shoes",
    price: "runningShoes",
    short: "30% faster lane changes",
  },
} as const satisfies Record<string, Gear>;
