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
    effects: [
      { by: "luckyCollarStart", kind: "modifier", operation: "add", stat: "startHearts" },
      { by: "luckyCollarMax", kind: "modifier", operation: "add", stat: "maxHearts" },
    ],
    name: "Lucky collar",
    price: "luckyCollar",
    short: "+1 ♥ for every owner",
  },
  poopBags: {
    effects: [{ kind: "skipOption", usesPerRun: "poopBagsSkipsPerRun" }],
    name: "Poop bags",
    price: "poopBags",
    short: "One free Skip a walk",
  },
  runningShoes: {
    effects: [
      { by: "runningShoesInputLock", kind: "modifier", operation: "multiply", stat: "inputLock" },
    ],
    name: "Running shoes",
    price: "runningShoes",
    short: "No stumble after a pull",
  },
  whistle: {
    effects: [{ duration: "run", encounter: "thief", kind: "immune" }],
    name: "Whistle",
    price: "whistle",
    short: "Thieves flee",
  },
} as const satisfies Record<string, Gear>;
