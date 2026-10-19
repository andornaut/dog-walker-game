import { describe, expect, it } from "vitest";

import shippedManifest from "../../public/art/manifest.json";
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
    expect(() => parseManifest({ ...valid, sounds: badLoop })).toThrow(
      "manifest.sounds[0].loop must be a boolean",
    );
  });

  it("names the list that is missing", () => {
    expect(() => parseManifest({ ...valid, images: undefined })).toThrow(
      "manifest.images must be an array",
    );
    const { fonts, sounds, sprites } = valid;
    expect(() => parseManifest({ fonts, sounds, sprites })).toThrow("manifest.images is required");
  });

  it("names the entry and field that is missing", () => {
    const sprites = [{ key: "dog-koda", png: "sprites/dog-koda.png" }];
    expect(() => parseManifest({ ...valid, sprites })).toThrow(
      "manifest.sprites[0].json is required",
    );
  });

  it("rejects a key that is not kebab-case", () => {
    const images = [{ key: "Card_Frame", png: "images/card-frame.png" }];
    expect(() => parseManifest({ ...valid, images })).toThrow(
      'manifest.images[0].key "Card_Frame" must be kebab-case',
    );
  });

  it("rejects a key used twice across lists, naming both lists", () => {
    const images = [{ key: "dog-koda", png: "images/dog-koda.png" }];
    expect(() => parseManifest({ ...valid, images })).toThrow(
      'manifest key "dog-koda" appears more than once, in images[0] and sprites[0]',
    );
  });

  it("rejects a manifest that is null or an array", () => {
    expect(() => parseManifest(null)).toThrow("manifest must be an object");
    expect(() => parseManifest([])).toThrow("manifest must be an object");
  });

  it("rejects a list that is not an array", () => {
    expect(() => parseManifest({ ...valid, fonts: {} })).toThrow("manifest.fonts must be an array");
  });

  it("rejects a null entry", () => {
    expect(() => parseManifest({ ...valid, images: [null] })).toThrow(
      "manifest.images[0] must be an object",
    );
  });

  it("rejects an empty field", () => {
    const images = [{ key: "card-frame", png: "" }];
    expect(() => parseManifest({ ...valid, images })).toThrow(
      "manifest.images[0].png must be a non-empty string",
    );
  });

  it.each([
    ["/images/card-frame.png", "must be relative, without a leading slash"],
    ["https://example.com/card-frame.png", "must be relative, without a scheme"],
    ["../card-frame.png", "must not have a .. segment"],
    ["images/../../card-frame.png", "must not have a .. segment"],
  ])("rejects the path %s", (png, message) => {
    const images = [{ key: "card-frame", png }];
    expect(() => parseManifest({ ...valid, images })).toThrow(`manifest.images[0].png ${message}`);
  });

  it("accepts a path with a dot segment and dotted file names", () => {
    const images = [{ key: "card-frame", png: "./images/card.frame.png" }];
    expect(parseManifest({ ...valid, images }).images).toEqual(images);
  });
});

describe("the shipped art", () => {
  it("parses public/art/manifest.json", () => {
    expect(parseManifest(shippedManifest).sprites.length).toBeGreaterThan(0);
  });
});

describe("assetUrl", () => {
  it("joins the base and path with one slash", () => {
    expect(assetUrl("/art/", "/sprites/dog-koda.png")).toBe("/art/sprites/dog-koda.png");
    expect(assetUrl("/art", "sprites/dog-koda.png")).toBe("/art/sprites/dog-koda.png");
  });
});
