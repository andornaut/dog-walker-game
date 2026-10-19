import { describe, expect, it } from "vitest";

import { assetUrl, parseManifest } from "./manifest";

const valid = {
  fonts: [{ fnt: "fonts/pixel.fnt", key: "pixel", png: "fonts/pixel.png" }],
  images: [{ key: "card-frame", png: "images/card-frame.png" }],
  sprites: [{ json: "sprites/dog-koda.json", key: "dog-koda", png: "sprites/dog-koda.png" }],
};

describe("parseManifest", () => {
  it("accepts a well-formed manifest", () => {
    expect(parseManifest(valid)).toEqual(valid);
  });

  it("accepts empty lists", () => {
    expect(parseManifest({ fonts: [], images: [], sprites: [] }).sprites).toEqual([]);
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
