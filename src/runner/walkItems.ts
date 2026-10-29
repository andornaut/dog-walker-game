import type {
  Encounter,
  EncounterId,
  GameData,
  GearId,
  MinorObstacleId,
  Movement,
  SkinId,
} from "../data/types";
import type { MoverItem } from "./movers";
import { type Footprint, SINGLE_CELL, type SpawnEvent } from "./spawning";

export type PickupKind = "tip" | "treat";
// A road item's kind: an encounter, a minor obstacle, a pickup, or a gear drop by its gear.
export type WalkItemKind = EncounterId | GearId | MinorObstacleId | PickupKind;
// skin is the look a minor obstacle with skins wears (pickSkin), picked as its zone is planned.
export type WalkItem = MoverItem<WalkItemKind> & { readonly skin?: SkinId };
export type WalkSpawn = SpawnEvent<WalkItemKind> & { readonly skin?: SkinId };
// What a road item is to the rules: an obstacle hit by accident, a minor obstacle that opens
// no card, a lucky encounter, a gear drop, or a pickup.
export type ItemCategory = "gear" | "lucky" | "minor" | "obstacle" | PickupKind;

export function isMinorObstacle(
  data: Pick<GameData, "minorObstacles">,
  kind: WalkItemKind,
): kind is MinorObstacleId {
  return Object.hasOwn(data.minorObstacles, kind);
}

// A gear drop: a kind that is no pickup, minor obstacle or encounter, so one of the gear.
export function isGearDrop(
  data: Pick<GameData, "encounters" | "minorObstacles">,
  kind: WalkItemKind,
): kind is GearId {
  return !isPickup(kind) && !isMinorObstacle(data, kind) && !Object.hasOwn(data.encounters, kind);
}

export function itemCategory(
  data: Pick<GameData, "encounters" | "minorObstacles">,
  kind: WalkItemKind,
): ItemCategory {
  if (isPickup(kind)) {
    return kind;
  }
  if (isGearDrop(data, kind)) {
    return "gear";
  }
  return isMinorObstacle(data, kind) ? "minor" : data.encounters[kind as EncounterId].kind;
}

// The lanes and rows an item covers: an obstacle's shape, or one cell.
export function footprintOf(
  data: Pick<GameData, "encounters" | "minorObstacles">,
  kind: WalkItemKind,
): Footprint {
  if (isPickup(kind) || isGearDrop(data, kind)) {
    return SINGLE_CELL;
  }
  if (isMinorObstacle(data, kind)) {
    return data.minorObstacles[kind].shape;
  }
  const encounter = data.encounters[kind as EncounterId];
  return encounter.kind === "obstacle" ? encounter.shape : SINGLE_CELL;
}

export type ObstacleKind = EncounterId | MinorObstacleId;

// Whether a category is an obstacle's, minor or not.
export function isObstacleCategory(category: ItemCategory): category is "minor" | "obstacle" {
  return category === "minor" || category === "obstacle";
}

// Obstacles, minor or not, which hit as they are drawn.
export function isObstacle(
  data: Pick<GameData, "encounters" | "minorObstacles">,
  kind: WalkItemKind,
): kind is ObstacleKind {
  return isObstacleCategory(itemCategory(data, kind));
}

// How an obstacle that is an encounter resolves, or null for anything else.
function obstacleResolution(
  data: Pick<GameData, "encounters" | "minorObstacles">,
  kind: WalkItemKind,
): Encounter["resolution"]["kind"] | null {
  return itemCategory(data, kind) === "obstacle"
    ? data.encounters[kind as EncounterId].resolution.kind
    : null;
}

// An obstacle touching does nothing to, such as a squirrel: dogs pull toward it instead.
export function isPullObstacle(
  data: Pick<GameData, "encounters" | "minorObstacles">,
  kind: WalkItemKind,
): boolean {
  return obstacleResolution(data, kind) === "pull";
}

// What the pack steers around, and the spawn planner keeps a path past: every obstacle but a
// pull obstacle, which passes through the pack. A pull obstacle that moves is planned as a moving
// prize.
export function blocksLane(
  data: Pick<GameData, "encounters" | "minorObstacles">,
  kind: WalkItemKind,
): boolean {
  return isObstacle(data, kind) && !isPullObstacle(data, kind);
}

// Whether a kind is an obstacle that opens a card, which the planner places before every other
// spawn, so it is the last skipped.
export function opensACard(
  data: Pick<GameData, "encounters" | "minorObstacles">,
  kind: WalkItemKind,
): boolean {
  return obstacleResolution(data, kind) === "card";
}

export function isPickup(kind: WalkItemKind): kind is PickupKind {
  return kind === "tip" || kind === "treat";
}

// The movement an obstacle, minor or not, or a lucky encounter can come with, or null for anything
// that never moves.
export function movementOf(
  data: Pick<GameData, "encounters" | "minorObstacles">,
  kind: WalkItemKind,
): Movement | null {
  if (isPickup(kind) || isGearDrop(data, kind)) {
    return null;
  }
  const entry = isMinorObstacle(data, kind) ? data.minorObstacles[kind] : data.encounters[kind];
  const movement = "movement" in entry ? entry.movement : undefined;
  return movement ?? null;
}
