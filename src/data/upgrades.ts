import type { Upgrade } from "./types";

// Run-only boosts offered between zones. A picked card leaves the pool for the rest of the run.
// duration is how long its effects last, which its plaque shows: now, the next zone, or the
// whole run.
// art is a key into the art manifest's images.
export const UPGRADES = {
  bellyRubs: {
    art: "card-belly-rubs",
    duration: "now",
    effect: "+1♥ for every owner",
    effects: [{ amount: 1, kind: "hearts", target: { kind: "all" } }],
    kind: "boost",
    name: "Belly rubs",
  },
  bigTipper: {
    art: "card-big-tipper",
    duration: "nextZone",
    effect: "+$1 per tip",
    effects: [
      {
        by: "bigTipperTipBonus",
        duration: "nextZone",
        kind: "modifier",
        operation: "add",
        stat: "tipValue",
      },
    ],
    kind: "boost",
    name: "Big tipper",
  },
  goodLeash: {
    art: "card-good-leash",
    duration: "run",
    effect: "No squirrel pulls",
    effects: [
      {
        by: "goodLeashSquirrelPull",
        duration: "run",
        kind: "modifier",
        operation: "multiply",
        stat: "squirrelPulls",
      },
    ],
    kind: "boost",
    name: "Good leash",
  },
  raincoats: {
    art: "card-raincoats",
    duration: "run",
    effect: "No Muddy from puddles",
    effects: [{ duration: "run", encounter: "puddle", kind: "immune" }],
    kind: "boost",
    name: "Raincoats",
  },
  rushHour: {
    art: "card-rush-hour",
    duration: "nextZone",
    effect: "Tips, treats ×2, more obstacles",
    effects: [
      {
        by: "rushHourTips",
        duration: "nextZone",
        kind: "modifier",
        operation: "multiply",
        stat: "tipSpawns",
      },
      {
        by: "rushHourObstacles",
        duration: "nextZone",
        kind: "modifier",
        operation: "multiply",
        stat: "obstacleSpawns",
      },
      {
        by: "rushHourTreats",
        duration: "nextZone",
        kind: "modifier",
        operation: "multiply",
        stat: "treatSpawns",
      },
    ],
    kind: "tradeOff",
    name: "Rush hour",
  },
  sweetTalker: {
    art: "card-sweet-talker",
    duration: "run",
    effect: "First card: cash options free",
    effects: [
      {
        by: "sweetTalkerFreeCards",
        duration: "run",
        kind: "modifier",
        operation: "add",
        stat: "freeCards",
      },
    ],
    kind: "boost",
    name: "Sweet talker",
  },
} as const satisfies Record<string, Upgrade>;
