import type { Hint } from "./types";

// First-time hints: one line each, shown the first time its trigger happens and never again.

export const HINTS = {
  accident: {
    text: "Left too long, a need goes wrong.",
    trigger: { kind: "accident" },
  },
  areaEffect: {
    text: "Small dogs hop over puddles. Skunks get everyone.",
    trigger: { kind: "areaEffect" },
  },
  card: {
    text: "Every card shows what happens. Hold one for details.",
    trigger: { kind: "card" },
  },
  firedOwner: {
    text: "At 0♥ an owner fires you. Their fees from earlier zones stay yours.",
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
    text: "Puddles soak all but small dogs. Fancy owners mind most.",
    trigger: { encounter: "puddle", kind: "encounter" },
  },
  pull: {
    text: "A bubble and a dotted line mean a pull. Drag back.",
    trigger: { kind: "pull" },
  },
  skunk: {
    text: "A skunk's cloud catches every dog.",
    trigger: { encounter: "skunk", kind: "encounter" },
  },
  spooked: {
    text: "Spooked: lane changes are slower for a while. A treat calms them.",
    trigger: { debuff: "spooked", kind: "debuff" },
  },
  squirrel: {
    text: "Chasers want that squirrel. Hold tight or let them chase.",
    trigger: { encounter: "squirrel", kind: "encounter" },
  },
  stinky: {
    text: "Stinky: half as many tips appear until the zone ends.",
    trigger: { debuff: "stinky", kind: "debuff" },
  },
  strip: {
    text: "Tap an icon to see what it does.",
    trigger: { kind: "strip" },
  },
  tangled: {
    text: "Tangled: each lane change makes the next one wait. A treat sorts them out.",
    trigger: { debuff: "tangled", kind: "debuff" },
  },
  tip: {
    text: "Each tip is $1. Smaller packs see a few more.",
    trigger: { kind: "tip" },
  },
  treat: {
    text: "Tap a doghouse to give its owner a treat.",
    trigger: { kind: "treat" },
  },
  tuckeredOut: {
    text: "Tuckered out: needs turn urgent faster until the zone ends. A treat perks them up.",
    trigger: { debuff: "tuckeredOut", kind: "debuff" },
  },
  upgrade: {
    text: "Pick one. Each card says how long it lasts.",
    trigger: { kind: "upgrade" },
  },
} as const satisfies Record<string, Hint>;
