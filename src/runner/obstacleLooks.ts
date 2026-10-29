import { type Random, randomPick } from "@andornaut/game-kit/random";

import type { GameData, MinorLookId, MinorObstacleId, SkinId } from "../data/types";

type LookData = Pick<GameData, "minorObstacles">;

// An obstacle's skins in the data's order, or none for an obstacle with one look.
export function obstacleSkins(data: LookData, obstacle: MinorObstacleId): SkinId[] {
  const entry = data.minorObstacles[obstacle];
  return "skins" in entry ? (Object.keys(entry.skins) as SkinId[]) : [];
}

// The skins of an obstacle that name a zone.
export function zoneSkins(data: LookData, zone: string, obstacle: MinorObstacleId): SkinId[] {
  const entry = data.minorObstacles[obstacle];
  return "skins" in entry
    ? obstacleSkins(data, obstacle).filter((skin) => entry.skins[skin]?.zones.includes(zone))
    : [];
}

// The skin a spawn of an obstacle wears in a zone: one of the zone's skins, evenly, drawn from
// random only when the zone has more than one. An obstacle with one look wears none.
export function pickSkin(
  data: LookData,
  random: Random,
  zone: string,
  obstacle: MinorObstacleId,
): SkinId | undefined {
  if (!("skins" in data.minorObstacles[obstacle])) {
    return undefined;
  }
  const skins = zoneSkins(data, zone, obstacle);
  const [only] = skins;
  if (only === undefined) {
    throw new Error(`${obstacle} has no skin in ${zone}`);
  }
  return skins.length === 1 ? only : randomPick(random, skins);
}

// What an obstacle looks like: its skin, or the obstacle itself when it has one look. One with
// skins given no skin looks like its first: every skin of an obstacle has the same extents
// (obstacleArt.test.ts), so the planner, which picks no skin, spaces and measures it the same.
export function minorLook(data: LookData, obstacle: MinorObstacleId, skin?: SkinId): MinorLookId {
  const [first] = obstacleSkins(data, obstacle);
  if (first === undefined) {
    return obstacle as MinorLookId;
  }
  return skin ?? first;
}

// An obstacle's name as it looks: its skin's, or its own.
export function minorObstacleName(
  data: LookData,
  obstacle: MinorObstacleId,
  skin?: SkinId,
): string {
  const entry = data.minorObstacles[obstacle];
  if (!("skins" in entry)) {
    return entry.name;
  }
  const look = minorLook(data, obstacle, skin);
  const named = entry.skins[look];
  if (named === undefined) {
    throw new Error(`${obstacle} has no skin ${look}`);
  }
  return named.name;
}

// Every look of an obstacle: its skins, or itself.
export function minorLooks(data: LookData, obstacle: MinorObstacleId): MinorLookId[] {
  const skins = obstacleSkins(data, obstacle);
  return skins.length > 0 ? skins : [obstacle as MinorLookId];
}

// Every name an obstacle goes by: each skin's, or its own.
export function minorObstacleNames(data: LookData, obstacle: MinorObstacleId): string[] {
  const entry = data.minorObstacles[obstacle];
  return "skins" in entry ? Object.values(entry.skins).map(({ name }) => name) : [entry.name];
}
