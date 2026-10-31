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

export const MOVEMENT_PROFILES: Readonly<Partial<Record<MovementProfileId, SignatureProfile>>> = {};

export const MOVEMENT_ASSIGNMENTS: Readonly<
  Partial<Record<EncounterId | MinorObstacleId, MovementAssignment>>
> = {};
