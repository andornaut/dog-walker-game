import type { Upgrade } from "./types";

// Run-only boosts offered between zones. A picked card leaves the pool for the rest of the run.
export const UPGRADES = {
  bellyRubs: {
    effects: [{ amount: 1, kind: "hearts", target: { kind: "all" } }],
    kind: "boost",
    name: "Belly rubs",
  },
  bigTipper: {
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
    effects: [{ duration: "run", encounter: "puddle", kind: "immune" }],
    kind: "boost",
    name: "Raincoats",
  },
  rushHour: {
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
  shortcut: {
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
  steadyHands: {
    effects: [
      {
        by: "steadyHandsPullFrequency",
        duration: "run",
        kind: "modifier",
        operation: "multiply",
        stat: "pullFrequency",
      },
    ],
    kind: "boost",
    name: "Steady hands",
  },
  sweetTalker: {
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
