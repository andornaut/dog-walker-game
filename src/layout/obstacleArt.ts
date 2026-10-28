import {
  encounterSpriteKey,
  type HasArt,
  minorObstacleSpriteKey,
  MOVER_SPRITE_KEYS,
  ROAD_SPRITE_SIZE,
  SKUNK_CLOUD_KEY,
} from "../assets/spriteKeys";
import type { EncounterId, GameData, MinorObstacleId } from "../data/types";
import type { Silhouette } from "./packFormation";

// What an obstacle draws on the road, which is what it collides as: each of its sprites and that
// sprite's opaque pixels. An obstacle hits a dog or the walker where these visibly overlap them.

// Each road obstacle sprite's opaque pixels over all its frames, from the column it is placed on
// and its feet row, as for the pack: left and right columns (right exclusive), and the rows above
// the feet row. Measured on the full-size art; obstacleArt.test.ts checks them against it and
// that every obstacle sprite the art draws is here.
export const OBSTACLE_SILHOUETTES: Readonly<Record<string, Silhouette>> = {
  "ball-bounce": { above: 32, left: -10, right: 10 },
  "barrel-stack": { above: 42, left: -21, right: 21 },
  "barrier-2": { above: 35, left: -56, right: 56 },
  "barrier-3": { above: 35, left: -88, right: 88 },
  "beach-umbrella": { above: 70, left: -22, right: 21 },
  bench: { above: 34, left: -55, right: 55 },
  busker: { above: 67, left: -23, right: 24 },
  capybara: { above: 33, left: -23, right: 23 },
  "cargo-bike": { above: 70, left: -22, right: 22 },
  "chase-cat": { above: 32, left: -10, right: 13 },
  "chase-ducklings": { above: 25, left: -19, right: 19 },
  "chase-pigeons": { above: 31, left: -19, right: 19 },
  "chase-rabbit": { above: 36, left: -19, right: 17 },
  "cheese-crates": { above: 47, left: -20, right: 21 },
  "clothing-rack": { above: 44, left: -24, right: 24 },
  cone: { above: 34, left: -14, right: 14 },
  couple: { above: 65, left: -37, right: 36 },
  coyote: { above: 31, left: -24, right: 22 },
  cyclist: { above: 67, left: -20, right: 20 },
  "delivery-cyclist": { above: 69, left: -20, right: 24 },
  "delivery-truck": { above: 53, left: -28, right: 28 },
  "dropped-cone": { above: 57, left: -20, right: 24 },
  "fallen-log": { above: 34, left: -55, right: 54 },
  "food-cart-vendor": { above: 67, left: -22, right: 23 },
  gardener: { above: 66, left: -23, right: 24 },
  goose: { above: 43, left: -22, right: 22 },
  "granny-cart-shopper": { above: 65, left: -24, right: 24 },
  "green-bin": { above: 46, left: -24, right: 22 },
  hedge: { above: 32, left: -88, right: 88 },
  hen: { above: 32, left: -18, right: 18 },
  "hopscotch-kid": { above: 63, left: -23, right: 23 },
  "hot-dog-cart": { above: 65, left: -50, right: 50 },
  "ice-cream-bike": { above: 71, left: -24, right: 23 },
  "ice-cream-truck": { above: 59, left: -28, right: 28 },
  jogger: { above: 65, left: -17, right: 18 },
  "keg-dolly-worker": { above: 66, left: -18, right: 18 },
  "kid-on-bike": { above: 59, left: -20, right: 20 },
  "leaf-pile": { above: 29, left: -22, right: 22 },
  "lifeguard-chair": { above: 70, left: -21, right: 21 },
  "little-free-library": { above: 46, left: -20, right: 20 },
  "loose-dog": { above: 43, left: -23, right: 22 },
  "mail-carrier": { above: 65, left: -17, right: 20 },
  "minor-scooter": { above: 68, left: -19, right: 19 },
  "newspaper-box": { above: 37, left: -24, right: 24 },
  "other-dog": { above: 40, left: -14, right: 18 },
  "other-dog-owner": { above: 65, left: -17, right: 19 },
  "parked-car": { above: 41, left: -26, right: 26 },
  "patio-rail": { above: 33, left: -87, right: 87 },
  pedicab: { above: 69, left: -24, right: 24 },
  "picnic-blanket": { above: 30, left: -55, right: 55 },
  "porch-cat": { above: 32, left: -24, right: 20 },
  "porch-steps": { above: 38, left: -24, right: 24 },
  "produce-crates": { above: 33, left: -21, right: 21 },
  "promo-team": { above: 66, left: -23, right: 20 },
  puddle: { above: 43, left: -54, right: 54 },
  "ranger-cart": { above: 70, left: -23, right: 24 },
  rollerblader: { above: 64, left: -21, right: 21 },
  "rolling-barrel": { above: 37, left: -20, right: 19 },
  sandcastle: { above: 43, left: -23, right: 23 },
  "sandwich-board": { above: 43, left: -19, right: 19 },
  "segway-rider": { above: 70, left: -21, right: 24 },
  "sign-spinner": { above: 68, left: -17, right: 18 },
  skunk: { above: 42, left: -15, right: 20 },
  "skunk-cloud": { above: 44, left: -54, right: 54 },
  "snatch-raccoon": { above: 44, left: -13, right: 17 },
  "snatch-seagull": { above: 35, left: -16, right: 16 },
  "social-frisbee-dog": { above: 43, left: -20, right: 19 },
  squirrel: { above: 27, left: -8, right: 16 },
  "squirrel-dash": { above: 23, left: -15, right: 14 },
  "stilt-walker": { above: 94, left: -24, right: 24 },
  "stink-garbage-truck": { above: 59, left: -28, right: 28 },
  streetcar: { above: 65, left: -28, right: 28 },
  stroller: { above: 60, left: -23, right: 24 },
  "strolling-busker": { above: 67, left: -23, right: 24 },
  taxi: { above: 41, left: -27, right: 28 },
  thief: { above: 67, left: -17, right: 21 },
  "tour-group": { above: 68, left: -50, right: 48 },
  tourist: { above: 67, left: -24, right: 19 },
  "tourist-train": { above: 61, left: -87, right: 87 },
  "trash-can": { above: 40, left: -14, right: 14 },
  "ttc-bus": { above: 64, left: -27, right: 27 },
  "velvet-rope": { above: 34, left: -55, right: 55 },
  "volleyball-net-2": { above: 35, left: -56, right: 56 },
  "volleyball-net-3": { above: 35, left: -88, right: 88 },
  "volleyball-player": { above: 62, left: -24, right: 24 },
  "wedding-shoot": { above: 69, left: -53, right: 56 },
};

