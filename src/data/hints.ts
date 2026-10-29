import type { Hint } from "./types";

// First-time hints: one line each, shown the first time its trigger happens and never again.

export const HINTS = {
  card: {
    text: "Hold an option for details.",
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
    text: "Easiest path left, hardest right.",
    trigger: { kind: "fork" },
  },
  homeButton: {
    text: "Return home anytime from the pause menu.",
    trigger: { kind: "homeButton" },
  },
  luckyFind: {
    text: "Aim for lucky finds!",
    trigger: { kind: "luckyFind" },
  },
  minorBump: {
    text: "A bump costs the dog's owner 1♥.",
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
  pothole: {
    text: "Potholes make the pack Muddy.",
    trigger: { encounter: "pothole", kind: "encounter" },
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
    text: "Squirrels never bump you, but dogs pull toward them.",
    trigger: { kind: "pullLanded" },
  },
  tip: {
    text: "Tips are cash on top of pay.",
    trigger: { kind: "tip" },
  },
  treat: {
    text: "A treat gives its dog's owner +1♥.",
    trigger: { kind: "treat" },
  },
} as const satisfies Record<string, Hint>;
