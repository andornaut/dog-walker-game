import { describe, expect, it } from "vitest";

import { itemAt } from "../lib/arrays";
import { defined } from "../testing/defined";
import { normalizePixelText, PIXEL_GLYPHS, pixelFontAtlas, plainMarks } from "./pixelFont";

describe("PIXEL_GLYPHS", () => {
  it("gives every glyph whole columns of bits, and covers every character the cards and money need", () => {
    const bad = PIXEL_GLYPHS.filter(
      ({ bits, width }) => !/^[01]+$/.test(bits) || !Number.isInteger(width),
    );
    expect(bad.map(({ char }) => char)).toEqual([]);
    const chars = new Set(PIXEL_GLYPHS.map(({ char }) => char));
    const missing = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789$+-.,:!?'()/♥"].filter(
      (char) => !chars.has(char),
    );
    expect(missing).toEqual([]);
  });
});

describe("plainMarks and normalizePixelText", () => {
  it("make typographic marks plain ASCII, the pixel text in capitals", () => {
    expect(plainMarks("−1 ♥ “each” × 2, don’t")).toBe('-1 ♥ "each" x 2, don\'t');
    expect(normalizePixelText("−$10 per dog’s × 2")).toBe("-$10 PER DOG'S X 2");
  });
});

describe("pixelFontAtlas", () => {
  it("places glyphs left to right a column apart, each lit pixel inside its box as the bits say", () => {
    const atlas = pixelFontAtlas();
    atlas.glyphs.slice(1).forEach((glyph, i) => {
      const previous = itemAt(atlas.glyphs, i);
      expect(glyph.x).toBe(previous.x + previous.width + 1);
    });
    const last = defined(atlas.glyphs.at(-1));
    expect(atlas.width).toBe(last.x + last.width + 1);
    const outside = atlas.glyphs.filter(({ pixels, width }) =>
      pixels.some(([x, y]) => x >= width || y >= atlas.height),
    );
    expect(outside.map(({ char }) => char)).toEqual([]);
    const minus = defined(atlas.glyphs.find(({ char }) => char === "-"));
    expect(minus.pixels).toEqual([
      [0, 2],
      [1, 2],
      [2, 2],
    ]);
  });
});
