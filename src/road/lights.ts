import * as v from "valibot";

import lightTable from "../../shared/lights.json";
import { paletteColour } from "../assets/housePalette";
import { parseOrThrow } from "../assets/jsonSchema";
import type { ZoneId } from "../data/types";
import { WORLD } from "../data/world";

// Lights: hard-stepped glows added over what lies under them, as art sets them out in
// shared/lights.json. Each def is a shape width by height px at full size (scale 1, the walker's
// row), in a palette colour, with up to MAX_RINGS rings, outermost first: ring k covers the shape
// scaled by its scale and adds its strength of the colour to every pixel it covers that no inner
// ring does. An ellipse or band is centred on its anchor; a cone's apex is on its anchor, and it
// widens to width at height away, pointing down as drawn, its rings scaled toward the apex.
// Drawing only: nothing in the walk reads them.

export type LightShape = "band" | "cone" | "ellipse";

export interface LightRing {
  readonly scale: number;
  readonly strength: number;
}

export interface LightDef {
  readonly colour: number;
  readonly height: number;
  readonly rings: readonly LightRing[];
  readonly shape: LightShape;
  readonly width: number;
}

export const MAX_RINGS = 3;

const unit = v.pipe(v.number(), v.gtValue(0), v.maxValue(1));
const size = v.pipe(v.number(), v.integer(), v.minValue(1));

const lightSchema = v.strictObject({
  colour: v.string(),
  height: size,
  rings: v.pipe(
    v.array(v.strictObject({ scale: unit, strength: unit })),
    v.minLength(1),
    v.maxLength(MAX_RINGS),
  ),
  shape: v.picklist(["band", "cone", "ellipse"]),
  width: size,
});

const tableSchema = v.strictObject({ defs: v.record(v.string(), lightSchema) });

// The light defs of a table as art writes it, by key: each colour a palette name, each ring
// inside the last and brighter, and each ring covering at least one pixel at full size. Anything
// else, an unknown field included, throws.
export function lightsFrom(table: unknown): ReadonlyMap<string, LightDef> {
  const { defs } = parseOrThrow("shared/lights.json", tableSchema, table);
  return new Map(
    Object.entries(defs).map(([key, entry]) => {
      const def: LightDef = { ...entry, colour: paletteColour(entry.colour) };
      const rings = def.rings;
      rings.slice(1).forEach((ring, k) => {
        const outer = rings[k];
        if (outer !== undefined && (ring.scale >= outer.scale || ring.strength <= outer.strength)) {
          throw new Error(`Light ${key}'s rings are not each inside the last and brighter`);
        }
      });
      const baked = bakeLight(def);
      rings.forEach((_, k) => {
        if (!baked.rings.includes(k)) {
          throw new Error(`Light ${key}'s ring ${k} covers no pixel at full size`);
        }
      });
      return [key, def];
    }),
  );
}

export const LIGHTS: ReadonlyMap<string, LightDef> = lightsFrom(lightTable);

// A light baked at full size: each pixel's ring (-1 outside the light), its RGBA bytes (the
// ring's strength of the colour, opaque, for an additive blend; clear outside), and the anchor
// as a share of its width and height.
export interface BakedLight {
  readonly height: number;
  readonly originX: number;
  readonly originY: number;
  readonly pixels: Uint8ClampedArray<ArrayBuffer>;
  readonly rings: Int8Array;
  readonly width: number;
}

// The innermost ring holding the pixel centre at x, y of a light baked width by height, or -1.
function ringAt(def: LightDef, x: number, y: number): number {
  const { height, rings, width } = def;
  const across = x + 0.5 - width / 2;
  let reach: number;
  if (def.shape === "cone") {
    const down = (y + 0.5) / height;
    reach = Math.abs(across) <= (width / 2) * down ? down : Number.POSITIVE_INFINITY;
  } else {
    const u = across / (width / 2);
    const w = (y + 0.5 - height / 2) / (height / 2);
    reach = def.shape === "band" ? Math.max(Math.abs(u), Math.abs(w)) : Math.hypot(u, w);
  }
  let ring = -1;
  rings.forEach(({ scale }, k) => {
    if (reach <= scale) {
      ring = k;
    }
  });
  return ring;
}

export function bakeLight(def: LightDef): BakedLight {
  const { colour, height, rings, width } = def;
  const ringOf = new Int8Array(width * height);
  const pixels = new Uint8ClampedArray(width * height * 4);
  const channels = [(colour >> 16) & 0xff, (colour >> 8) & 0xff, colour & 0xff];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const ring = ringAt(def, x, y);
      ringOf[i] = ring;
      const strength = rings[ring]?.strength ?? 0;
      if (ring >= 0) {
        channels.forEach((channel, c) => {
          pixels[i * 4 + c] = Math.round(strength * channel);
        });
        pixels[i * 4 + 3] = 255;
      }
    }
  }
  return {
    height,
    originX: 0.5,
    originY: def.shape === "cone" ? 0 : 0.5,
    pixels,
    rings: ringOf,
    width,
  };
}

// The light key a def is baked under as a texture.
export function lightTextureKey(key: string): string {
  return `light-${key}`;
}

const ZONE_IDS: readonly string[] = WORLD.zones.map((zone) => zone.id);

// The zones a light shows in, by id, each one in the world, or null for every zone.
export const lightZonesSchema = v.optional(
  v.pipe(
    v.array(
      v.pipe(
        v.string(),
        v.check((id) => ZONE_IDS.includes(id), "names no zone"),
      ),
    ),
    v.minLength(1),
  ),
);

export function zonesOf(ids: readonly string[] | undefined): readonly ZoneId[] | null {
  return ids === undefined
    ? null
    : WORLD.zones.map((zone) => zone.id).filter((id) => ids.includes(id));
}

// A light key that must name a def.
export const lightKeySchema = v.pipe(
  v.string(),
  v.check((key) => LIGHTS.has(key), "names no light"),
);
