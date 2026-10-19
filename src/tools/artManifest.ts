import * as v from "valibot";

import { isPlainObject, issuePath } from "../assets/jsonSchema";
import {
  type AssetManifest,
  type FontAsset,
  type ImageAsset,
  parseManifest,
  type SoundAsset,
  type SpriteAnchor,
  type SpriteAsset,
} from "../assets/manifest";
import { spriteAnchor } from "../assets/spriteAnchor";
import { standsOnGround } from "../assets/spriteKeys";
import { decodePng } from "../atlas/atlasBuild";
import { spriteSource } from "../atlas/atlasLayout";
import type { RgbaImage } from "../atlas/atlasPixels";
import { opaqueBoundsOfRgba } from "../layout/pixelShapes";
import { jsonText } from "./files";

// public/art/manifest.json, derived from the files under public/art/. A key is its file's
// name less the extension, and its kind is the folder it is in:
// - sprites/<key>.png with sprites/<key>.json (an Aseprite hash export) is a sprite. A sprite
//   standsOnGround picks gets an anchor measured from frame 0, as the game measures it.
// - images/<key>.png is an image.
// - fonts/<key>.fnt is a font, with the PNG its one page names.
// - sounds/<key>.ogg with sounds/<key>.m4a is a sound.
// Whatever a file cannot say is in the sidecar manifest.extra.json: a sound's loop flag.

export const ART_MANIFEST = "manifest.json";
export const ART_MANIFEST_EXTRA = "manifest.extra.json";

// The art directory's files, by paths relative to it.
export interface ArtFiles {
  // The names of the files directly in a folder; none for a missing folder.
  list(dir: string): Promise<string[]>;
  read(path: string): Promise<Uint8Array>;
}

// Strict, so a misspelt field fails rather than being dropped.
function strictRecord<T extends v.ObjectEntries>(entries: T) {
  return v.pipe(v.unknown(), v.check(isPlainObject, "must be an object"), v.strictObject(entries));
}

const extraSchema = strictRecord({
  sounds: v.optional(
    v.record(v.string(), strictRecord({ loop: v.exactOptional(v.boolean("must be a boolean")) })),
    {},
  ),
});

export type ArtManifestExtra = v.InferOutput<typeof extraSchema>;

export function parseArtManifestExtra(value: unknown): ArtManifestExtra {
  const result = v.safeParse(extraSchema, value, { abortPipeEarly: true });
  if (!result.success) {
    const [issue] = result.issues;
    throw new Error(`${ART_MANIFEST_EXTRA}${issuePath(issue)} ${issue.message}`);
  }
  return result.output;
}

function splitName(name: string): { ext: string; stem: string } {
  const dot = name.lastIndexOf(".");
  return dot <= 0
    ? { ext: "", stem: name }
    : { ext: name.slice(dot + 1), stem: name.slice(0, dot) };
}

// The stems of a folder's files by extension, failing on any extension the folder never holds.
async function stemsByExt(
  files: ArtFiles,
  dir: string,
  allowed: readonly string[],
): Promise<Map<string, Set<string>>> {
  const byExt = new Map(allowed.map((ext) => [ext, new Set<string>()]));
  for (const name of await files.list(dir)) {
    if (name.startsWith(".")) {
      continue;
    }
    const { ext, stem } = splitName(name);
    const stems = byExt.get(ext);
    if (stems === undefined) {
      throw new Error(
        `${dir}/${name}: a ${dir} file is ${allowed.map((e) => `.${e}`).join(" or ")}`,
      );
    }
    stems.add(stem);
  }
  return byExt;
}

function stemsOf(byExt: Map<string, Set<string>>, ext: string): Set<string> {
  return byExt.get(ext) ?? new Set();
}

// Throws for a stem in one set but not the other, naming the file it lacks.
function requirePairs(dir: string, a: [string, Set<string>], b: [string, Set<string>]): void {
  for (const [[ext, stems], [otherExt, others]] of [
    [a, b],
    [b, a],
  ] as const) {
    for (const stem of stems) {
      if (!others.has(stem)) {
        throw new Error(`${dir}/${stem}.${ext} has no ${dir}/${stem}.${otherExt}`);
      }
    }
  }
}

const byKey = <T extends { key: string }>(a: T, b: T): number =>
  a.key < b.key ? -1 : a.key > b.key ? 1 : 0;

// Where a sprite stands, from frame 0's opaque pixels by spriteAnchor, as measureSprite
// reads a sprite without an anchor at boot.
export function measureAnchor(image: RgbaImage, json: unknown, key: string): SpriteAnchor {
  const frame = spriteSource(key, "", json).frames[0];
  if (frame === undefined) {
    throw new Error(`${key} has no frames`);
  }
  const { height, width, x, y } = frame.from;
  const rgba = new Uint8Array(width * height * 4);
  for (let row = 0; row < height; row++) {
    const start = ((y + row) * image.width + x) * 4;
    rgba.set(image.data.subarray(start, start + width * 4), row * width * 4);
  }
  return spriteAnchor(opaqueBoundsOfRgba(width, height, rgba), width, height);
}

