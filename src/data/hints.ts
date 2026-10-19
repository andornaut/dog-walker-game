import type { Hint } from "./types";

// First-time hints: one line each, shown the first time its trigger happens and never again.

export const HINTS = {
  card: {
    text: "Every card shows what happens. One choice is always free.",
    trigger: { kind: "card" },
  },
  firedOwner: {
    text: "At 0♥ an owner fires you and takes back their dog's fees.",
    trigger: { kind: "firedOwner" },
  },
  forcedStop: {
    text: "Each zone has one stop you can't dodge.",
    trigger: { kind: "forcedStop" },
  },
  luckyFind: {
    text: "Some bumps are lucky. Aim for them!",
    trigger: { kind: "luckyFind" },
  },
  puddle: {
    text: "Puddles splash some dogs. Fancy owners mind most.",
    trigger: { encounter: "puddle", kind: "encounter" },
  },
  pull: {
    text: "A lean and a bark mean a pull is coming. Drag back.",
    trigger: { kind: "pull" },
  },
  stinky: {
    text: "Stinky: tips are halved until the zone ends.",
    trigger: { debuff: "stinky", kind: "debuff" },
  },
  tip: {
    text: "Tips are money. Smaller packs get a little extra.",
    trigger: { kind: "tip" },
  },
  treat: {
    text: "Tap a dog's slot to give its owner a treat.",
    trigger: { kind: "treat" },
  },
} as const satisfies Record<string, Hint>;
