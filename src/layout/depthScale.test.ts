import { describe, expect, it } from "vitest";

import shippedManifest from "../../public/art/manifest.json";
import { itemAt } from "../arrays";
import { DEPTH_STEPS, stepSize } from "../assets/depthSteps";
import { parseManifest } from "../assets/manifest";
import { depthVariantKey, dogSpriteKey } from "../assets/spriteKeys";
import { gameData } from "../data";
import { ROAD_CAMERA, SCREEN_CONFIG } from "../data/screen";
import type { DogId } from "../data/types";
import { dogDepthStep, statusOverlayLift } from "../runner/statuses";
import { walkProjection } from "../runner/walkGeometry";
import { type DepthArt, depthDraw } from "./depthScale";
import { PACK_DEPTH } from "./packFormation";
import { SCALE_STEPS, scaleAt } from "./projection";
import { screenLayout } from "./screenLayout";

const manifest = parseManifest(shippedManifest);
const sprites = new Map(manifest.sprites.map((entry) => [entry.key, entry]));
const sheets = import.meta.glob<{
  frames: Record<string, { sourceSize: { h: number; w: number } }>;
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
function withEveryStep(arts: readonly DepthArt[]): DepthArt[] {
  const full = itemAt(arts, 0);
  return DEPTH_STEPS.map(
    ({ scale, suffix }) =>
      arts.find((art) => art.key === `${full.key}${suffix}`) ?? {
        feetY: stepSize(full.feetY, scale),
        height: stepSize(full.height, scale),
        key: `${full.key}${suffix}`,
        width: stepSize(full.width, scale),
      },
  );
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
  // The scale the shipped cone's step is drawn at for a projected scale: the 1x's side at
  // that scale, to the nearest pixel, over the step's side.
  const side = (art: DepthArt) => Math.max(art.width, art.height);
  const coneScale = (projected: number, step: number) =>
    stepSize(side(itemAt(everyCone, 0)), projected) /
    side(
      everyCone.find((art) => art.key === depthVariantKey("cone", step)) ?? itemAt(everyCone, 0),
    );
  it.each([
    { arts: artsOf("cone"), key: "cone@75", name: "a hand-drawn step", projected: 0.75, scale: 1 },
    { arts: artsOf("cone"), key: "cone@50", name: "a hand-drawn step", projected: 0.5, scale: 1 },
    {
      arts: cone32,
      key: "cone",
      name: "the next step up, downscaled",
      projected: 0.8,
      scale: 26 / 32,
    },
    {
      arts: cone32,
      key: "cone@75",
      name: "the next step up, downscaled",
      projected: 0.7,
      scale: 22 / 24,
    },
    {
      arts: syntheticArts("cloud", 88, [0.5]),
      key: "cloud",
      name: "the 1x from just above 0.5 without a @75",
      projected: 0.6,
      scale: 53 / 88,
    },
    { arts: everyCone, key: "cone@88", name: "the in-between step", projected: 0.875, scale: 1 },
    { arts: everyCone, key: "cone@62", name: "the in-between step", projected: 0.625, scale: 1 },
    {
      arts: everyCone,
      key: "cone@88",
      name: "the in-between step, downscaled",
      projected: 0.8,
      scale: coneScale(0.8, 0.875),
    },
    {
      arts: everyCone,
      key: "cone@62",
      name: "the in-between step, downscaled",
      projected: 0.6,
      scale: coneScale(0.6, 0.625),
    },
  ])("draws $name at $projected as $key", ({ arts, key, projected, scale }) => {
    expect(depthDraw(arts, projected)).toMatchObject({ key, scale });
  });

  it("follows the projection to the nearest pixel, as it approaches only growing", () => {
    for (const arts of [...stepSets(KEYS), ...STEP_SETS]) {
      const full = itemAt(arts, 0);
      let last: { height: number; key: string; width: number } | undefined;
      for (const projected of approach) {
        const drawn = depthDraw(arts, projected);
        const art = arts.find((step) => step.key === drawn.key);
        if (art === undefined) {
          throw new Error(`${drawn.key} is not one of ${full.key}'s steps`);
        }
        const shown = {
          height: art.height * drawn.scale,
          key: art.key,
          width: art.width * drawn.scale,
        };
        const wanted = Math.max(full.width, full.height) * Math.min(1, projected);
        expect(Math.abs(Math.max(shown.width, shown.height) - wanted)).toBeLessThanOrEqual(
          0.5 + 1e-9,
        );
        expect(drawn.scale).toBeLessThanOrEqual(1 + 0.5 / Math.max(art.width, art.height));
        if (last !== undefined) {
          expect(shown.height).toBeGreaterThanOrEqual(last.height - 1e-9);
          expect(shown.width).toBeGreaterThanOrEqual(last.width - 1e-9);
          // Never back to a smaller step.
          const order = (stepKey: string) => arts.findIndex((step) => step.key === stepKey);
          expect(order(shown.key)).toBeLessThanOrEqual(order(last.key));
        }
        last = shown;
      }
    }
  });

  it("stands each step on its own feet line, which stays put as the steps change", () => {
    for (const arts of stepSets(STANDING)) {
      let last: { feetToTop: number; key: string } | undefined;
      for (const projected of approach) {
        const drawn = depthDraw(arts, projected);
        const art = arts.find((step) => step.key === drawn.key);
        expect(drawn.originY).toBe((art?.feetY ?? 0) / (art?.height ?? 1));
        const feetToTop = drawn.originY * (art?.height ?? 0) * drawn.scale;
        if (last !== undefined && last.key !== drawn.key) {
          expect(Math.abs(feetToTop - last.feetToTop), `${last.key} to ${drawn.key}`).toBeLessThan(
            1.5,
          );
        }
        last = { feetToTop, key: drawn.key };
      }
    }
  });
});