// A sprite whose poses differ much in size is hit by its pose's silhouette instead, each over
// its tag's frames alone, so a mover is hit as its pose is drawn; OBSTACLE_SILHOUETTES still
// holds its silhouette over every frame, which plans its spacing on the road.
export const POSE_SILHOUETTES: Readonly<Record<string, Readonly<Record<string, Silhouette>>>> = {
  "volleyball-player": {
    dive: { above: 52, left: -24, right: 24 },
    idle: { above: 31, left: -23, right: 24 },
    run: { above: 62, left: -16, right: 21 },
  },
};

// Whether a sprite is drawn, judged by the table: the art the game loads has a silhouette, so
// the simulator and the scene pick the same sprites.
export const hasObstacleArt: HasArt = (key) => Object.hasOwn(OBSTACLE_SILHOUETTES, key);

// Road pixels the skunk stands behind its cloud's near edge, so it reads as inside the spray.
const SKUNK_IN_CLOUD = 10;
// Road pixels the other dog and its owner stand across from the item's centre.
const OTHER_DOG_DX = -10;
const OTHER_DOG_OWNER_DX = 13;

// One sprite of an obstacle: its key, dx across the road from the item's centre and behind up
// the road from its near edge, both in road pixels, and whether it lies flat on the road.
interface ObstaclePart {
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

type ObstacleData = Pick<GameData, "minorObstacles">;

// An obstacle's road sprite: its kind's art.
function roadArt(data: ObstacleData, kind: EncounterId | MinorObstacleId): string {
  return Object.hasOwn(data.minorObstacles, kind)
    ? minorObstacleSpriteKey(kind as MinorObstacleId)
    : encounterSpriteKey(kind as EncounterId);
}

// A mover's body sprite: its kind's road art, or the sprite MOVER_SPRITE_KEYS names for that art
// once it is drawn.
export function moverBodyArt(
  data: ObstacleData,
  has: HasArt,
  kind: EncounterId | MinorObstacleId,
): string {
  const art = roadArt(data, kind);
  const sprite = MOVER_SPRITE_KEYS[art];
  return sprite !== undefined && has(sprite) ? sprite : art;
}

// The sprites an obstacle draws, standing or moving. Each stands at the near edge of the item's
// hit box, however many rows it covers. A puddle lies flat under the rest, and a skunk stands
// just inside the front of its spray cloud, which lies flat too and goes with it when it moves;
// any other mover draws its body alone. The other dog's owner stands beside it.
export function obstacleParts(
  data: ObstacleData,
  has: HasArt,
  kind: EncounterId | MinorObstacleId,
  moving: boolean,
): ObstaclePart[] {
  if (kind === "skunk") {
    const body = moving ? moverBodyArt(data, has, kind) : roadArt(data, kind);
    return [part(SKUNK_CLOUD_KEY, { flat: true }), part(body, { behind: SKUNK_IN_CLOUD })];
  }
  if (moving) {
    return [part(moverBodyArt(data, has, kind))];
  }
  const art = roadArt(data, kind);
  const owner = `${art}-owner`;
  if (kind === "otherDog" && has(owner)) {
    return [part(art, { dx: OTHER_DOG_DX }), part(owner, { dx: OTHER_DOG_OWNER_DX })];
  }
  return [part(art, { flat: kind === "puddle" })];
}

// A sprite's silhouette, or, for art not drawn yet, its placeholder's: ROAD_SPRITE_SIZE tall,
// and as wide as its lanes less the lane's spare width beside a 1-lane sprite.
// With tags, the first of them that has a pose silhouette (POSE_SILHOUETTES) picks it instead.
export function obstacleSilhouette(
  cellLength: number,
  lanes: number,
  key: string,
  tags: readonly string[] = [],
): Silhouette {
  const poses = POSE_SILHOUETTES[key];
  const posed = tags.map((tag) => poses?.[tag]).find((pose) => pose !== undefined);
  if (posed !== undefined) {
    return posed;
  }
  const measured = OBSTACLE_SILHOUETTES[key];
  if (measured !== undefined) {
    return measured;
  }
  const half = (lanes * cellLength - (cellLength - ROAD_SPRITE_SIZE)) / 2;
  return { above: ROAD_SPRITE_SIZE, left: -half, right: half };
}
