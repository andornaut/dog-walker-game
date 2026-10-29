import type { Gear } from "./types";

// Permanent gear, bought once at the Pet shop and kept. Up to counts.loadoutMax goes in the
// Pocket for a walk.
// Locked dogs are sold too: those with unlock "shop" in dogs.ts, at their price.
export const SHOP_GEAR = {
  fannyPack: {
    effects: [{ by: "fannyPackTreats", kind: "modifier", operation: "add", stat: "spareTreats" }],
    name: "Fanny pack",
    price: "fannyPack",
    short: "Keeps a spare treat",
  },
  hallPass: {
    effects: [{ kind: "skipOption" }],
    name: "Hall pass",
    price: "hallPass",
    short: "Free card skips",
  },
  luckyCollar: {
    effects: [{ by: "luckyCollarMax", kind: "modifier", operation: "add", stat: "maxHearts" }],
    name: "Lucky collar",
    price: "luckyCollar",
    short: "+1 max ♥ per owner",
  },
  runningShoes: {
    effects: [{ by: "runningShoesAgility", kind: "modifier", operation: "add", stat: "agility" }],
    name: "Running shoes",
    price: "runningShoes",
    short: "Faster lane changes",
  },
  whistle: {
    effects: [{ chance: "whistleDodgeChance", kind: "dodge", sizes: ["medium", "large"] }],
    name: "Whistle",
    price: "whistle",
    short: "Every dog dodges",
  },
} as const satisfies Record<string, Gear>;
