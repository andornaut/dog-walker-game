import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { decodePng } from "../assets/atlas/atlasBuild";
import { spriteSource } from "../assets/atlas/atlasLayout";
import { depthVariantKey } from "../assets/spriteKeys";
import { gameData } from "../data";
import { LANE_COUNT, ROAD_CAMERA, SCREEN_CONFIG } from "../data/screen";
import type { DogId, EncounterId, MinorObstacleId, WalkerId } from "../data/types";
import { type DepthArt, depthDraw } from "../layout/depthScale";
import { obstacleParts } from "../layout/obstacleArt";
import { everyPack, PART_INSET } from "../layout/packFormation";
import { project, SCALE_STEPS, screenYAt } from "../layout/projection";
import { screenLayout } from "../layout/screenLayout";
import { testState } from "../testing/runState";
import { hitDog, type ScaledBox } from "./collision";
import { stillInLane } from "./laneMotion";
import { drawnObstacleBox } from "./obstacleBox";
import { screenRoadGeometry } from "./screenGeometry";
import { footprintOf, itemHeight, obstacleOnRoad, packBoxes, plannedCellInset } from "./walk";
import { walkProjection } from "./walkGeometry";

type Kind = EncounterId | MinorObstacleId;

const ROAD = screenLayout(SCREEN_CONFIG).road;
const PROJECTION = walkProjection(ROAD_CAMERA, ROAD);
const GEOMETRY = screenRoadGeometry(testState({ kilo: 3 }));
const { cell, lens } = GEOMETRY;

const KINDS = [
  ...Object.keys(gameData.minorObstacles),
  ...Object.entries(gameData.encounters)
    .filter(([, encounter]) => encounter.kind === "obstacle")
    .map(([id]) => id),
] as Kind[];
const movable = (kind: Kind): boolean => {
  const entry = Object.hasOwn(gameData.minorObstacles, kind)
    ? gameData.minorObstacles[kind as MinorObstacleId]
    : gameData.encounters[kind as EncounterId];
  return "movement" in entry && entry.movement !== undefined;
};
// Every obstacle kind standing, and moving where it can.
const LOOKS = KINDS.flatMap((kind) =>
  (movable(kind) ? [false, true] : [false]).map((moving) => ({ kind, moving })),
);

const MANIFEST = JSON.parse(readFileSync("public/art/manifest.json", "utf8")) as {
  sprites: { anchor?: { feetY: number }; key: string }[];
};
const FEET = new Map(MANIFEST.sprites.map(({ anchor, key }) => [key, anchor?.feetY]));

// A sprite sheet's frame size and its opaque bounds over all its frames, in its own pixels.
interface Sheet {
  bottom: number;
  height: number;
  left: number;
  right: number;
  top: number;
  width: number;
}
const SHEETS = new Map<string, Sheet>();
function sheetOf(key: string): Sheet {
  const known = SHEETS.get(key);
  if (known !== undefined) {
    return known;
  }
  const image = decodePng(readFileSync(`public/art/sprites/${key}.png`));
  const sheet: unknown = JSON.parse(readFileSync(`public/art/sprites/${key}.json`, "utf8"));
  const bounds: Sheet = { bottom: 0, height: 0, left: Infinity, right: 0, top: Infinity, width: 0 };
  for (const { from } of spriteSource(key, "", sheet).frames) {
    bounds.width = from.width;
    bounds.height = from.height;
    for (let y = 0; y < from.height; y++) {
      for (let x = 0; x < from.width; x++) {
        if ((image.data[((from.y + y) * image.width + from.x + x) * 4 + 3] ?? 0) > 0) {
          bounds.top = Math.min(bounds.top, y);
          bounds.bottom = Math.max(bounds.bottom, y + 1);
          bounds.left = Math.min(bounds.left, x);
          bounds.right = Math.max(bounds.right, x + 1);
        }
      }
    }
  }
  SHEETS.set(key, bounds);
  return bounds;
}

// The art steps a sprite is drawn from, as the scene finds them.
function depthArts(key: string): DepthArt[] {
  return SCALE_STEPS.map((step) => depthVariantKey(key, step) ?? key)
    .filter((art) => FEET.has(art))
    .map((art) => {
      const { height, width } = sheetOf(art);
      return { feetY: FEET.get(art) ?? height, height, key: art, width };
    });
}

// The screen rectangle an obstacle's opaque pixels are drawn over, its near edge on feetY and
// its centre x across the road, as itemViews and moverView draw each of its sprites: on its feet
// row through the projection, at depthDraw's art and scale, its position rounded to a pixel.
function drawnBounds(kind: Kind, moving: boolean, feetY: number, x: number) {
  const parts = obstacleOnRoad(gameData, GEOMETRY, kind, moving);
  const keys = obstacleParts(gameData, (key) => FEET.has(key), kind, moving);
  const box = { bottom: -Infinity, left: Infinity, right: -Infinity, top: Infinity };
  parts.forEach(({ behind, dx }, i) => {
    const distance = PROJECTION.footY - (feetY - behind);
    const placed = project(PROJECTION, { distance, x: ROAD.x + x + dx });
    const drawn = depthDraw(depthArts(keys[i]?.key ?? ""), placed.scale);
    const sheet = sheetOf(drawn.key);
    const left = Math.round(placed.x) - (sheet.width / 2) * drawn.scale;
    const top = Math.round(placed.y) - drawn.originY * sheet.height * drawn.scale;
    box.left = Math.min(box.left, left + sheet.left * drawn.scale);
    box.right = Math.max(box.right, left + sheet.right * drawn.scale);
    box.top = Math.min(box.top, top + sheet.top * drawn.scale);
    box.bottom = Math.max(box.bottom, top + sheet.bottom * drawn.scale);
  });
  return box;
}

