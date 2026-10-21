import type { Hint } from "./types";

// First-time hints: one line each on the walk's message strip, shown the first time its
// trigger happens and never again.

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
  forcedStop: {
    text: "Each zone has one stop you can't dodge.",
    trigger: { kind: "forcedStop" },
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
  needSpot: {
    text: "Spots meet needs. Urgent ones cheer the owner.",
    trigger: { kind: "needSpot" },
  },
  needUrgent: {
    text: "A bubble means a need. Steer into its spot.",
    trigger: { kind: "needUrgent" },
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
  spooked: {
    text: "Spooked: lane changes are slower for a while. A treat calms them.",
    trigger: { debuff: "spooked", kind: "debuff" },
  },
  squirrel: {
    text: "Squirrel! Chase or hold tight.",
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
    text: "Tips are $1 each.",
    trigger: { kind: "tip" },
  },
  treat: {
    text: "A treat gives its dog's owner 1♥.",
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
