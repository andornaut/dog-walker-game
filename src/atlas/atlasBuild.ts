import { PNG } from "pngjs";

import { parseManifest } from "../assets/manifest";
import {
  EXTRUDE,
  imageSource,
  layoutAtlases,
  type SourceTexture,
  spriteSource,
} from "./atlasLayout";
import type { AtlasManifest } from "./atlasManifest";
import { blankImage, blitExtruded, type RgbaImage } from "./atlasPixels";

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

// Pixel art's flat runs compress best unfiltered and with zlib's default strategy: about half
// the size of pngjs's adaptive filters and run-length strategy.
function encodePng({ data, height, width }: RgbaImage): Uint8Array {
  const png = new PNG({ height, width });
  png.data = Buffer.from(data);
  return PNG.sync.write(png, { colorType: 6, deflateLevel: 9, deflateStrategy: 0, filterType: 0 });
}

// Packs every image and sprite frame of the art manifest into atlas pages, reading each file
// by its path relative to the art directory. A key whose files cannot be read or parsed, or
// with a frame too large for a page, is left out with a warning.
export async function buildAtlases(
  readArt: (path: string) => Promise<Uint8Array>,
): Promise<AtlasBuild> {
  const decoder = new TextDecoder();
  const manifest = parseManifest(JSON.parse(decoder.decode(await readArt("manifest.json"))));
  const warnings: string[] = [];
  const images = new Map<string, RgbaImage>();
  const readPng = async (path: string): Promise<RgbaImage> => {
    const image = decodePng(await readArt(path));
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
        const [sheet, { height, width }] = await Promise.all([readArt(json), readPng(png)]);
        const source = spriteSource(key, png, JSON.parse(decoder.decode(sheet)));
        const outside = source.frames.find(
          ({ from }) => from.x + from.width > width || from.y + from.height > height,
        );
        if (outside !== undefined) {
          throw new Error(`frame "${outside.name}" reaches outside its ${width}x${height} PNG`);
        }
        return source;
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
  for (const { blits, group, height, png, width } of layout.pages) {
    const page = blankImage(width, height);
    for (const { at, from, png: sourcePng } of blits) {
      const source = images.get(sourcePng);
      if (source !== undefined) {
        blitExtruded(source, from, EXTRUDE, page, at);
      }
    }
    const bytes = encodePng(page);
    build.pngs.set(png, bytes);
    build.manifest.pages.push({ bytes: bytes.length, group, height, png, width });
  }
  return build;
}