// A box as drawn on the screen: its rows through the projection, its columns at its scale.
function onScreen(box: ScaledBox) {
  const across = (x: number) => ROAD.x + lens.centerX + (x - lens.centerX) * box.scale;
  return {
    bottom: screenYAt(PROJECTION, PROJECTION.footY - box.bottom),
    left: across(box.left),
    right: across(box.right),
    top: screenYAt(PROJECTION, PROJECTION.footY - box.top),
  };
}

describe("drawnObstacleBox", () => {
  // At each depth step, in a lane off the road's centre: each edge of a hit box lies the inset
  // inside the sprites' opaque pixels, give or take the inset again and 2 pixels for the
  // positions' rounding and the step art's own size, which the 1x silhouette scales to.
  const CASES = LOOKS.flatMap(({ kind, moving }) =>
    SCALE_STEPS.map((step) => ({ kind, moving, step })),
  );
  it("hits every obstacle, moving or not, as drawn at every depth step", () => {
    for (const { kind, moving, step } of CASES) {
      const feetY = lens.footY - (lens.focal / step - lens.focal);
      const lanes = footprintOf(gameData, kind).lanes;
      const lane = LANE_COUNT - lanes;
      const x = (lane + lanes / 2) * cell.length;
      const parts = obstacleOnRoad(gameData, GEOMETRY, kind, moving);
      const hit = onScreen(drawnObstacleBox(lens, PART_INSET, parts, { feetY, x }));
      const drawn = drawnBounds(kind, moving, feetY, x);
      const insides = [
        hit.top - drawn.top,
        drawn.bottom - hit.bottom,
        hit.left - drawn.left,
        drawn.right - hit.right,
      ];
      for (const inside of insides) {
        expect(inside).toBeGreaterThanOrEqual(-2);
        expect(inside).toBeLessThanOrEqual(2 * PART_INSET + 2);
      }
    }
  });
});

describe("an obstacle's hit length", () => {
  // Its rows from its near edge back by its hit length overlap the pack's band exactly while
  // its drawn hit box does: the box's far edge reaches the band's bottom as the rows' far end does.
  it("covers every obstacle's drawn box leaving the band", () => {
    for (const { kind, moving } of LOOKS) {
      const height = itemHeight(gameData, GEOMETRY, kind, moving);
      const parts = obstacleOnRoad(gameData, GEOMETRY, kind, moving);
      const bottom = GEOMETRY.packBand.bottom;
      const box = drawnObstacleBox(lens, PART_INSET, parts, { feetY: bottom + height, x: 0 });
      expect(box.top).toBeCloseTo(bottom, 6);
    }
  });

  // The planner's blocking spans hold every obstacle's.
  it("is no longer than the planner gives its rows", () => {
    const inset = plannedCellInset(gameData, GEOMETRY);
    for (const { kind, moving } of LOOKS) {
      const planned = footprintOf(gameData, kind).rows * cell.length - 2 * inset;
      expect(itemHeight(gameData, GEOMETRY, kind, moving)).toBeLessThanOrEqual(planned);
    }
  });
});

describe("a pack settled in a lane", () => {
  // Every walker with every pack, against every obstacle beside its lane, the obstacle's near
  // edge anywhere from the pack's top to past the walker's feet.
  const WALKERS = Object.keys(gameData.walkers) as WalkerId[];
  const PACKS = everyPack();
  it("never touches an obstacle in another lane, walked by any walker", () => {
    for (const walker of WALKERS) {
      const touched: string[] = [];
      for (const dogs of PACKS) {
        const run = testState(Object.fromEntries(dogs.map((dog: DogId) => [dog, 3])), { walker });
        const geometry = screenRoadGeometry(run);
        const { packBand } = geometry;
        for (let packLane = 0; packLane < LANE_COUNT; packLane++) {
          const pack = packBoxes(geometry, stillInLane(packLane), run);
          for (const { kind, moving } of LOOKS) {
            const lanes = moving ? 1 : footprintOf(gameData, kind).lanes;
            const parts = obstacleOnRoad(gameData, geometry, kind, moving);
            const height = itemHeight(gameData, geometry, kind, moving);
            for (const lane of [packLane - lanes, packLane + 1]) {
              if (lane < 0 || lane + lanes > LANE_COUNT) {
                continue;
              }
              const x = (lane + lanes / 2) * cell.length;
              const span = { left: lane * cell.length, right: (lane + lanes) * cell.length };
              for (let feetY = packBand.top; feetY < packBand.bottom + height; feetY += 4) {
                const box = {
                  ...drawnObstacleBox(lens, PART_INSET, parts, { feetY, x }),
                  lanes: span,
                };
                if (hitDog(pack, box) !== null) {
                  touched.push(`${dogs.join(",")} in ${packLane}: ${kind} in ${lane}`);
                }
              }
            }
          }
        }
      }
      expect(touched).toEqual([]);
    }
  });

  it("is touched by an obstacle in its own lane level with it", () => {
    const run = testState({ kilo: 3 });
    const pack = packBoxes(GEOMETRY, stillInLane(2), run);
    const parts = obstacleOnRoad(gameData, GEOMETRY, "cone", false);
    const feetY = GEOMETRY.packBand.bottom - 10;
    const box = drawnObstacleBox(lens, PART_INSET, parts, { feetY, x: 2.5 * cell.length });
    const lanes = { left: 2 * cell.length, right: 3 * cell.length };
    expect(hitDog(pack, { ...box, lanes })).toBe("kilo");
  });
});
