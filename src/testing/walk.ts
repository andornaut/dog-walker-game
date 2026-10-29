// The walk tests' data, road and helpers that build and step a walk.
import { seededRandom } from "@andornaut/game-kit/random";

import { DEBUFFS } from "../data/debuffs";
import { DOGS } from "../data/dogs";
import { ENCOUNTERS } from "../data/encounters";
import { HOME_TEXT } from "../data/homeText";
import { MINOR_OBSTACLES } from "../data/minorObstacles";
import { RUN_TEXT } from "../data/runText";
import { SHOP_GEAR } from "../data/shop";
import { TUNING } from "../data/tuning";
import { UPGRADES } from "../data/upgrades";
import { stillInLane } from "../runner/laneMotion";
import { startRoad, stepWalk, type Walk } from "../runner/walk";
import { type WalkItem } from "../runner/walkItems";
import { mapPack } from "../state/pack";
import { newRun, type PackDogs } from "../state/runState";
import { clampHearts } from "../units";
import { TEST_ROAD_GEOMETRY } from "./packGeometry";
import { TEST_TUNING } from "./tuning";
import { TEST_WALKER_DATA } from "./walkers";
import { TEST_WORLD } from "./world";

// 80px/s for 30s is a 2400px zone: 14 rows of spawns 160px apart.
export const tuning = {
  ...TEST_TUNING,
  counts: {
    ...TEST_TUNING.counts,
    luckyFindsPerZone: { friendlyNeighbour: 1, lostWallet: 1 },
    minorObstaclesFirstZone: 4,
    minorObstaclesGainPerZone: 1,
    obstaclesFirstZone: 6,
    obstaclesGainPerZone: 1,
    tipsFirstZone: 8,
    tipsGainPerZone: 1,
    treatsPerZone: 2,
  },
  pixels: { ...TUNING.pixels, roadScrollSpeed: 80, spawnRowSpacing: 160 },
  seconds: {
    ...TEST_TUNING.seconds,
    collisionGrace: 1,
    hitStopSeconds: 1,
    laneMove: 0.18,
    minorHitStopSeconds: 0.6,
    zoneAtBaseSpeed: 30,
  },
};
export const data = {
  debuffs: DEBUFFS,
  dogs: DOGS,
  encounters: ENCOUNTERS,
  homeText: HOME_TEXT,
  minorObstacles: MINOR_OBSTACLES,
  runText: RUN_TEXT,
  shopGear: SHOP_GEAR,
  ...TEST_WALKER_DATA,
  tuning,
  upgrades: UPGRADES,
  world: TEST_WORLD,
};

export const geometry = TEST_ROAD_GEOMETRY;

export const walkWith = (dogs: PackDogs, items: WalkItem[] = []): Walk => ({
  road: { ...startRoad(5), items, nextItemId: items.length },
  run: newRun(data, 3, { dogs, gear: null, walker: "casey" }),
});
export const RAINCOATS = { kind: "upgrade", upgrade: "raincoats" } as const;
// An item in the middle lane, its bottom just inside the pack's band.
export const atPack = (kind: WalkItem["kind"], id = 0, lane = 2, laneSpan = 1): WalkItem => ({
  height: 12,
  id,
  kind,
  lane,
  laneSpan,
  y: 560,
});
// The walk with the pack standing still in lane.
export const inLane = (lane: number, walk: Walk): Walk => ({
  ...walk,
  road: {
    ...walk.road,
    control: { ...walk.road.control, motion: stillInLane(lane), target: lane },
  },
});
// The walk with every owner at hearts.
export const withHearts = (hearts: number, walk: Walk): Walk => ({
  ...walk,
  run: {
    ...walk.run,
    pack: mapPack(
      (slot) =>
        slot.status === "walking" ? { ...slot, hearts: clampHearts(hearts, hearts) } : slot,
      walk.run.pack,
    ),
  },
});
export const graced = (walk: Walk): Walk => ({
  ...walk,
  road: { ...walk.road, invulnerableSeconds: 0.5 },
});
export const step = (walk: Walk, seconds = 0.01) =>
  stepWalk(data, geometry, seededRandom(1), seconds, walk);
