import { describe, expect, it } from "vitest";

import { itemAt } from "../lib/arrays";
import { defined } from "../testing/defined";
import {
  glyphAdvance,
  normalizePixelText,
  PIXEL_GLYPHS,
  pixelFontAtlas,
  plainMarks,
} from "./pixelFont";

describe("PIXEL_GLYPHS", () => {
  it("gives every glyph one bit per pixel of a box of whole columns", () => {
    for (const { bits, char, width } of PIXEL_GLYPHS) {
      expect(bits, char).toMatch(/^[01]+$/);
      expect(Number.isInteger(width), char).toBe(true);
    }
  });

  it("covers every character the cards and money need", () => {
    const chars = new Set(PIXEL_GLYPHS.map(({ char }) => char));
    for (const char of "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789$+-.,:!?'()/♥") {
      expect(chars.has(char), char).toBe(true);
    }
  });
});

describe("plainMarks", () => {
  it("makes typographic marks plain ASCII and keeps the case", () => {
    expect(plainMarks("−1 ♥ “each” × 2, don’t")).toBe('-1 ♥ "each" x 2, don\'t');
  });
});

describe("normalizePixelText", () => {
  it("draws capitals and plain marks", () => {
    expect(normalizePixelText("−$10 per dog’s × 2")).toBe("-$10 PER DOG'S X 2");
  });
});

describe("glyphAdvance", () => {
  it("is the glyph's width plus a pixel of space", () => {
    expect(glyphAdvance("A")).toBe(4);
    expect(glyphAdvance("♥")).toBe(6);
  });

  it("treats a space, or a character the font lacks, as 3 wide", () => {
    expect(glyphAdvance(" ")).toBe(4);
    expect(glyphAdvance("@")).toBe(4);
  });
});

describe("pixelFontAtlas", () => {
  const atlas = pixelFontAtlas();

  it("places glyphs left to right with a clear column between each pair", () => {
    atlas.glyphs.slice(1).forEach((glyph, i) => {
      const previous = itemAt(atlas.glyphs, i);
      expect(glyph.x).toBe(previous.x + previous.width + 1);
    });
    const last = defined(atlas.glyphs.at(-1));
    expect(atlas.width).toBe(last.x + last.width + 1);
  });

  it("keeps every lit pixel inside its glyph's box", () => {
    for (const { pixels, width } of atlas.glyphs) {
      for (const [x, y] of pixels) {
        expect(x).toBeLessThan(width);
        expect(y).toBeLessThan(atlas.height);
      }
    }
  });

  it("lights the pixels the bits say", () => {
    const minus = defined(atlas.glyphs.find(({ char }) => char === "-"));
    expect(minus.pixels).toEqual([
      [0, 2],
      [1, 2],
      [2, 2],
    ]);
  });
});
