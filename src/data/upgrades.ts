import type { Upgrade } from "./types";

// Run-only boosts offered between zones. A picked card leaves the pool for the rest of the run.
// duration is how long its effects last, which its plaque shows: now, the next zone, or the
// whole run.
// art is a key into the art manifest's images.
export const UPGRADES = {
  bellyRubs: {
    art: "card-belly-rubs",
    duration: "now",
    effects: [{ amount: 1, kind: "hearts", target: { kind: "all" } }],
    kind: "boost",
    name: "Belly rubs",
  },
  bigTipper: {
    art: "card-big-tipper",
    duration: "run",
    effects: [
      {
        by: "bigTipperTipBonus",
        duration: "run",
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
    effects: [
      { duration: "run", encounter: "squirrel", kind: "immune" },
      {
        by: "goodLeashSquirrelPull",
        duration: "run",
        kind: "modifier",
        operation: "multiply",
        stat: "chaserSquirrelPulls",
      },
    ],
    kind: "boost",
    name: "Good leash",
  },
  raincoats: {
    art: "card-raincoats",
    duration: "run",
    effects: [{ duration: "run", encounter: "puddle", kind: "immune" }],
    kind: "boost",
    name: "Raincoats",
  },
  rushHour: {
    art: "card-rush-hour",
    duration: "nextZone",
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
    ],
    kind: "tradeOff",
    name: "Rush hour",
  },
  secondWind: {
    art: "card-second-wind",
    duration: "now",
    effects: [{ amount: 2, kind: "hearts", target: { kind: "unhappiest" } }],
    kind: "boost",
    name: "Second wind",
  },
  shortcut: {
    art: "card-shortcut",
    duration: "nextZone",
    effects: [
      {
        by: "shortcutZoneLength",
        duration: "nextZone",
        kind: "modifier",
        operation: "multiply",
        stat: "zoneLength",
      },
      {
        by: "shortcutFees",
        duration: "nextZone",
        kind: "modifier",
        operation: "multiply",
        stat: "fees",
      },
    ],
    kind: "tradeOff",
    name: "Shortcut",
  },
  sweetTalker: {
    art: "card-sweet-talker",
    duration: "run",
    effects: [
      {
        by: "sweetTalkerCostPerDog",
        duration: "run",
        kind: "modifier",
        operation: "add",
        stat: "costPerDog",
      },
    ],
    kind: "boost",
    name: "Sweet talker",
  },
  treatMagnet: {
    art: "card-treat-magnet",
    duration: "run",
    effects: [
      {
        by: "treatMagnetReachLanes",
        duration: "run",
        kind: "modifier",
        operation: "add",
        stat: "treatReach",
      },
    ],
    kind: "boost",
    name: "Treat magnet",
  },
} as const satisfies Record<string, Upgrade>;
