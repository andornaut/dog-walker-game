import { describe, expect, it } from "vitest";

import shippedManifest from "../../public/art/manifest.json";
import { itemAt } from "../arrays";
import { DEPTH_STEPS, splitDepthKey, stepSize } from "../assets/depthSteps";
import { parseManifest } from "../assets/manifest";
import { depthVariantKey, dogSpriteKey, standsOnGround } from "../assets/spriteKeys";
import { gameData } from "../data";
import { ROAD_CAMERA, SCREEN_CONFIG } from "../data/screen";
import type { DogId } from "../data/types";
import { dogDepthStep, statusOverlayLift } from "../runner/statuses";
import { walkProjection } from "../runner/walkGeometry";
import { type DepthArt, depthDraw } from "./depthScale";
import { PACK_DEPTH } from "./packFormation";
import { SCALE_STEPS, scaleAt, snapScale } from "./projection";
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
// The road's projected scales, far edge to just past the walker's feet, a road pixel apart.
const approach = Array.from({ length: Math.ceil(projection.visibleDistance) + 12 }, (_, i) =>
  scaleAt(projection, projection.visibleDistance - i),
);
// Shipped road sprites, small and large, flat and standing.
const STANDING = ["tip", "treat", "cone", "dog-koda", "loose-dog", "squirrel", "hedge"];
const KEYS = [...STANDING, "skunk-cloud", "puddle"];
// Every shipped road sprite with a depth variant.
const STEPPED = [
  ...new Set(
    manifest.sprites
      .map(({ key }) => splitDepthKey(key))
      .filter(({ step }) => step.scale < 1)
      .map(({ base }) => base),
  ),
].filter((key) => sprites.has(key) && standsOnGround(key));
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

  it("draws every pack dog's full-size art unscaled, with its status loop at 1, at every step", () => {
    const dogs = (Object.keys(gameData.dogs) as DogId[]).map((dog) => dogSpriteKey(gameData, dog));
    expect(dogs.length).toBeGreaterThan(0);
    for (const arts of stepSets(dogs)) {
      const drawn = depthDraw(arts, PACK_DEPTH);
      expect(drawn, drawn.key).toMatchObject({ depth: 1, key: itemAt(arts, 0).key, scale: 1 });
      expect(dogDepthStep(drawn.key, drawn.scale), drawn.key).toBe(1);
    }
    expect(statusOverlayLift(1)).toBe(6);
  });

  // A 32-wide cone with only @75 and @50, whatever steps the shipped cone has.
  const cone32 = syntheticArts("cone", 32, [0.75, 0.5]);
  const everyCone = withEveryStep(artsOf("cone"));
  const cloud88 = syntheticArts("cloud", 88, [0.5]);
  // The fixed scale a step without its own art draws its 1x at: the step's size over its side.
  const fixedScale = (arts: readonly DepthArt[], step: number) => {
    const full = itemAt(arts, 0);
    const fullSide = Math.max(full.width, full.height);
    return stepSize(fullSide, step) / fullSide;
  };
  it.each([
    { arts: artsOf("cone"), key: "cone@75", name: "a hand-drawn step", projected: 0.75, scale: 1 },
    { arts: artsOf("cone"), key: "cone@50", name: "a hand-drawn step", projected: 0.5, scale: 1 },
    { arts: everyCone, key: "cone@75", name: "the nearest step", projected: 0.8, scale: 1 },
    { arts: everyCone, key: "cone@62", name: "the nearest step", projected: 0.6, scale: 1 },
    { arts: everyCone, key: "cone@88", name: "the in-between step", projected: 0.875, scale: 1 },
    { arts: cone32, key: "cone@75", name: "a hand-drawn step, snapped", projected: 0.7, scale: 1 },
    {
      arts: cone32,
      key: "cone",
      name: "a missing step from the 1x, at a fixed scale",
      projected: 0.9,
      scale: fixedScale(cone32, 0.875),
    },
    {
      arts: cloud88,
      key: "cloud",
      name: "a missing step from the 1x, at a fixed scale",
      projected: 0.6,
      scale: fixedScale(cloud88, 0.625),
    },
  ])("draws $name at $projected as $key", ({ arts, key, projected, scale }) => {
    expect(depthDraw(arts, projected)).toMatchObject({ key, scale });
  });

  // Between two steps' boundaries the drawn sprite does not change at all, so no frame
  // resamples it; a sprite with every step's art always draws at scale 1.
  it.each([
    { name: "the sizing cases", sets: [...stepSets(KEYS), ...STEP_SETS] },
    { name: "every shipped sprite with depth variants", sets: STEPPED.map(artsOf) },
  ])("draws only the depth steps, growing a step at a time as it approaches: $name", ({ sets }) => {
    for (const arts of sets) {
      const full = itemAt(arts, 0);
      const fullSide = Math.max(full.width, full.height);
      const order = (stepKey: string) => arts.findIndex((step) => step.key === stepKey);
      const complete = arts.length === DEPTH_STEPS.length;
      const drawnAt = approach.map((projected) => depthDraw(arts, projected));
      drawnAt.forEach((drawn, i) => {
        const step = snapScale(Math.min(1, itemAt(approach, i)));
        expect(drawn.depth, drawn.key).toBe(stepSize(fullSide, step) / fullSide);
        if (complete) {
          expect(drawn.scale, drawn.key).toBe(1);
        }
        if (i > 0) {
          const last = itemAt(drawnAt, i - 1);
          expect(order(drawn.key), `${last.key} to ${drawn.key}`).toBeLessThanOrEqual(
            order(last.key),
          );
        }
      });
      expect(new Set(drawnAt.map((drawn) => drawn.depth)).size).toBeLessThanOrEqual(
        SCALE_STEPS.length,
      );
    }
  });

  it.each([
    { name: "the sizing cases", sets: stepSets(STANDING) },
    { name: "every shipped sprite with depth variants", sets: STEPPED.map(artsOf) },
  ])("stands each step on its own feet line: $name", ({ sets }) => {
    for (const arts of sets) {
      for (const projected of approach) {
        const drawn = depthDraw(arts, projected);
        const art = arts.find((step) => step.key === drawn.key);
        expect(drawn.originY).toBe((art?.feetY ?? 0) / (art?.height ?? 1));
      }
    }
  });
});
