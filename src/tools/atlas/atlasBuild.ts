import { createHash } from "node:crypto";

import { getOrInsertComputed } from "@andornaut/game-kit/maps";
import { PNG } from "pngjs";

import { atlasGroupOf } from "../../assets/atlasGroups";
import type { AtlasManifest } from "../../assets/atlasManifest";
import { type AssetManifest, parseManifest } from "../../assets/manifest";
import { disabledArtKey, greyForDisabledTile, greysOnTile } from "../../ui/disabledArt";
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
  // Each page's file, by its path relative to the art directory.
  files: Map<string, Uint8Array>;
  manifest: AtlasManifest;
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

// A disabled tile's grey copy of a texture: its frames, read from a grey copy of its PNG, which
// is added to images.
function disabledCopy(images: Map<string, RgbaImage>, texture: SourceTexture): SourceTexture {
  const png = `${texture.png}#disabled`;
  const image = images.get(texture.png);
  if (image !== undefined && !images.has(png)) {
    const pixels = new Uint8ClampedArray(image.data);
    greyForDisabledTile(pixels);
    images.set(png, { ...image, data: new Uint8Array(pixels.buffer) });
  }
  return { ...texture, key: disabledArtKey(texture.key), png };
}

// How each page's pixels become its file, and the file's extension.
export interface PageFormat {
  encode: (page: RgbaImage) => Uint8Array | Promise<Uint8Array>;
  extension: string;
}

export const PNG_PAGES: PageFormat = { encode: encodePng, extension: "png" };

// What a caller has already read: the art manifest, else read from manifest.json, and PNGs
// decoded by their paths. Pages are PNGs unless pages names another format.
interface AtlasInputs {
  decoded?: ReadonlyMap<string, RgbaImage>;
  manifest?: AssetManifest;
  pages?: PageFormat;
}

// Packs every image, font PNG and sprite frame of the art manifest into atlas pages, with a
// disabled tile's grey copy of each picture one can grey, reading each file by its path
// relative to the art directory. A key whose files cannot be read or parsed, or with a frame
// too large for a page, is left out with a warning.
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
    ...[...manifest.images, ...manifest.fonts].map(({ key, png }) =>
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

  const packed = sources.flat();
  const disabled = packed
    .filter(({ key }) => greysOnTile(key))
    .map((texture) => disabledCopy(images, texture));
  const layout = layoutAtlases([...packed, ...disabled]);
  warnings.push(...layout.skipped.map((key) => `${key} has a frame too large for an atlas page`));
  const { encode, extension } = inputs.pages ?? PNG_PAGES;
  const files = await Promise.all(
    layout.pages.map(async (page) => {
      const { group, height, name, width } = page;
      const bytes = await encode(drawPage(images, page));
      return {
        bytes,
        page: { bytes: bytes.length, file: `${name}.${extension}`, group, height, width },
      };
    }),
  );
  return {
    files: new Map(files.map(({ bytes, page }) => [page.file, bytes])),
    manifest: { pages: files.map(({ page }) => page), textures: layout.textures },
    warnings,
  };
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
