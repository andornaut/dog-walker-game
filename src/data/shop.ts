import type { Gear } from "./types";

// Permanent gear, bought once and kept. Take up to counts.loadoutMax on a run.
// Locked dogs are sold too: those with unlock "shop" in dogs.ts, at money.prices.lockedDog.
export const SHOP_GEAR = {
  fannyPack: {
    effects: [{ by: "fannyPackStart", kind: "modifier", operation: "add", stat: "startMoney" }],
    name: "Fanny pack",
    price: "fannyPack",
  },
  luckyCollar: {
    effects: [
      { by: "luckyCollarStart", kind: "modifier", operation: "add", stat: "startHearts" },
      { by: "luckyCollarMax", kind: "modifier", operation: "add", stat: "maxHearts" },
    ],
    name: "Lucky collar",
    price: "luckyCollar",
  },
  poopBags: {
    effects: [{ kind: "skipOption", usesPerRun: "poopBagsSkipsPerRun" }],
    name: "Poop bags",
    price: "poopBags",
  },
  runningShoes: {
    effects: [
      { by: "runningShoesInputLock", kind: "modifier", operation: "multiply", stat: "inputLock" },
    ],
    name: "Running shoes",
    price: "runningShoes",
  },
  whistle: {
    effects: [{ duration: "run", encounter: "thief", kind: "immune" }],
    name: "Whistle",
    price: "whistle",
  },
} as const satisfies Record<string, Gear>;
