import { describe, expect, it } from "vitest";

import shippedManifest from "../../public/art/manifest.json";
import { DEPTH_STEPS, splitDepthKey, stepSize } from "../assets/depthSteps";
import { parseManifest } from "../assets/manifest";
import { depthVariantKey, dogSpriteKey, standsOnGround } from "../assets/spriteKeys";
import { gameData } from "../data";
import { ROAD_CAMERA, SCREEN_CONFIG } from "../data/screen";
import type { DogId } from "../data/types";
import { itemAt } from "../lib/arrays";
import { walkProjection } from "../runner/walkGeometry";
import { type DepthArt, depthDraw } from "./depthScale";
import { PACK_DEPTH } from "./packFormation";
import { SCALE_STEPS, scaleAt } from "./projection";
import { screenLayout } from "./screenLayout";

const manifest = parseManifest(shippedManifest);
const sprites = new Map(manifest.sprites.map((entry) => [entry.key, entry]));
const sheets = import.meta.glob<{
  frames: Record<
    string,
    { frame: { h: number; w: number; x: number; y: number }; sourceSize: { h: number; w: number } }
  >;
}>("../../public/art/sprites/*.json", { eager: true, import: "default" });

// A shipped sprite's art steps, 1x first, as the scene reads them from the loaded art.
function artsOf(key: string): DepthArt[] {
  return SCALE_STEPS.map((step) => depthVariantKey(key, step) ?? key)
    .filter((art) => sprites.has(art))
    .map((art) => {
      const entry = sprites.get(art);
      const sheet = entry === undefined ? undefined : sheets[`../../public/art/${entry.json}`];
      const frame = sheet === undefined ? undefined : Object.values(sheet.frames)[0];
      if (entry?.anchor === undefined || frame === undefined) {
        throw new Error(`${art} has no anchor or frame`);
      }
      const { h, w } = frame.sourceSize;
      return { feetY: entry.anchor.feetY, height: h, key: art, width: w };
    });
}

// A made-up sprite's art steps: its 1x, then each smaller step drawn to scale.
function syntheticArts(key: string, width: number, steps: readonly number[]): DepthArt[] {
  return [1, ...steps].map((step) => ({
    feetY: stepSize(width * 0.75, step),
    height: stepSize(width * 0.8, step),
    key: depthVariantKey(key, step) ?? key,
    width: stepSize(width, step),
  }));
}

// arts with every depth step it lacks drawn at the table's size, as art exports them.
// A made-up step draws the 1x's art at its size.
function withEveryStep(arts: readonly DepthArt[]): DepthArt[] {
  const full = itemAt(arts, 0);
  return DEPTH_STEPS.map(({ scale, suffix }) => {
    const shipped = arts.find((art) => art.key === `${full.key}${suffix}`);
    if (shipped !== undefined) {
      return shipped;
    }
    const key = `${full.key}${suffix}`;
    return {
      feetY: stepSize(full.feetY, scale),
      height: stepSize(full.height, scale),
      key,
      width: stepSize(full.width, scale),
    };
  });
}

// Each sprite's shipped steps, then the same with every step.
function stepSets(keys: readonly string[]): DepthArt[][] {
  return keys.flatMap((key) => [artsOf(key), withEveryStep(artsOf(key))]);
}

const projection = walkProjection(ROAD_CAMERA, screenLayout(SCREEN_CONFIG).road);
// A slow approach: the road's projected scales from the far edge to just past the walker's
// feet, a quarter road pixel apart.
const approach = Array.from({ length: 4 * (Math.ceil(projection.visibleDistance) + 12) }, (_, i) =>
  scaleAt(projection, projection.visibleDistance - i / 4),
);
// Floating-point rounding in a drawn size, far below a pixel.
const ROUNDING = 1e-9;
// Shipped road sprites, small and large, flat and standing.
const STANDING = ["tip", "treat", "cone", "dog-koda", "loose-dog", "squirrel", "hedge"];
// Every standing sprite in the manifest, each with its depth variants.
const ROAD_SPRITES = manifest.sprites
  .map(({ key }) => key)
  .filter((key) => splitDepthKey(key).base === key && standsOnGround(key));
