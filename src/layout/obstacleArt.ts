import { MOVER_SPRITE_KEYS, ROAD_SPRITE_SIZE } from "../assets/spriteKeys";
import type { EncounterId, GameData, MinorObstacleId, ZoneId } from "../data/types";
import {
  encounterLook,
  type HasArt,
  minorObstacleLook,
  skinnedArt,
  skinnedCloudArt,
  skinnedOwnerArt,
} from "../rules/skins";
import type { Silhouette } from "./packFormation";

// What an obstacle draws on the road, which is what it collides as: each of its sprites and that
// sprite's opaque pixels. An obstacle hits a dog or the walker where these visibly overlap them.

// Each road obstacle sprite's opaque pixels over all its frames, from the column it is placed on
// and its feet row, as for the pack: left and right columns (right exclusive), and the rows above
// the feet row. Measured on the full-size art; obstacleArt.test.ts checks them against it and
// that every obstacle sprite the art draws is here.
export const OBSTACLE_SILHOUETTES: Readonly<Record<string, Silhouette>> = {
  "ball-bounce": { above: 32, left: -10, right: 10 },
  "barrier-2": { above: 35, left: -56, right: 56 },
  "barrier-3": { above: 35, left: -88, right: 88 },
  bench: { above: 34, left: -55, right: 55 },
  bin: { above: 40, left: -14, right: 14 },
  "chase-cat": { above: 32, left: -10, right: 13 },
  "chase-ducklings": { above: 25, left: -19, right: 19 },
  "chase-pigeons": { above: 31, left: -19, right: 19 },
  "chase-rabbit": { above: 36, left: -19, right: 17 },
  cone: { above: 34, left: -14, right: 14 },
  coyote: { above: 31, left: -21, right: 22 },
  cyclist: { above: 67, left: -20, right: 20 },
  "delivery-truck": { above: 53, left: -28, right: 28 },
  goose: { above: 43, left: -22, right: 22 },
  hedge: { above: 32, left: -88, right: 88 },
  "ice-cream-truck": { above: 59, left: -28, right: 28 },
  jogger: { above: 65, left: -17, right: 18 },
  "kid-on-bike": { above: 59, left: -20, right: 20 },
  "loose-dog": { above: 43, left: -23, right: 22 },
  "mail-carrier": { above: 65, left: -17, right: 20 },
  "minor-scooter": { above: 68, left: -19, right: 19 },
  "other-dog": { above: 40, left: -14, right: 18 },
  "other-dog-owner": { above: 65, left: -17, right: 19 },
  "parked-car": { above: 41, left: -26, right: 26 },
  puddle: { above: 43, left: -54, right: 54 },
  skunk: { above: 42, left: -15, right: 20 },
  "skunk-cloud": { above: 44, left: -54, right: 54 },
  "snatch-raccoon": { above: 44, left: -13, right: 17 },
  "snatch-seagull": { above: 35, left: -16, right: 16 },
  "social-frisbee-dog": { above: 43, left: -20, right: 19 },
  squirrel: { above: 40, left: -13, right: 18 },
  "squirrel-dash": { above: 40, left: -23, right: 22 },
  "stink-garbage-truck": { above: 59, left: -28, right: 28 },
  stroller: { above: 63, left: -23, right: 23 },
  thief: { above: 67, left: -19, right: 23 },
};

// Whether a sprite is drawn, judged by the table: the art the game loads has a silhouette, so
// the simulator and the scene pick the same sprites.
export const hasObstacleArt: HasArt = (key) => Object.hasOwn(OBSTACLE_SILHOUETTES, key);

// Road pixels the skunk stands behind its cloud's near edge, so it reads as inside the spray.
export const SKUNK_IN_CLOUD = 10;
// Road pixels the other dog and its owner stand across from the item's centre.
export const OTHER_DOG_DX = -10;
export const OTHER_DOG_OWNER_DX = 13;

// One sprite of an obstacle: its key, dx across the road from the item's centre and behind up
// the road from its near edge, both in road pixels, and whether it lies flat on the road.
export interface ObstaclePart {
  readonly behind: number;
  readonly dx: number;
  readonly flat: boolean;
  readonly key: string;
}

const part = (key: string, overrides: Partial<Omit<ObstaclePart, "key">> = {}): ObstaclePart => ({
  behind: 0,
  dx: 0,
  flat: false,
  key,
  ...overrides,
});

type ObstacleData = Pick<GameData, "encounters" | "minorObstacles">;

function lookOf(data: ObstacleData, zone: ZoneId, kind: EncounterId | MinorObstacleId) {
  return Object.hasOwn(data.minorObstacles, kind)
    ? minorObstacleLook(data, zone, kind as MinorObstacleId)
    : encounterLook(data, zone, kind as EncounterId);
}

// A mover's body sprite: its kind's road art, or the sprite MOVER_SPRITE_KEYS names for that art
// once it is drawn.
export function moverBodyArt(
  data: ObstacleData,
  has: HasArt,
  zone: ZoneId,
  kind: EncounterId | MinorObstacleId,
): string {
  const art = skinnedArt(has, lookOf(data, zone, kind));
  const sprite = MOVER_SPRITE_KEYS[art];
  return sprite !== undefined && has(sprite) ? sprite : art;
}

// The sprites an obstacle draws in the zone, standing or moving. Each stands at the near edge of
// the item's hit box, however many rows it covers. A puddle lies flat under the rest, and a
// skunk stands just inside the front of its spray cloud, which lies flat too. An obstacle wears
// its skin for the zone, and the other dog's owner stands beside it in the skin's owner art.
export function obstacleParts(
  data: ObstacleData,
  has: HasArt,
  zone: ZoneId,
  kind: EncounterId | MinorObstacleId,
  moving: boolean,
): ObstaclePart[] {
  if (moving) {
    return [part(moverBodyArt(data, has, zone, kind))];
  }
  const look = lookOf(data, zone, kind);
  const art = skinnedArt(has, look);
  if (kind === "skunk") {
    return [
      part(skinnedCloudArt(has, look), { flat: true }),
      part(art, { behind: SKUNK_IN_CLOUD }),
    ];
  }
  const owner = skinnedOwnerArt(has, look);
  if (kind === "otherDog" && has(owner)) {
    return [part(art, { dx: OTHER_DOG_DX }), part(owner, { dx: OTHER_DOG_OWNER_DX })];
  }
  return [part(art, { flat: kind === "puddle" })];
}

// A sprite's silhouette, or, for art not drawn yet, its placeholder's: ROAD_SPRITE_SIZE tall,
// and as wide as its lanes less the lane's spare width beside a 1-lane sprite.
export function obstacleSilhouette(cellLength: number, lanes: number, key: string): Silhouette {
  const measured = OBSTACLE_SILHOUETTES[key];
  if (measured !== undefined) {
    return measured;
  }
  const half = (lanes * cellLength - (cellLength - ROAD_SPRITE_SIZE)) / 2;
  return { above: ROAD_SPRITE_SIZE, left: -half, right: half };
}
