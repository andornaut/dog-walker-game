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

describe("parseManifest", () => {
  it("accepts a well-formed manifest", () => {
    expect(parseManifest(valid)).toEqual(valid);
  });

  it("accepts empty lists", () => {
    expect(parseManifest({ fonts: [], images: [], sprites: [] }).sprites).toEqual([]);
  });

  it("treats a missing sounds list as no sounds", () => {
    expect(parseManifest({ ...valid, sounds: undefined }).sounds).toEqual([]);
  });

  it("requires both audio formats and a boolean loop", () => {
    const noM4a = [{ key: "sfx-tip", ogg: "sounds/sfx-tip.ogg" }];
    expect(() => parseManifest({ ...valid, sounds: noM4a })).toThrow("manifest.sounds[0].m4a");
    const badLoop = [{ key: "sfx-tip", loop: "yes", m4a: "a.m4a", ogg: "a.ogg" }];
    expect(() => parseManifest({ ...valid, sounds: badLoop })).toThrow("loop must be a boolean");
  });

  it("names the list that is missing", () => {
    expect(() => parseManifest({ ...valid, images: undefined })).toThrow("manifest.images");
  });

  it("names the entry and field that is missing", () => {
    const sprites = [{ key: "dog-koda", png: "sprites/dog-koda.png" }];
    expect(() => parseManifest({ ...valid, sprites })).toThrow("manifest.sprites[0].json");
  });

  it("rejects a key that is not kebab-case", () => {
    const images = [{ key: "Card_Frame", png: "images/card-frame.png" }];
    expect(() => parseManifest({ ...valid, images })).toThrow('"Card_Frame"');
  });

  it("rejects a key used twice across lists", () => {
    const images = [{ key: "dog-koda", png: "images/dog-koda.png" }];
    expect(() => parseManifest({ ...valid, images })).toThrow("more than once");
  });
});

describe("assetUrl", () => {
  it("joins the base and path with one slash", () => {
    expect(assetUrl("/art/", "/sprites/dog-koda.png")).toBe("/art/sprites/dog-koda.png");
    expect(assetUrl("/art", "sprites/dog-koda.png")).toBe("/art/sprites/dog-koda.png");
  });
});
