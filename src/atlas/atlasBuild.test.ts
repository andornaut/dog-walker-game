import { readFile } from "node:fs/promises";

import { beforeAll, describe, expect, it } from "vitest";

import shippedManifest from "../../public/art/manifest.json";
import { parseManifest } from "../assets/manifest";
import { type AtlasBuild, buildAtlases, decodePng } from "./atlasBuild";
import { ATLAS_MAX_SIZE } from "./atlasLayout";
import { BASE_FRAME, parseAtlasManifest } from "./atlasManifest";
import type { RgbaImage } from "./atlasPixels";

const ART_DIR = new URL("../../public/art/", import.meta.url);
const readArt = async (path: string) => new Uint8Array(await readFile(new URL(path, ART_DIR)));

const manifest = parseManifest(shippedManifest);

interface Sheet {
  frames: Record<string, { duration: number; frame: { x: number; y: number } }>;
  meta: { frameTags?: unknown[] };
}

// Whether the width x height rect at (ax, ay) in a holds the same bytes as the one at (bx, by)
// in b. Byte compares keep the check over every frame cheap; a deep equal of pixel arrays does not.
function sameRect(
  a: RgbaImage,
  ax: number,
  ay: number,
  b: RgbaImage,
  bx: number,
  by: number,
  width: number,
  height: number,
): boolean {
  const rowBytes = width * 4;
  for (let row = 0; row < height; row++) {
    const aStart = ((ay + row) * a.width + ax) * 4;
    const bStart = ((by + row) * b.width + bx) * 4;
    const aRow = a.data.subarray(aStart, aStart + rowBytes);
    const bRow = b.data.subarray(bStart, bStart + rowBytes);
    if (aRow.length !== rowBytes || Buffer.compare(aRow, bRow) !== 0) {
      return false;
    }
  }
  return true;
}

describe("the shipped art's atlases", () => {
  let build: AtlasBuild;
  let pages: RgbaImage[];
  // Each key's source PNG, decoded, and each sprite's Aseprite sheet.
  const sources = new Map<string, RgbaImage>();
  const sheets = new Map<string, Sheet>();
  // Packing every page is the slow part, so it runs once, with room to spare on a loaded machine.
  beforeAll(async () => {
    build = await buildAtlases(readArt);
    pages = build.manifest.pages.map(({ png }) =>
      decodePng(build.pngs.get(png) ?? new Uint8Array()),
    );
    const decoder = new TextDecoder();
    await Promise.all([
      ...[...manifest.images, ...manifest.sprites].map(async ({ key, png }) => {
        sources.set(key, decodePng(await readArt(png)));
      }),
      ...manifest.sprites.map(async ({ json, key }) => {
        sheets.set(key, JSON.parse(decoder.decode(await readArt(json))) as Sheet);
      }),
    ]);
  }, 60_000);

  it("packs every image and sprite with no warnings, on pages that fit a phone GPU", () => {
    expect(build.warnings).toEqual([]);
    expect(build.manifest.pages.length).toBeLessThanOrEqual(8);
    for (const { height, width } of build.manifest.pages) {
      expect(Math.max(width, height)).toBeLessThanOrEqual(ATLAS_MAX_SIZE);
    }
  });

  it("writes a manifest the runtime parses", () => {
    const json: unknown = JSON.parse(JSON.stringify(build.manifest));
    expect(parseAtlasManifest(json)).toEqual(build.manifest);
  });

  it("maps every manifest key, and every frame of each sprite in export order", () => {
    const textures = new Map(build.manifest.textures.map((texture) => [texture.key, texture]));
    for (const { key } of manifest.images) {
      expect(textures.get(key)?.frames.map(({ name }) => name)).toEqual([BASE_FRAME]);
    }
    for (const [key, { frames, meta }] of sheets) {
      const texture = textures.get(key);
      expect(texture?.frames.map(({ duration, name }) => [name, duration])).toEqual(
        Object.entries(frames).map(([name, { duration }]) => [name, duration]),
      );
      expect(texture?.tags).toEqual(meta.frameTags ?? []);
    }
    expect(textures.size).toBe(manifest.images.length + manifest.sprites.length);
  });

  it("copies each image and frame pixel for pixel", () => {
    const differing: string[] = [];
    for (const { frames, key, page } of build.manifest.textures) {
      const source = sources.get(key);
      const atlas = pages[page];
      for (const { h, name, w, x, y } of frames) {
        const from = sheets.get(key)?.frames[name]?.frame ?? { x: 0, y: 0 };
        if (!source || !atlas || !sameRect(atlas, x, y, source, from.x, from.y, w, h)) {
          differing.push(`${key} ${name}`);
        }
      }
    }
    expect(differing).toEqual([]);
  });
});