// decoded caches each PNG decoded, by its path, for a caller that decodes them again.
export async function generateArtManifest(
  files: ArtFiles,
  decoded: Map<string, RgbaImage> = new Map(),
): Promise<AssetManifest> {
  const decoder = new TextDecoder();
  const readJson = async (path: string): Promise<unknown> =>
    JSON.parse(decoder.decode(await files.read(path)));

  const extraNames = new Set(await files.list(""));
  const extra = parseArtManifestExtra(
    extraNames.has(ART_MANIFEST_EXTRA) ? await readJson(ART_MANIFEST_EXTRA) : {},
  );

  const spriteFiles = await stemsByExt(files, "sprites", ["json", "png"]);
  requirePairs(
    "sprites",
    ["png", stemsOf(spriteFiles, "png")],
    ["json", stemsOf(spriteFiles, "json")],
  );
  const sprites = await Promise.all(
    [...stemsOf(spriteFiles, "png")].map(async (key): Promise<SpriteAsset> => {
      const png = `sprites/${key}.png`;
      const json = `sprites/${key}.json`;
      if (!standsOnGround(key)) {
        return { json, key, png };
      }
      const [bytes, sheet] = await Promise.all([files.read(png), readJson(json)]);
      const image = decodePng(bytes);
      decoded.set(png, image);
      return { anchor: measureAnchor(image, sheet, key), json, key, png };
    }),
  );

  const imageFiles = await stemsByExt(files, "images", ["png"]);
  const images = [...stemsOf(imageFiles, "png")].map((key): ImageAsset => ({
    key,
    png: `images/${key}.png`,
  }));

  const fontFiles = await stemsByExt(files, "fonts", ["fnt", "png"]);
  const pagePngs = new Set<string>();
  const fonts = await Promise.all(
    [...stemsOf(fontFiles, "fnt")].map(async (key): Promise<FontAsset> => {
      const fnt = `fonts/${key}.fnt`;
      const pages = [
        ...decoder.decode(await files.read(fnt)).matchAll(/<page\b[^>]*\bfile="([^"]+)"/g),
      ];
      const page = pages[0]?.[1];
      if (pages.length !== 1 || page === undefined) {
        throw new Error(`${fnt} must have exactly one page, not ${pages.length}`);
      }
      if (!stemsOf(fontFiles, "png").has(splitName(page).stem) || splitName(page).ext !== "png") {
        throw new Error(`${fnt} names page ${page}, which is not a PNG in fonts/`);
      }
      pagePngs.add(splitName(page).stem);
      return { fnt, key, png: `fonts/${page}` };
    }),
  );
  for (const stem of stemsOf(fontFiles, "png")) {
    if (!pagePngs.has(stem)) {
      throw new Error(`fonts/${stem}.png is no font's page`);
    }
  }

  const soundFiles = await stemsByExt(files, "sounds", ["m4a", "ogg"]);
  requirePairs("sounds", ["ogg", stemsOf(soundFiles, "ogg")], ["m4a", stemsOf(soundFiles, "m4a")]);
  const soundKeys = stemsOf(soundFiles, "ogg");
  for (const key of Object.keys(extra.sounds)) {
    if (!soundKeys.has(key)) {
      throw new Error(`${ART_MANIFEST_EXTRA} names sound "${key}", which has no files in sounds/`);
    }
  }
  const sounds = [...soundKeys].map((key): SoundAsset => {
    const loop = extra.sounds[key]?.loop;
    return {
      key,
      m4a: `sounds/${key}.m4a`,
      ogg: `sounds/${key}.ogg`,
      ...(loop === undefined ? {} : { loop }),
    };
  });

  // Validated as boot validates it, which also puts every object's fields in sorted order.
  return parseManifest({
    fonts: fonts.sort(byKey),
    images: images.sort(byKey),
    sounds: sounds.sort(byKey),
    sprites: sprites.sort(byKey),
  });
}

// The manifest's fields in the order art's tools have always written them, so the generated
// file diffs cleanly against theirs.
const LIST_ORDER = ["sprites", "fonts", "images", "sounds"] as const;
const FIELD_ORDER = ["key", "png", "json", "fnt", "ogg", "m4a", "loop", "anchor"];

function ordered(entry: object): Record<string, unknown> {
  const fields = new Map(Object.entries(entry));
  return Object.fromEntries(
    FIELD_ORDER.filter((field) => fields.has(field)).map((field) => [field, fields.get(field)]),
  );
}

export function artManifestText(manifest: AssetManifest): string {
  return jsonText(
    Object.fromEntries(LIST_ORDER.map((list) => [list, manifest[list].map(ordered)])),
  );
}
