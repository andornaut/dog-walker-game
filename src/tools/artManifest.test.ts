import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { encodePng } from "../atlas/atlasBuild";
import { blankImage } from "../atlas/atlasPixels";
import { type ArtFiles, artManifestText, generateArtManifest } from "./artManifest";
import { nodeArtFiles } from "./files";

const ART_DIR = new URL("../../public/art/", import.meta.url);

const encoder = new TextEncoder();

// A 4x4 frame per sprite, side by side, with frame 0 opaque from (1, 0) to (2, 2).
function spritePng(frames: number): Uint8Array {
  const image = blankImage(4 * frames, 4);
  for (const [x, y] of [
    [1, 0],
    [2, 2],
  ] as const) {
    image.data.set([255, 0, 0, 255], (y * image.width + x) * 4);
  }
  return encodePng(image);
}

function sheet(frames: number): Uint8Array {
  const entries = Array.from({ length: frames }, (_, i) => [
    `frame ${i}`,
    { duration: 100, frame: { h: 4, w: 4, x: 4 * i, y: 0 } },
  ]);
  return encoder.encode(JSON.stringify({ frames: Object.fromEntries(entries), meta: {} }));
}

function memoryArt(files: Record<string, Uint8Array | string>): ArtFiles {
  const bytes = (value: Uint8Array | string) =>
    typeof value === "string" ? encoder.encode(value) : value;
  return {
    list: async (dir) =>
      Object.keys(files)
        .filter((path) => (dir === "" ? !path.includes("/") : path.startsWith(`${dir}/`)))
        .map((path) => path.slice(dir === "" ? 0 : dir.length + 1))
        .filter((name) => !name.includes("/"))
        .sort(),
    read: async (path) => {
      const value = files[path];
      if (value === undefined) {
        throw new Error(`no ${path}`);
      }
      return bytes(value);
    },
  };
}

const FONT = '<font><pages><page id="0" file="font-body.png"/></pages></font>';

describe("generateArtManifest", () => {
  it("lists each folder's files by key, with anchors on ground sprites only", async () => {
    const manifest = await generateArtManifest(
      memoryArt({
        "fonts/font-body.fnt": FONT,
        "fonts/font-body.png": "",
        "images/help-lanes.png": "",
        "manifest.extra.json": JSON.stringify({ sounds: { "music-walk": { loop: true } } }),
        "sounds/music-walk.m4a": "",
        "sounds/music-walk.ogg": "",
        "sounds/sfx-bark.m4a": "",
        "sounds/sfx-bark.ogg": "",
        "sprites/cone.json": sheet(2),
        "sprites/cone.png": spritePng(2),
        "sprites/ui-button.json": sheet(1),
        "sprites/ui-button.png": spritePng(1),
      }),
    );
    expect(manifest).toEqual({
      fonts: [{ fnt: "fonts/font-body.fnt", key: "font-body", png: "fonts/font-body.png" }],
      images: [{ key: "help-lanes", png: "images/help-lanes.png" }],
      sounds: [
        {
          key: "music-walk",
          loop: true,
          m4a: "sounds/music-walk.m4a",
          ogg: "sounds/music-walk.ogg",
        },
        { key: "sfx-bark", m4a: "sounds/sfx-bark.m4a", ogg: "sounds/sfx-bark.ogg" },
      ],
      sprites: [
        {
          anchor: { feetY: 2, opaqueWidth: 2 },
          json: "sprites/cone.json",
          key: "cone",
          png: "sprites/cone.png",
        },
        { json: "sprites/ui-button.json", key: "ui-button", png: "sprites/ui-button.png" },
      ],
    });
  });

  it("fails on a sprite PNG without its sheet, and a sound in one format", async () => {
    await expect(generateArtManifest(memoryArt({ "sprites/cone.png": "" }))).rejects.toThrow(
      "sprites/cone.png has no sprites/cone.json",
    );
    await expect(generateArtManifest(memoryArt({ "sounds/sfx-bark.ogg": "" }))).rejects.toThrow(
      "sounds/sfx-bark.ogg has no sounds/sfx-bark.m4a",
    );
  });

  it("fails on a file a folder never holds, and a sidecar naming a missing sound", async () => {
    await expect(generateArtManifest(memoryArt({ "images/notes.txt": "" }))).rejects.toThrow(
      "images/notes.txt",
    );
    await expect(
      generateArtManifest(
        memoryArt({ "manifest.extra.json": '{ "sounds": { "music-walk": { "loop": true } } }' }),
      ),
    ).rejects.toThrow('names sound "music-walk"');
    await expect(
      generateArtManifest(memoryArt({ "manifest.extra.json": '{ "sound": {} }' })),
    ).rejects.toThrow("manifest.extra.json");
  });

  it("fails on a font whose page is not a PNG beside it", async () => {
    await expect(generateArtManifest(memoryArt({ "fonts/font-body.fnt": FONT }))).rejects.toThrow(
      "names page font-body.png",
    );
  });

  it("writes the committed manifest: run npm run art:manifest and commit it", async () => {
    const generated = artManifestText(await generateArtManifest(nodeArtFiles(ART_DIR.pathname)));
    const committed = await readFile(new URL("manifest.json", ART_DIR), "utf8");
    expect(JSON.parse(committed)).toEqual(JSON.parse(generated));
    expect(committed).toBe(generated);
  });
});
