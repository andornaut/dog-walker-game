import { describe, expect, it } from "vitest";

import { assetUrl, parseManifest } from "./manifest";

const valid = {
  fonts: [{ fnt: "fonts/pixel.fnt", key: "pixel", png: "fonts/pixel.png" }],
  images: [{ key: "card-frame", png: "images/card-frame.png" }],
  sounds: [
    { key: "music-walk", loop: true, m4a: "sounds/music-walk.m4a", ogg: "sounds/music-walk.ogg" },
  ],
  sprites: [{ json: "sprites/dog-koda.json", key: "dog-koda", png: "sprites/dog-koda.png" }],
};

type Manifest = ReturnType<typeof parseManifest>;

const sprite = { ...valid.sprites[0], anchor: { feetY: 31, opaqueWidth: 20 } };
const keyed = (key: string) => ({ ...valid, sprites: [{ ...valid.sprites[0], key }] });
const { fonts, sounds, sprites } = valid;

describe("parseManifest", () => {
  it.each<{ expected: unknown; manifest: unknown; name: string; pick: (m: Manifest) => unknown }>([
    { expected: valid, manifest: valid, name: "a well-formed manifest", pick: (m) => m },
    {
      expected: [],
      manifest: { fonts: [], images: [], sprites: [] },
      name: "empty lists",
      pick: (m) => m.sprites,
    },
    {
      expected: sprite.anchor,
      manifest: { ...valid, sprites: [sprite] },
      name: "a sprite's anchor",
      pick: (m) => m.sprites[0]?.anchor,
    },
    {
      expected: [],
      manifest: { ...valid, sounds: undefined },
      name: "a missing sounds list as no sounds",
      pick: (m) => m.sounds,
    },
    {
      expected: [{ key: "card-frame", png: "./images/card.frame.png" }],
      manifest: { ...valid, images: [{ key: "card-frame", png: "./images/card.frame.png" }] },
      name: "a path with a dot segment and dotted file names",
      pick: (m) => m.images,
    },
    ...["bin@50", "dog-koda@62", "dog-koda@75", "parked-car@88"].map((key) => ({
      expected: key,
      manifest: keyed(key),
      name: `the depth step key ${key}`,
      pick: (m: Manifest) => m.sprites[0]?.key,
    })),
  ])("accepts $name", ({ expected, manifest, pick }) => {
    expect(pick(parseManifest(manifest))).toEqual(expected);
  });

  it.each<{ error: string; manifest: unknown; name: string }>([
    {
      error: "feetY",
      manifest: { ...valid, sprites: [{ ...sprite, anchor: { feetY: -1, opaqueWidth: 20 } }] },
      name: "a negative anchor feetY",
    },
    {
      error: "opaqueWidth",
      manifest: { ...valid, sprites: [{ ...sprite, anchor: { feetY: 31, opaqueWidth: 0 } }] },
      name: "a zero anchor opaqueWidth",
    },
    {
      error: "manifest.sounds[0].m4a",
      manifest: { ...valid, sounds: [{ key: "sfx-tip", ogg: "sounds/sfx-tip.ogg" }] },
      name: "a sound without both formats",
    },
    {
      error: "manifest.sounds[0].loop must be a boolean",
      manifest: { ...valid, sounds: [{ key: "sfx-tip", loop: "yes", m4a: "a.m4a", ogg: "a.ogg" }] },
      name: "a sound whose loop is not a boolean",
    },
    {
      error: "manifest.images must be an array",
      manifest: { ...valid, images: undefined },
      name: "an undefined list, naming it",
    },
    {
      error: "manifest.images is required",
      manifest: { fonts, sounds, sprites },
      name: "a missing list, naming it",
    },
    {
      error: "manifest.sprites[0].json is required",
      manifest: { ...valid, sprites: [{ key: "dog-koda", png: "sprites/dog-koda.png" }] },
      name: "a missing field, naming the entry and field",
    },
    {
      error: 'manifest.images[0].key "Card_Frame" must be kebab-case',
      manifest: { ...valid, images: [{ key: "Card_Frame", png: "images/card-frame.png" }] },
      name: "a key that is not kebab-case",
    },
    ...["bin@25", "bin@33", "bin@63", "bin@", "bin@88@50", "bin@100"].map((key) => ({
      error: "kebab-case",
      manifest: keyed(key),
      name: `the key ${key}, which is not a depth step`,
    })),
    {
      error: 'manifest key "dog-koda" appears more than once, in images[0] and sprites[0]',
      manifest: { ...valid, images: [{ key: "dog-koda", png: "images/dog-koda.png" }] },
      name: "a key used twice across lists, naming both lists",
    },
    { error: "manifest must be an object", manifest: null, name: "a null manifest" },
    { error: "manifest must be an object", manifest: [], name: "an array manifest" },
    {
      error: "manifest.fonts must be an array",
      manifest: { ...valid, fonts: {} },
      name: "a list that is not an array",
    },
    {
      error: "manifest.images[0] must be an object",
      manifest: { ...valid, images: [null] },
      name: "a null entry",
    },
    {
      error: "manifest.images[0].png must be a non-empty string",
      manifest: { ...valid, images: [{ key: "card-frame", png: "" }] },
      name: "an empty field",
    },
    ...[
      ["/images/card-frame.png", "must be relative, without a leading slash"],
      ["https://example.com/card-frame.png", "must be relative, without a scheme"],
      ["../card-frame.png", "must not have a .. segment"],
      ["images/../../card-frame.png", "must not have a .. segment"],
    ].map(([png, message]) => ({
      error: `manifest.images[0].png ${message ?? ""}`,
      manifest: { ...valid, images: [{ key: "card-frame", png }] },
      name: `the path ${png ?? ""}`,
    })),
  ])("rejects $name", ({ error, manifest }) => {
    expect(() => parseManifest(manifest)).toThrow(error);
  });
});

describe("assetUrl", () => {
  it.each([
    ["/art/", "/sprites/dog-koda.png"],
    ["/art", "sprites/dog-koda.png"],
  ])("joins %s and %s with one slash", (base, path) => {
    expect(assetUrl(base, path)).toBe("/art/sprites/dog-koda.png");
  });
});
