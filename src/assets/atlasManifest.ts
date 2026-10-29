import * as v from "valibot";

import { parseOrThrow, record } from "./jsonSchema";

// Written by the build next to /art/manifest.json, paths relative to /art/ like it.
export const ATLAS_MANIFEST_PATH = "atlas-manifest.json";
export const ATLAS_DIR = "atlas";

// Phaser's name for the frame that covers a whole image. An atlased image has only this frame.
export const BASE_FRAME = "__BASE";

// A trimmed frame's full size, and where its packed rect sits in it: Phaser's sourceSize and
// spriteSourceSize.
export interface FrameTrim {
  h: number;
  w: number;
  x: number;
  y: number;
}

export interface AtlasFrame {
  // Milliseconds, from the Aseprite export. Images have none.
  duration?: number;
  h: number;
  name: string;
  // Present when the rect holds only the frame's opaque pixels.
  trim?: FrameTrim;
  w: number;
  x: number;
  y: number;
}

// One manifest image or sprite, drawn from one atlas page. A sprite keeps its Aseprite tags
// and frame names, in export order.
export interface AtlasTexture {
  frames: AtlasFrame[];
  key: string;
  page: number;
  tags?: unknown[];
}

interface AtlasPage {
  // The file's size in bytes, which weights it on the loading bar.
  bytes: number;
  // The page's image, by its path under /art/: a lossless WebP in a build.
  file: string;
  group: string;
  height: number;
  width: number;
}

export interface AtlasManifest {
  pages: AtlasPage[];
  textures: AtlasTexture[];
}

const count = v.pipe(v.number(), v.integer(), v.minValue(0));
const size = v.pipe(v.number(), v.integer(), v.minValue(1));

const atlasManifestSchema = record({
  pages: v.array(
    record({ bytes: count, file: v.string(), group: v.string(), height: size, width: size }),
  ),
  textures: v.array(
    record({
      frames: v.pipe(
        v.array(
          record({
            duration: v.exactOptional(v.number()),
            h: size,
            name: v.string(),
            trim: v.exactOptional(record({ h: size, w: size, x: count, y: count })),
            w: size,
            x: count,
            y: count,
          }),
        ),
        v.minLength(1),
      ),
      key: v.string(),
      page: count,
      tags: v.exactOptional(v.array(v.unknown())),
    }),
  ),
});

export function parseAtlasManifest(value: unknown): AtlasManifest {
  return parseOrThrow("atlas manifest", atlasManifestSchema, value);
}

// The Phaser texture key an atlas page loads under. The colon keeps it apart from the
// manifest's kebab-case keys.
export function atlasPageKey(page: number): string {
  return `atlas:${page}`;
}

// The Aseprite sheet a sprite's animations are built from, as Phaser's Aseprite loader caches
// it: frame durations keyed by frame name, and the tags.
export function asepriteSheetOf({ frames, tags }: AtlasTexture): unknown {
  return {
    frames: Object.fromEntries(frames.map(({ duration, name }) => [name, { duration }])),
    meta: { frameTags: tags ?? [] },
  };
}
