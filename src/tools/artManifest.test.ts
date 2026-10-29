import { readFile } from "node:fs/promises";

import { blankImage } from "@andornaut/game-kit/art/rgbaImage";
import { describe, expect, it } from "vitest";

import { type ArtFiles, artManifestText, generateArtManifest } from "./artManifest";
import { encodePng } from "./atlas/atlasBuild";
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
        "images/card-skip.png": "",
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
      images: [{ key: "card-skip", png: "images/card-skip.png" }],
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

  it("fails on a missing pair, a stray file, a bad sidecar or a font page that is not beside it", async () => {
    const cases: { error: string; files: Record<string, string>; name: string }[] = [
      {
        error: "sprites/cone.png has no sprites/cone.json",
        files: { "sprites/cone.png": "" },
        name: "a sprite PNG without its sheet",
      },
      {
        error: "sounds/sfx-bark.ogg has no sounds/sfx-bark.m4a",
        files: { "sounds/sfx-bark.ogg": "" },
        name: "a sound in one format",
      },
      {
        error: "images/notes.txt",
        files: { "images/notes.txt": "" },
        name: "a file a folder never holds",
      },
      {
        error: 'names sound "music-walk"',
        files: { "manifest.extra.json": '{ "sounds": { "music-walk": { "loop": true } } }' },
        name: "a sidecar naming a missing sound",
      },
      {
        error: "manifest.extra.json",
        files: { "manifest.extra.json": '{ "sound": {} }' },
        name: "a malformed sidecar",
      },
      {
        error: "names page font-body.png",
        files: { "fonts/font-body.fnt": FONT },
        name: "a font whose page is not a PNG beside it",
      },
    ];
    await Promise.all(
      cases.map(({ error, files, name }) =>
        expect(generateArtManifest(memoryArt(files)), name).rejects.toThrow(error),
      ),
    );
  });

  it("writes the committed manifest: run npm run art:manifest and commit it", async () => {
    const generated = artManifestText(await generateArtManifest(nodeArtFiles(ART_DIR.pathname)));
    const committed = await readFile(new URL("manifest.json", ART_DIR), "utf8");
    expect(JSON.parse(committed)).toEqual(JSON.parse(generated));
    expect(committed).toBe(generated);
  });
});
