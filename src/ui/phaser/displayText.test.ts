import type { Scene } from "phaser";
import { describe, expect, it } from "vitest";

import { addDisplayText } from "./displayText";

interface Drawn {
  font: string;
  text: string;
  tint: number | undefined;
  y: number;
}

// A scene whose cache holds the named fonts, each with glyphs for the given characters, and
// which records the one label drawn.
function fakeScene(fonts: Readonly<Record<string, string>>): { drawn: Drawn[]; scene: Scene } {
  const drawn: Drawn[] = [];
  const glyphs = (chars: string) =>
    Object.fromEntries([...chars].map((char) => [char.codePointAt(0), {}]));
  const scene = {
    add: {
      bitmapText: (_x: number, y: number, font: string, text: string) => {
        const entry: Drawn = { font, text, tint: undefined, y };
        drawn.push(entry);
        const label = {
          setData: () => label,
          setOrigin: () => label,
          setScale: () => label,
          setTint: (tint: number) => {
            entry.tint = tint;
            return label;
          },
        };
        return label;
      },
    },
    cache: {
      bitmapFont: {
        exists: (key: string) => key in fonts,
        // Each font's capitals start 4 rows into its line, as font-title's do.
        get: (key: string) => ({
          data: {
            chars: { ...glyphs(fonts[key] ?? ""), [72]: { height: 5, yOffset: 4 } },
            lineHeight: 12,
          },
        }),
      },
    },
  };
  return { drawn, scene: scene as unknown as Scene };
}

const DISPLAY_GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!?,.'-$+♥";

describe("addDisplayText", () => {
  it("draws upper case in the display font, else in the tinted title font", () => {
    for (const { expected, fonts } of [
      {
        expected: { font: "font-display", text: "WHICH WAY?", tint: undefined, y: 7 },
        fonts: { "font-display": DISPLAY_GLYPHS, "font-title": "" },
        name: "draws upper case, untinted, in the display font",
      },
      {
        expected: { font: "font-title", text: "WHICH WAY?", tint: 0x123456, y: 2 },
        fonts: { "font-title": "" },
        name: "falls back to the title font while the display font is missing",
      },
      {
        expected: { font: "font-title", text: "WHICH WAY?", tint: 0x123456, y: 2 },
        fonts: { "font-display": "ABC", "font-title": "" },
        name: "falls back when the display font lacks a character",
      },
    ]) {
      const { drawn, scene } = fakeScene(fonts);
      addDisplayText(scene, 0, 10, "Which way?", { colour: 0x123456, font: "title", scale: 2 });
      expect(drawn).toEqual([expected]);
    }
  });
});