// Every set of steps a sprite may have, whichever sprites ship with them.
const STEP_SETS = [[], [0.75], [0.5], [0.75, 0.5], [0.875, 0.75, 0.625, 0.5]].flatMap((steps) =>
  [16, 88].map((width) => syntheticArts(`w${width}`, width, steps)),
);

describe("scaleAt", () => {
  it("only grows as a point approaches the walker's feet", () => {
    approach.slice(1).forEach((scale, i) => expect(scale).toBeGreaterThan(itemAt(approach, i)));
    expect(itemAt(approach, 0)).toBeLessThan(0.75);
    expect(itemAt(approach, approach.length - 1)).toBeGreaterThan(1);
  });
});

describe("depthDraw", () => {
  it("draws the full-size art at 1, and never upscales it past the walker's feet", () => {
    const arts = artsOf("tip");
    const full = itemAt(arts, 0);
    expect(depthDraw(arts, 1)).toEqual({
      depth: 1,
      key: "tip",
      originY: full.feetY / full.height,
      scale: 1,
    });
    expect(depthDraw(arts, 1.07)).toEqual(depthDraw(arts, 1));
  });

  it("draws every pack dog's full-size art unscaled, at every step", () => {
    const dogs = (Object.keys(gameData.dogs) as DogId[]).map((dog) => dogSpriteKey(gameData, dog));
    expect(dogs.length).toBeGreaterThan(0);
    for (const arts of stepSets(dogs)) {
      const drawn = depthDraw(arts, PACK_DEPTH);
      expect(drawn, drawn.key).toMatchObject({ depth: 1, key: itemAt(arts, 0).key, scale: 1 });
    }
  });

  // A 32-wide cone with only @75 and @50, whatever steps the shipped cone has.
  it("draws a projected scale from its own step, else the next larger step or art, scaled down", () => {
    const everyCone = withEveryStep(artsOf("cone"));
    const cone32 = syntheticArts("cone", 32, [0.75, 0.5]);
    const picks = [
      { arts: artsOf("cone"), key: "cone@75", projected: 0.75, scale: 1 },
      { arts: everyCone, key: "cone@62", projected: 0.6 },
      { arts: cone32, key: "cone@75", projected: 0.6 },
    ];
    for (const { arts, key, projected, scale } of picks) {
      const drawn = depthDraw(arts, projected);
      expect(drawn.key).toBe(key);
      if (scale === undefined) {
        expect(drawn.scale).toBeLessThan(1);
      } else {
        expect(drawn.scale).toBe(scale);
      }
    }
  });

  // Over a slow approach the drawn frame grows with the projection and never shrinks: on both
  // axes it is at least the 1x's size at the projected scale, capped at 1, and within a pixel
  // of it on one. Every shipped road sprite and every set of steps a sprite may have.
  it("grows every sprite in proportion with distance and never shrinks it", () => {
    const offenders: string[] = [];
    for (const arts of [...ROAD_SPRITES.map(artsOf), ...STEP_SETS]) {
      const full = itemAt(arts, 0);
      let last = { height: 0, width: 0 };
      for (const projected of approach) {
        const drawn = depthDraw(arts, projected);
        const art = arts.find((step) => step.key === drawn.key) ?? full;
        const size = { height: art.height * drawn.scale, width: art.width * drawn.scale };
        const depth = Math.min(1, projected);
        const over = Math.min(size.height - full.height * depth, size.width - full.width * depth);
        const grows = size.width + ROUNDING > last.width && size.height + ROUNDING > last.height;
        if (drawn.scale > 1 || over <= -ROUNDING || over >= 1 || !grows) {
          offenders.push(`${drawn.key} at ${projected}`);
          break;
        }
        last = size;
      }
    }
    expect(offenders).toEqual([]);
  });

  it("stands each step on its own feet line", () => {
    for (const arts of stepSets(STANDING)) {
      for (const projected of approach) {
        const drawn = depthDraw(arts, projected);
        const art = arts.find((step) => step.key === drawn.key);
        expect(drawn.originY).toBe((art?.feetY ?? 0) / (art?.height ?? 1));
      }
    }
  });
});
