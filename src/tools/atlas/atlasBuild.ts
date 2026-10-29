import { createHash } from "node:crypto";

import { getOrInsertComputed } from "@andornaut/game-kit/maps";
import { PNG } from "pngjs";

import { atlasGroupOf } from "../../assets/atlasGroups";
import type { AtlasManifest } from "../../assets/atlasManifest";
import { type AssetManifest, parseManifest } from "../../assets/manifest";
import {
  EXTRUDE,
  imageSource,
  layoutAtlases,
  type PageLayout,
  type SourceFrame,
  type SourceTexture,
  spriteSource,
} from "./atlasLayout";
import { blankImage, blitExtruded, opaqueRect, type RgbaImage } from "./atlasPixels";
import { encodeIndexedPng } from "./indexedPng";

export interface AtlasBuild {
  manifest: AtlasManifest;
  // Each page's PNG, by its path relative to the art directory.
  pngs: Map<string, Uint8Array>;
  // Keys left to load from their own files, and why.
  warnings: string[];
}

export function decodePng(bytes: Uint8Array): RgbaImage {
  const { data, height, width } = PNG.sync.read(Buffer.from(bytes));
  return { data: new Uint8Array(data), height, width };
}

// image as a lossless PNG: indexed when it has at most MAX_PALETTE colours, as every atlas page
// does, else RGBA. Pixel art's flat runs compress best unfiltered and with zlib's default
// strategy: about half the size of pngjs's adaptive filters and run-length strategy.
export function encodePng(image: RgbaImage): Uint8Array {
  const indexed = encodeIndexedPng(image);
  if (indexed !== undefined) {
    return indexed;
  }
  const { data, height, width } = image;
  const png = new PNG({ height, width });
  png.data = Buffer.from(data);
  return PNG.sync.write(png, { colorType: 6, deflateLevel: 9, deflateStrategy: 0, filterType: 0 });
}

// Whether a sprite's frames pack only their opaque pixels: the road's do, those the home
// screen draws too included. UI art and cards stay whole, as do images, since a tile sprite and
// a nine-slice draw a frame's packed rect as the whole frame, and the road reads a backdrop's
// pixels from its packed rect.
const TRIMMED_GROUPS: ReadonlySet<string> = new Set(["home", "run"]);
export const trimsFrames = (key: string): boolean => TRIMMED_GROUPS.has(atlasGroupOf(key));

// A sprite's frames as the atlas packs them. With trim, each frame keeps only the rect that
// holds its opaque pixels (a clear frame, its top-left pixel) and records where that sits in
// the whole frame. A frame whose packed pixels, extruded border included, match an earlier
// frame's reads that frame's rect, so the two share one rect on the page.
export function compactFrames(
  image: RgbaImage,
  trim: boolean,
  texture: SourceTexture,
): SourceTexture {
  const firsts = new Map<string, Pick<SourceFrame, "bounds" | "from">>();
  const frames = texture.frames.map(({ from: whole, ...frame }): SourceFrame => {
    const from = trim
      ? (opaqueRect(image, whole) ?? { height: 1, width: 1, x: whole.x, y: whole.y })
      : whole;
    const trimmed = from.width !== whole.width || from.height !== whole.height;
    const cell = blankImage(from.width + 2 * EXTRUDE, from.height + 2 * EXTRUDE);
    blitExtruded(image, from, EXTRUDE, cell, { x: EXTRUDE, y: EXTRUDE }, whole);
    const id = createHash("sha256")
      .update(`${from.width}x${from.height}`)
      .update(cell.data)
      .digest("hex");
    const first = getOrInsertComputed(
      id,
      () => ({ from, ...(trimmed ? { bounds: whole } : {}) }),
      firsts,
    );
    return {
      ...frame,
      ...first,
      ...(trimmed
        ? { trim: { h: whole.height, w: whole.width, x: from.x - whole.x, y: from.y - whole.y } }
        : {}),
    };
  });
  return { ...texture, frames };
}

// What a caller has already read: the art manifest, else read from manifest.json, and PNGs
// decoded by their paths.
interface AtlasInputs {
  decoded?: ReadonlyMap<string, RgbaImage>;
  // How each page's pixels become its PNG: encodePng unless given.
  encode?: (page: RgbaImage) => Uint8Array;
  manifest?: AssetManifest;
}

// Packs every image and sprite frame of the art manifest into atlas pages, reading each file
// by its path relative to the art directory. A key whose files cannot be read or parsed, or
// with a frame too large for a page, is left out with a warning.
export async function buildAtlases(
  readArt: (path: string) => Promise<Uint8Array>,
  inputs: AtlasInputs = {},
): Promise<AtlasBuild> {
  const decoder = new TextDecoder();
  const manifest =
    inputs.manifest ?? parseManifest(JSON.parse(decoder.decode(await readArt("manifest.json"))));
  const warnings: string[] = [];
  const images = new Map<string, RgbaImage>();
  const readPng = async (path: string): Promise<RgbaImage> => {
    const image = inputs.decoded?.get(path) ?? decodePng(await readArt(path));
    images.set(path, image);
    return image;
  };
  const sourceOf = async (
    key: string,
    read: () => Promise<SourceTexture>,
  ): Promise<SourceTexture[]> => {
    try {
      return [await read()];
    } catch (error) {
      warnings.push(`${key} is left out of the atlas: ${String(error)}`);
      return [];
    }
  };
  const sources = await Promise.all([
    ...manifest.images.map(({ key, png }) =>
      sourceOf(key, async () => {
        const { height, width } = await readPng(png);
        return imageSource(png, width, height, key);
      }),
    ),
    ...manifest.sprites.map(({ json, key, png }) =>
      sourceOf(key, async () => {
        const [sheet, image] = await Promise.all([readArt(json), readPng(png)]);
        const { height, width } = image;
        const source = spriteSource(key, png, JSON.parse(decoder.decode(sheet)));
        const outside = source.frames.find(
          ({ from }) => from.x + from.width > width || from.y + from.height > height,
        );
        if (outside !== undefined) {
          throw new Error(`frame "${outside.name}" reaches outside its ${width}x${height} PNG`);
        }
        return compactFrames(image, trimsFrames(key), source);
      }),
    ),
  ]);

  const layout = layoutAtlases(sources.flat());
  warnings.push(...layout.skipped.map((key) => `${key} has a frame too large for an atlas page`));
  const build: AtlasBuild = {
    manifest: { pages: [], textures: layout.textures },
    pngs: new Map(),
    warnings,
  };
  for (const page of layout.pages) {
    const { group, height, png, width } = page;
    const bytes = (inputs.encode ?? encodePng)(drawPage(images, page));
    build.pngs.set(png, bytes);
    build.manifest.pages.push({ bytes: bytes.length, group, height, png, width });
  }
  return build;
}

// A page's pixels, each blit copied from its source PNG in images, by path.
export function drawPage(
  images: ReadonlyMap<string, RgbaImage>,
  { blits, height, width }: PageLayout,
): RgbaImage {
  const page = blankImage(width, height);
  for (const { at, bounds, from, png } of blits) {
    const source = images.get(png);
    if (source !== undefined) {
      blitExtruded(source, from, EXTRUDE, page, at, bounds);
    }
  }
  return page;
}
