import { MINOR_OBSTACLES } from "./minorObstacles";
import type {
  EncounterId,
  MinorObstacleId,
  MovementAssignment,
  MovementProfileId,
  SignatureProfile,
} from "./types";

export const MOVEMENT_PROFILE_KEYS = [
  "cartTurnExit",
  "ducklingTrail",
  "gardenRectangle",
  "reflectingRoll",
  "skatingArcs",
  "twoMerges",
] as const;

// Finish margins are actual seconds until contact after the defining path completes;
// the planner accounts for each component's continuing velocity and footprint.
export const MOVEMENT_PROFILES: Readonly<Partial<Record<MovementProfileId, SignatureProfile>>> = {
  cartTurnExit: {
    downSeconds: 0.8,
    finishAheadSeconds: 0.6,
    kind: "turnExit",
    lanesPerSecond: 1.5,
    rows: 1,
    warningSeconds: 0.6,
  },
  ducklingTrail: {
    anchor: { x: 10, y: 23 },
    bendSeconds: 0.55,
    bends: { max: 3, min: 2 },
    downFactor: 0.2,
    finishAheadSeconds: 0.6,
    followerDelays: [0.3, 0.6],
    frame: { height: 24, width: 20 },
    kind: "delayedTrail",
    laneStep: 1,
    spriteKey: "chase-duckling",
    straightSeconds: 0.6,
    warningSeconds: 0.6,
  },
  gardenRectangle: {
    finishAheadSeconds: 0.6,
    kind: "rectangle",
    lanes: 1,
    legSeconds: 0.7,
    rows: 1,
    warningSeconds: 0.6,
  },
  reflectingRoll: {
    downFactor: 0.12,
    finishAheadSeconds: 0.6,
    kind: "reflectingDiagonal",
    lanesPerSecond: 2,
    reflections: { max: 2, min: 1 },
    warningSeconds: 0.6,
  },
  skatingArcs: {
    arcSeconds: 0.8,
    arcs: { max: 3, min: 2 },
    downFactor: 0.3,
    finishAheadSeconds: 0.6,
    kind: "alternatingArcs",
    laneStep: 1,
    warningSeconds: 0.6,
  },
  twoMerges: {
    count: 2,
    downFactor: 0.4,
    finishAheadSeconds: 0.6,
    kind: "successiveMerges",
    laneStep: 1,
    mergeSeconds: 0.45,
    straightSeconds: 0.65,
    warningSeconds: 0.6,
  },
};

export const MOVEMENT_ASSIGNMENTS: Readonly<
  Partial<Record<EncounterId | MinorObstacleId, MovementAssignment>>
> = {
  ducklings: {
    default: MINOR_OBSTACLES.ducklings.movement,
    kind: "byZone",
    zones: { highPark: { kind: "profile", profile: "ducklingTrail" } },
  },
  gardener: {
    default: MINOR_OBSTACLES.gardener.movement,
    kind: "byZone",
    zones: { cabbagetown: { kind: "profile", profile: "gardenRectangle" } },
  },
  grannyCartShopper: {
    default: MINOR_OBSTACLES.grannyCartShopper.movement,
    kind: "byZone",
    zones: { kensingtonMarket: { kind: "profile", profile: "cartTurnExit" } },
  },
  rollerblader: {
    default: MINOR_OBSTACLES.rollerblader.movement,
    kind: "byZone",
    zones: { theBeaches: { kind: "profile", profile: "skatingArcs" } },
  },
  rollingBarrel: {
    default: MINOR_OBSTACLES.rollingBarrel.movement,
    kind: "byZone",
    zones: { distilleryDistrict: { kind: "profile", profile: "reflectingRoll" } },
  },
  taxi: {
    default: MINOR_OBSTACLES.taxi.movement,
    kind: "byZone",
    zones: { yongeStreet: { kind: "profile", profile: "twoMerges" } },
  },
};
