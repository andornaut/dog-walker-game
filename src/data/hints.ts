import type { Hint } from "./types";

// First-time hints: one line each, shown the first time its trigger happens and never again.

export const HINTS = {
  card: {
    text: "Every card shows its outcome. One option is always free.",
    trigger: { kind: "card" },
  },
  firedOwner: {
    text: "An owner at 0 hearts fires you and takes back their dog's fees.",
    trigger: { kind: "firedOwner" },
  },
  forcedStop: {
    text: "Every zone has one stop you can't dodge.",
    trigger: { kind: "forcedStop" },
  },
  luckyFind: {
    text: "Some bumps are lucky. Run into them on purpose!",
    trigger: { kind: "luckyFind" },
  },
  puddle: {
    text: "Puddles splash some dogs. Fancy owners mind it most.",
    trigger: { encounter: "puddle", kind: "encounter" },
  },
  pull: {
    text: "A dog that leans and barks is about to pull. Steer back.",
    trigger: { kind: "pull" },
  },
  stinky: {
    text: "Stinky: tips are halved until the zone ends.",
    trigger: { debuff: "stinky", kind: "debuff" },
  },
  tip: {
    text: "Tips are money. A smaller pack earns bigger tips.",
    trigger: { kind: "tip" },
  },
  treat: {
    text: "Tap a dog's slot to give its owner a treat.",
    trigger: { kind: "treat" },
  },
} as const satisfies Record<string, Hint>;
