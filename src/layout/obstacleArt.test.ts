import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { decodePng } from "../assets/atlas/atlasBuild";
import { spriteSource } from "../assets/atlas/atlasLayout";
import { gameData } from "../data";
import type { EncounterId, MinorObstacleId } from "../data/types";
import { awaitsArt } from "../testing/awaitingArt";
import { OBSTACLE_SILHOUETTES, obstacleParts } from "./obstacleArt";

const MANIFEST = JSON.parse(readFileSync("public/art/manifest.json", "utf8")) as {
  sprites: { anchor?: { feetY: number }; key: string }[];
};
const FEET = new Map(MANIFEST.sprites.map(({ anchor, key }) => [key, anchor?.feetY]));

// A sprite's opaque bounds over all its frames, from the column it is centred on and its feet
// row, as OBSTACLE_SILHOUETTES measures them.
function measured(key: string) {
  const image = decodePng(readFileSync(`public/art/sprites/${key}.png`));
  const sheet: unknown = JSON.parse(readFileSync(`public/art/sprites/${key}.json`, "utf8"));
  const feetY = FEET.get(key);
  if (feetY === undefined) {
    throw new Error(`${key} has no feet line`);
  }
  let [top, left, right, width] = [Infinity, Infinity, -Infinity, 0];
  for (const { from } of spriteSource(key, "", sheet).frames) {
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

describe("OBSTACLE_SILHOUETTES", () => {
  it("measures every obstacle on its art", () => {
    for (const [key, silhouette] of Object.entries(OBSTACLE_SILHOUETTES)) {
      expect(silhouette).toEqual(measured(key));
    }
  });

  // Each obstacle, standing and moving, as the art loaded draws it.
  it("holds exactly the obstacle sprites the art draws", () => {
    const drawn = new Set(
      KINDS.flatMap((kind) =>
        [false, true].flatMap((moving) =>
          obstacleParts(gameData, inManifest, kind, moving)
            .map(({ key }) => key)
            .filter((key) => !awaitsArt(inManifest, key)),
        ),
      ),
    );
    expect(Object.keys(OBSTACLE_SILHOUETTES).sort()).toEqual([...drawn].sort());
  });
});
