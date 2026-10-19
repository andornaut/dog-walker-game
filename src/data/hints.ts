import type { Hint } from "./types";

// First-time hints: one line each, shown the first time its trigger happens and never again.

export const HINTS = {
  accident: {
    text: "Left too long, a need goes wrong.",
    trigger: { kind: "accident" },
  },
  areaEffect: {
    text: "Clouds and puddles catch some dogs, not always all.",
    trigger: { kind: "areaEffect" },
  },
  card: {
    text: "Every card shows what happens. Hold one for details.",
    trigger: { kind: "card" },
  },
  drag: {
    text: "Drag to steer. Each lane-width you drag moves one lane.",
    trigger: { kind: "drag" },
  },
  firedOwner: {
    text: "At 0♥ an owner fires you and takes back their fees.",
    trigger: { kind: "firedOwner" },
  },
  forcedStop: {
    text: "Each zone has one stop you can't dodge.",
    trigger: { kind: "forcedStop" },
  },
  fork: {
    text: "Pick the next zone. Right is harder, and pays more.",
    trigger: { kind: "fork" },
  },
  homeButton: {
    text: "Home ends the walk. You keep earlier zones' fees.",
    trigger: { kind: "homeButton" },
  },
  luckyFind: {
    text: "Some bumps are lucky. Aim for them!",
    trigger: { kind: "luckyFind" },
  },
  minorBump: {
    text: "Cones and bins cost a few tips and a stumble. No card.",
    trigger: { kind: "minorBump" },
  },
  needSpot: {
    text: "Spots meet needs. Urgent ones cheer the owner.",
    trigger: { kind: "needSpot" },
  },
  needUrgent: {
    text: "A bubble means a need. Steer into its spot.",
    trigger: { kind: "needUrgent" },
  },
  puddle: {
    text: "Puddles splash some dogs. Fancy owners mind most.",
    trigger: { encounter: "puddle", kind: "encounter" },
  },
  pull: {
    text: "A bubble and a dotted line mean a pull. Drag back.",
    trigger: { kind: "pull" },
  },
  skunk: {
    text: "A skunk's cloud catches some dogs, not always all.",
    trigger: { encounter: "skunk", kind: "encounter" },
  },
  squirrel: {
    text: "Chasers want that squirrel. Hold tight or let them chase.",
    trigger: { encounter: "squirrel", kind: "encounter" },
  },
  stinky: {
    text: "Stinky: tips are halved until the zone ends.",
    trigger: { debuff: "stinky", kind: "debuff" },
  },
  strip: {
    text: "Tap an icon to see what it does.",
    trigger: { kind: "strip" },
  },
  tip: {
    text: "Tips are money. Smaller packs get a little extra.",
    trigger: { kind: "tip" },
  },
  treat: {
    text: "Tap a doghouse to give its owner a treat.",
    trigger: { kind: "treat" },
  },
  upgrade: {
    text: "Pick one. Each card says how long it lasts.",
    trigger: { kind: "upgrade" },
  },
} as const satisfies Record<string, Hint>;
