import type { Hint } from "./types";

// First-time hints: one line each, shown the first time its trigger happens and never again.

export const HINTS = {
  card: {
    text: "Each option shows its cost. Hold one.",
    trigger: { kind: "card" },
  },
  drag: {
    text: "Drag to steer, farther for more lanes.",
    trigger: { kind: "drag" },
  },
  firedOwner: {
    text: "At 0♥ an owner fires you. Treats help!",
    trigger: { kind: "firedOwner" },
  },
  fork: {
    text: "Pick a path. Harder ones pay more.",
    trigger: { kind: "fork" },
  },
  homeButton: {
    text: "Head home ends the walk. Pay stays.",
    trigger: { kind: "homeButton" },
  },
  luckyFind: {
    text: "Some bumps are lucky. Aim for them!",
    trigger: { kind: "luckyFind" },
  },
  minorBump: {
    text: "A plain bump costs that dog's owner 1♥.",
    trigger: { kind: "minorBump" },
  },
  moverCue: {
    text: "Watch the arrow: that one's about to move.",
    trigger: { kind: "moverCue" },
  },
  puddle: {
    text: "Puddles make the pack Muddy.",
    trigger: { encounter: "puddle", kind: "encounter" },
  },
  pull: {
    text: "A dog is straining! Steer away to cancel.",
    trigger: { kind: "pull" },
  },
  skunk: {
    text: "A skunk's cloud catches every dog.",
    trigger: { encounter: "skunk", kind: "encounter" },
  },
  squirrel: {
    text: "Squirrels are safe. Other animals bump!",
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
