import type { Hint } from "./types";

// First-time hints: one line each on the walk's message strip, shown the first time its
// trigger happens and never again.

export const HINTS = {
  card: {
    text: "Hold a card for details.",
    trigger: { kind: "card" },
  },
  drag: {
    text: "Drag left or right to steer.",
    trigger: { kind: "drag" },
  },
  firedOwner: {
    text: "At 0♥ an owner quits. Their pay is lost.",
    trigger: { kind: "firedOwner" },
  },
  fork: {
    text: "Pick a path and its upgrade.",
    trigger: { kind: "fork" },
  },
  homeButton: {
    text: "Home banks your cash now.",
    trigger: { kind: "homeButton" },
  },
  luckyFind: {
    text: "Bobbing things are good. Grab!",
    trigger: { kind: "luckyFind" },
  },
  minorBump: {
    text: "A bump costs that dog's owner 1♥.",
    trigger: { kind: "minorBump" },
  },
  puddle: {
    text: "Puddle! Towel off or splash.",
    trigger: { encounter: "puddle", kind: "encounter" },
  },
  pull: {
    text: "Steer away to stop a pull.",
    trigger: { kind: "pull" },
  },
  skunk: {
    text: "Skunk! Pick how to clean up.",
    trigger: { encounter: "skunk", kind: "encounter" },
  },
  squirrel: {
    text: "Squirrel! Chase or hold tight.",
    trigger: { encounter: "squirrel", kind: "encounter" },
  },
  tip: {
    text: "Tips are $1 each.",
    trigger: { kind: "tip" },
  },
  treat: {
    text: "A treat gives its dog's owner 1♥.",
    trigger: { kind: "treat" },
  },
} as const satisfies Record<string, Hint>;
