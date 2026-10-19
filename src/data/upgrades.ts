import type { Upgrade } from "./types";

// Run-only boosts offered between zones. A picked card leaves the pool for the rest of the run.
// art is a key into the art manifest's images.
export const UPGRADES = {
  bellyRubs: {
    art: "card-belly-rubs",
    effects: [{ amount: 1, kind: "hearts", target: { kind: "all" } }],
    kind: "boost",
    name: "Belly rubs",
  },
  bigTipper: {
    art: "card-big-tipper",
    effects: [
      {
        by: "bigTipperTip",
        duration: "run",
        kind: "modifier",
        operation: "multiply",
        stat: "tipValue",
      },
    ],
    kind: "boost",
    name: "Big tipper",
  },
  goodLeash: {
    art: "card-good-leash",
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
    effects: [{ duration: "run", encounter: "puddle", kind: "immune" }],
    kind: "boost",
    name: "Raincoats",
  },
  rushHour: {
    art: "card-rush-hour",
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
    effects: [{ amount: 2, kind: "hearts", target: { kind: "unhappiest" } }],
    kind: "boost",
    name: "Second wind",
  },
  shortcut: {
    art: "card-shortcut",
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
