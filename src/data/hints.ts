import type { Hint } from "./types";

// First-time hints: one line each, shown the first time its trigger happens and never again.

export const HINTS = {
  card: {
    text: "Each option shows its cost. Hold one for details.",
    trigger: { kind: "card" },
  },
  drag: {
    text: "Drag farther to move more lanes.",
    trigger: { kind: "drag" },
  },
  firedOwner: {
    text: "Owners fire you at 0♥. Treats help!",
    trigger: { kind: "firedOwner" },
  },
  fork: {
    text: "Pick a path: each brings an upgrade.",
    trigger: { kind: "fork" },
  },
  homeButton: {
    text: "Head home ends the walk early.",
    trigger: { kind: "homeButton" },
  },
  luckyFind: {
    text: "Some bumps are lucky. Aim for them!",
    trigger: { kind: "luckyFind" },
  },
  minorBump: {
    text: "A plain bump costs its owner 1♥.",
    trigger: { kind: "minorBump" },
  },
  moverCue: {
    text: "Watch the arrow: it's about to move.",
    trigger: { kind: "moverCue" },
  },
  packBonus: {
    text: "Small pack: extra ♥ for your lead.",
    trigger: { kind: "packBonus" },
  },
  puddle: {
    text: "Puddles make the pack Muddy.",
    trigger: { encounter: "puddle", kind: "encounter" },
  },
  pull: {
    text: "Straining dog! Steer away to cancel.",
    trigger: { kind: "pull" },
  },
  skunk: {
    text: "A skunk's cloud catches every dog.",
    trigger: { encounter: "skunk", kind: "encounter" },
  },
  squirrel: {
    text: "Squirrels never bump, but they tempt a pull.",
    trigger: { kind: "pullLanded" },
  },
  tip: {
    text: "Each tip is $1. Grab all you can!",
    trigger: { kind: "tip" },
  },
  treat: {
    text: "A treat gives its dog's owner +1♥.",
    trigger: { kind: "treat" },
  },
} as const satisfies Record<string, Hint>;
