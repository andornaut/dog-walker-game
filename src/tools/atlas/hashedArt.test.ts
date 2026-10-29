import { readFile } from "node:fs/promises";

import { beforeAll, describe, expect, it } from "vitest";

import shippedManifest from "../../../public/art/manifest.json";
import { ATLAS_MANIFEST_PATH, type AtlasManifest } from "../../assets/atlasManifest";
import { type AssetManifest, parseManifest } from "../../assets/manifest";
import { ART_MANIFEST } from "../artManifest";
import { buildAtlases } from "./atlasBuild";
import { contentHash, type HashedArtFile, hashedArtFileName, hashGameArt } from "./hashedArt";

const ART_DIR = new URL("../../../public/art/", import.meta.url);
const readArt = async (path: string) => new Uint8Array(await readFile(new URL(path, ART_DIR)));

const manifest = parseManifest(shippedManifest);

describe("hashedArtFileName", () => {
  it.each([
    ["atlas/run-0.png", "assets/art/atlas/run-0-Bq3x_9-Z.png"],
    ["sprites/dog-kilo@88.json", "assets/art/sprites/dog-kilo@88-Bq3x_9-Z.json"],
    ["manifest.json", "assets/art/manifest-Bq3x_9-Z.json"],
  ])("names %s %s", (path, fileName) => {
    expect(hashedArtFileName(path, "Bq3x_9-Z")).toBe(fileName);
  });
});

describe("contentHash", () => {
  const bytes = (text: string) => new TextEncoder().encode(text);

  it("is eight URL-safe characters that follow the content", () => {
    expect(contentHash(bytes("a"))).toMatch(/^[\w-]{8}$/);
    expect(contentHash(bytes("a"))).toBe(contentHash(bytes("a")));
    expect(contentHash(bytes("a"))).not.toBe(contentHash(bytes("b")));
  });
});

// The files the game loads for each manifest entry, by path under /art/, as BootScene queues
// them: an atlased image or sprite's page, else its own files; a font's .fnt, and its PNG's page
// or else its PNG.
function loadedPaths(atlas: AtlasManifest, kind: keyof AssetManifest): Map<string, string[]> {
  const pageOf = new Map(
    atlas.textures.map(({ key, page }) => [key, atlas.pages[page]?.png ?? `page ${page}`]),
  );
  const atlasedOr = (key: string, own: string[]) => {
    const page = pageOf.get(key);
    return page === undefined ? own : [page];
  };
  const entries = {
    fonts: manifest.fonts.map(
      ({ fnt, key, png }) => [key, [fnt, ...atlasedOr(key, [png])]] as const,
    ),
    images: manifest.images.map(({ key, png }) => [key, atlasedOr(key, [png])] as const),
    sounds: manifest.sounds.map(({ key, m4a, ogg }) => [key, [m4a, ogg]] as const),
    sprites: manifest.sprites.map(
      ({ json, key, png }) => [key, atlasedOr(key, [json, png])] as const,
    ),
  }[kind];
  return new Map(entries.map(([key, paths]) => [key, [...paths]]));
}

describe("the shipped art's hashed files", () => {
  let atlas: AtlasManifest;
  let files: HashedArtFile[];
  let artFiles: Map<string, string>;
  // Packing every page is the slow part, so it runs once, with room to spare on a loaded machine.
  beforeAll(async () => {
    const build = await buildAtlases(readArt, { manifest });
    atlas = build.manifest;
    files = await hashGameArt(readArt, manifest, build);
    artFiles = new Map(files.map(({ fileName, path }) => [path, fileName]));
  }, 60_000);

  it.each(["fonts", "images", "sounds", "sprites"] as const)(
    "maps every file the game loads for each of the %s",
    (kind) => {
      const unmapped = [...loadedPaths(atlas, kind)].flatMap(([key, paths]) =>
        paths.filter((path) => !artFiles.has(path)).map((path) => `${key}: ${path}`),
      );
      expect(unmapped).toEqual([]);
    },
  );

  it("names each file once, by a hash of its content", () => {
    expect(new Set(files.map(({ fileName }) => fileName)).size).toBe(files.length);
    const misnamed = files.filter(
      ({ fileName, path, source }) => fileName !== hashedArtFileName(path, contentHash(source)),
    );
    expect(misnamed.map(({ path }) => path)).toEqual([]);
  });

  it("writes the atlas manifest the build packed, so the game reads its pages", async () => {
    const file = files.find(({ path }) => path === ATLAS_MANIFEST_PATH);
    expect(JSON.parse(new TextDecoder().decode(file?.source))).toEqual(atlas);
    const own = files.find(({ path }) => path === ART_MANIFEST);
    expect(own?.source).toEqual(await readArt(ART_MANIFEST));
  });
});
