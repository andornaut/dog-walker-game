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
// A light is drawn on its own along a verge (a verge's pools), or attached to a sprite: the
// table's attach lists, by sprite key, the lights every sprite of that key carries, each dx and
// dy px at full size from its anchor (its feet), as for the sprite as drawn, or for a roadside
// prop on the road's right: a flipped sprite, or a prop on the left, mirrors them. A cone's angle
// is the way it points, in degrees as drawn (0 right, 90 down, 180 left), mirrored likewise, so
// a lamp's cone set down and to the left, from its bulb, shines toward the road from either side.
// A pulse lists the strength the light shows at each frame of its sprite's idle tag, by the
// frame's place in the tag; with none it shows at full strength. zones lists the zone ids it
// shows in, or null for every zone. Drawing only: nothing in the walk reads them.

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

const ZONE_IDS: readonly string[] = WORLD.zones.map((zone) => zone.id);

// The zones a light shows in, by id, each one in the world; left out for every zone.
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

export interface LightAttachment {
  readonly angle: number;
  readonly dx: number;
  readonly dy: number;
  readonly light: string;
  readonly pulse: readonly number[] | null;
  readonly zones: readonly ZoneId[] | null;
}

const whole = v.pipe(v.number(), v.integer());

const attachmentSchema = v.strictObject({
  angle: v.optional(v.number()),
  dx: whole,
  dy: whole,
  light: v.string(),
  pulse: v.optional(
    v.pipe(v.array(v.pipe(v.number(), v.minValue(0), v.maxValue(1))), v.minLength(1)),
  ),
  zones: lightZonesSchema,
});

const tableSchema = v.strictObject({
  attach: v.optional(v.record(v.string(), v.array(attachmentSchema))),
  defs: v.record(v.string(), lightSchema),
});

// A cone points down as drawn.
const CONE_ANGLE = 90;

export interface LightTable {
  // The lights each sprite carries, by sprite key.
  readonly attach: ReadonlyMap<string, readonly LightAttachment[]>;
  readonly defs: ReadonlyMap<string, LightDef>;
}

// A light table as art writes it: each def's colour a palette name, each ring inside the last
// and brighter, and each ring covering at least one pixel at full size; each attachment naming
// a def, with an angle only on a cone. Anything else, an unknown field included, throws.
export function lightsFrom(table: unknown): LightTable {
  const parsed = parseOrThrow("shared/lights.json", tableSchema, table);
  const defs = new Map(
    Object.entries(parsed.defs).map(([key, entry]) => [key, defFrom(key, entry)]),
  );
  const attach = new Map(
    Object.entries(parsed.attach ?? {}).map(([sprite, entries]) => [
      sprite,
      entries.map((entry) => {
        const def = defs.get(entry.light);
        if (def === undefined) {
          throw new Error(`${sprite}'s light ${entry.light} names no light`);
        }
        if (entry.angle !== undefined && def.shape !== "cone") {
          throw new Error(`${sprite}'s light ${entry.light} takes an angle, but is no cone`);
        }
        return {
          angle: entry.angle ?? CONE_ANGLE,
          dx: entry.dx,
          dy: entry.dy,
          light: entry.light,
          pulse: entry.pulse ?? null,
          zones: zonesOf(entry.zones),
        };
      }),
    ]),
  );
  return { attach, defs };
}

function defFrom(key: string, entry: v.InferOutput<typeof lightSchema>): LightDef {
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
  return def;
}

const TABLE = lightsFrom(lightTable);

export const LIGHTS: ReadonlyMap<string, LightDef> = TABLE.defs;
export const LIGHT_ATTACHMENTS: ReadonlyMap<string, readonly LightAttachment[]> = TABLE.attach;

// A light key that must name a def.
export const lightKeySchema = v.pipe(
  v.string(),
  v.check((key) => LIGHTS.has(key), "names no light"),
);
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
