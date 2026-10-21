import type { Gear } from "./types";

// Permanent gear, bought once at the Pet shop and kept. Up to counts.loadoutMax goes in the
// Pocket for a walk.
// Locked dogs are sold too: those with unlock "shop" in dogs.ts, at their price.
export const SHOP_GEAR = {
  fannyPack: {
    effects: [{ by: "fannyPackStart", kind: "modifier", operation: "add", stat: "startMoney" }],
    name: "Fanny pack",
    price: "fannyPack",
    short: "Start with extra cash",
  },
  luckyCollar: {
    effects: [{ by: "luckyCollarMax", kind: "modifier", operation: "add", stat: "maxHearts" }],
    name: "Lucky collar",
    price: "luckyCollar",
    short: "+1♥ max for every owner",
  },
  poopBags: {
    effects: [{ kind: "skipOption" }],
    name: "Hall pass",
    price: "poopBags",
    short: "Skip one card a neighborhood",
  },
  runningShoes: {
    effects: [{ by: "runningShoesAgility", kind: "modifier", operation: "add", stat: "agility" }],
    name: "Running shoes",
    price: "runningShoes",
    short: "Faster lane changes",
  },
} as const satisfies Record<string, Gear>;
