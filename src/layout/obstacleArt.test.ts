import { readFileSync } from "node:fs";

import { decodePng } from "@andornaut/game-kit/art/png";
import { describe, expect, it } from "vitest";

import { minorObstacleSpriteKey } from "../assets/spriteKeys";
import { gameData } from "../data";
import type { EncounterId, MinorObstacleId, SkinId } from "../data/types";
import { obstacleSkins } from "../runner/obstacleLooks";
import { spriteSource } from "../tools/atlas/atlasLayout";
import { OBSTACLE_SILHOUETTES, obstacleParts, POSE_SILHOUETTES } from "./obstacleArt";

const MANIFEST = JSON.parse(readFileSync("public/art/manifest.json", "utf8")) as {
  sprites: { anchor?: { feetY: number }; key: string }[];
};
const FEET = new Map(MANIFEST.sprites.map(({ anchor, key }) => [key, anchor?.feetY]));

// A sprite's opaque bounds over all its frames, or over its tag's alone, from the column it is
// centred on and its feet row, as OBSTACLE_SILHOUETTES and POSE_SILHOUETTES measure them.
function measured(key: string, tag?: string) {
  const image = decodePng(readFileSync(`public/art/sprites/${key}.png`));
  const sheet: unknown = JSON.parse(readFileSync(`public/art/sprites/${key}.json`, "utf8"));
  const { frameTags } = (
    sheet as { meta: { frameTags?: { from: number; name: string; to: number }[] } }
  ).meta;
  const range = frameTags?.find(({ name }) => name === tag);
  const feetY = FEET.get(key);
  if (feetY === undefined) {
    throw new Error(`${key} has no feet line`);
  }
  let [top, left, right, width] = [Infinity, Infinity, -Infinity, 0];
  for (const [index, { from }] of spriteSource(key, "", sheet).frames.entries()) {
    if (range !== undefined && (index < range.from || index > range.to)) {
      continue;
    }
    width = from.width;
    for (let y = 0; y < from.height; y++) {
      for (let x = 0; x < from.width; x++) {
        if ((image.data[((from.y + y) * image.width + from.x + x) * 4 + 3] ?? 0) > 0) {
          top = Math.min(top, y);
          left = Math.min(left, x);
          right = Math.max(right, x + 1);
        }
      }
    }
  }
  return { above: feetY - top, left: left - width / 2, right: right - width / 2 };
}

const KINDS = [
  ...Object.keys(gameData.minorObstacles),
  ...Object.entries(gameData.encounters)
    .filter(([, encounter]) => encounter.kind === "obstacle")
    .map(([id]) => id),
] as (EncounterId | MinorObstacleId)[];
const inManifest = (key: string) => FEET.has(key);
// Each skin of each minor obstacle that has skins.
const SKINS = (Object.keys(gameData.minorObstacles) as MinorObstacleId[]).flatMap((kind) =>
  obstacleSkins(gameData, kind).map((skin) => ({ kind, skin })),
);
// Each obstacle as it may look: in each of its skins, or as itself.
const LOOKS: { kind: EncounterId | MinorObstacleId; skin?: SkinId }[] = KINDS.flatMap((kind) => {
  const skins = SKINS.filter((look) => look.kind === kind);
  return skins.length > 0 ? skins : [{ kind }];
});

describe("OBSTACLE_SILHOUETTES", () => {
  it("measures every obstacle on its art", () => {
    for (const [key, silhouette] of Object.entries(OBSTACLE_SILHOUETTES)) {
      expect(silhouette).toEqual(measured(key));
    }
  });

  // Each pose silhouette is its tag's frames as drawn, and lies within the sprite's silhouette over
  // every frame, by which the planner spaces it.
  const POSES = Object.entries(POSE_SILHOUETTES).flatMap(([key, poses]) =>
    Object.entries(poses).map(([tag, silhouette]) => ({ key, silhouette, tag })),
  );
  it.each(POSES)("measures $key's $tag pose on its art, within its silhouette", (pose) => {
    const { key, silhouette, tag } = pose;
    expect(silhouette).toEqual(measured(key, tag));
    const whole = OBSTACLE_SILHOUETTES[key];
    expect(silhouette.above).toBeLessThanOrEqual(whole?.above ?? -Infinity);
    expect(silhouette.left).toBeGreaterThanOrEqual(whole?.left ?? Infinity);
    expect(silhouette.right).toBeLessThanOrEqual(whole?.right ?? -Infinity);
  });

  // Each obstacle, standing and moving, in each of its skins, as the art loaded draws it.
  it("holds exactly the obstacle sprites the art draws", () => {
    const drawn = new Set(
      LOOKS.flatMap(({ kind, skin }) =>
        [false, true].flatMap((moving) =>
          obstacleParts(gameData, inManifest, kind, moving, skin).map(({ key }) => key),
        ),
      ),
    );
    expect(Object.keys(OBSTACLE_SILHOUETTES).sort()).toEqual([...drawn].sort());
  });

  // A spawn draws its skin's sprite, and every skin of an obstacle has the same silhouette, so
  // the planner, which picks no skin, spaces and hits each the same.
  it.each(SKINS)("draws a $kind in its $skin skin, as wide and tall as its others", (look) => {
    const { kind, skin } = look;
    const key = minorObstacleSpriteKey(skin);
    expect(obstacleParts(gameData, inManifest, kind, false, skin).map((part) => part.key)).toEqual([
      key,
    ]);
    const [first] = obstacleSkins(gameData, kind);
    const silhouette = OBSTACLE_SILHOUETTES[key];
    expect(silhouette).toBeDefined();
    expect(silhouette).toEqual(OBSTACLE_SILHOUETTES[minorObstacleSpriteKey(first ?? skin)]);
  });
});
