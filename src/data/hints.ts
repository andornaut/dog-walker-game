import type { Hint } from "./types";

// First-time hints: one line each, shown the first time its trigger happens and never again.

export const HINTS = {
  card: {
    text: "Every option shows its cost. Hold for more.",
    trigger: { kind: "card" },
  },
  drag: {
    text: "Drag to steer. Drag farther for more lanes.",
    trigger: { kind: "drag" },
  },
  firedOwner: {
    text: "At 0♥ an owner fires you. Treats help!",
    trigger: { kind: "firedOwner" },
  },
  fork: {
    text: "Pick a path and its upgrade.",
    trigger: { kind: "fork" },
  },
  homeButton: {
    text: "Home ends the walk. Banked pay stays banked.",
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
  puddle: {
    text: "A puddle splashes the whole pack.",
    trigger: { encounter: "puddle", kind: "encounter" },
  },
  pull: {
    text: "A dog spotted a squirrel! Steer away.",
    trigger: { kind: "pull" },
  },
  skunk: {
    text: "A skunk's cloud catches every dog.",
    trigger: { encounter: "skunk", kind: "encounter" },
  },
  squirrel: {
    text: "Every dog wants that squirrel!",
    trigger: { encounter: "squirrel", kind: "encounter" },
  },
  tip: {
    text: "Each tip is $1. Grab all you can!",
    trigger: { kind: "tip" },
  },
  treat: {
    text: "Treats give that dog's owner +1♥.",
    trigger: { kind: "treat" },
  },
} as const satisfies Record<string, Hint>;
