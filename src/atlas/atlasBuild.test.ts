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

function pixelsOf(image: RgbaImage, x: number, y: number, width: number, height: number) {
  const rows: number[][] = [];
  for (let row = y; row < y + height; row++) {
    const start = (row * image.width + x) * 4;
    rows.push([...image.data.subarray(start, start + width * 4)]);
  }
  return rows;
}

describe("the shipped art's atlases", () => {
  let build: AtlasBuild;
  // Each key's source PNG, decoded, and each sprite's Aseprite sheet.
  const sources = new Map<string, RgbaImage>();
  const sheets = new Map<string, Sheet>();
  beforeAll(async () => {
    build = await buildAtlases(readArt);
    const decoder = new TextDecoder();
    await Promise.all([
      ...[...manifest.images, ...manifest.sprites].map(async ({ key, png }) => {
        sources.set(key, decodePng(await readArt(png)));
      }),
      ...manifest.sprites.map(async ({ json, key }) => {
        sheets.set(key, JSON.parse(decoder.decode(await readArt(json))) as Sheet);
      }),
    ]);
  });

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
    const pages = build.manifest.pages.map(({ png }) =>
      decodePng(build.pngs.get(png) ?? new Uint8Array()),
    );
    for (const { frames, key, page } of build.manifest.textures) {
      const source = sources.get(key);
      const atlas = pages[page];
      for (const { h, name, w, x, y } of frames) {
        const from = sheets.get(key)?.frames[name]?.frame ?? { x: 0, y: 0 };
        const expected = source && pixelsOf(source, from.x, from.y, w, h);
        expect(atlas && pixelsOf(atlas, x, y, w, h), `${key} ${name}`).toEqual(expected);
      }
    }
  });
});
