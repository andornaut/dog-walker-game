import type { GameObjects, Scene } from "phaser";
import { describe, expect, it } from "vitest";

import { fontInk, phaserFontData } from "../../testing/fontInk";
import { addPixelText, type FontRole, tintSpans } from "./pixelText";

const FONTS: Readonly<Record<FontRole, string>> = { body: "font-body", title: "font-title" };

// A scene whose cache holds the game's fonts as Phaser parses them, and which records where each
// label is drawn.
function fakeScene(): { drawn: { x: number }[]; scene: Scene } {
  const drawn: { x: number }[] = [];
  const scene = {
    add: {
      bitmapText: (x: number) => {
        drawn.push({ x });
        const label = {
          setData: () => label,
          setOrigin: () => label,
          setScale: () => label,
          setTint: () => label,
        };
        return label;
      },
    },
    cache: {
      bitmapFont: {
        exists: (key: string) => Object.values(FONTS).includes(key),
        get: (key: string) => ({ data: phaserFontData(key) }),
      },
    },
  };
  return { drawn, scene: scene as unknown as Scene };
}

// A word starting with each capital and digit, and with "$" and "+" for amounts.
const FIRSTS = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789$+"];

// A label showing text that records the colour each drawn character is tinted, by Phaser's
// index among the characters it draws, which skips line breaks.
function tintedLabel(text: string): { label: GameObjects.BitmapText; tints: Map<number, number> } {
  const tints = new Map<number, number>();
  const drawn = text
    .split("")
    .map((char, idx) => ({ char, idx }))
    .filter(({ char }) => char !== "\n")
    .map(({ idx }, i) => ({ i, idx }));
  const label = {
    getTextBounds: () => ({ characters: drawn }),
    setCharacterTint: (start: number, _length: number, _mode?: number, colour?: number) => {
      if (colour === undefined) {
        tints.clear();
      } else {
        tints.set(start, colour);
      }
      return label;
    },
    text,
  };
  return { label: label as unknown as GameObjects.BitmapText, tints };
}

describe("tintSpans", () => {
  it("tints the span's characters on each label they wrapped onto, after its line breaks", () => {
    const source = "Big tipper: tips pay double";
    const first = tintedLabel("Big\ntipper:");
    const second = tintedLabel("tips pay\ndouble");
    tintSpans([first.label, second.label], source, [{ at: 4, colour: 7, length: 6 }]);
    // "tipper" is drawn from the fourth character, the line break not drawn.
    expect([...first.tints]).toEqual([3, 4, 5, 6, 7, 8].map((i) => [i, 7]));
    expect(second.tints.size).toBe(0);
  });
});

describe("addPixelText", () => {
  it.each(FIRSTS.flatMap((first) => [1, 2].map((scale) => ({ scale, text: `${first}ow` }))))(
    "starts left-aligned title and body $text's ink in one column at scale $scale",
    ({ scale, text }) => {
      const { drawn, scene } = fakeScene();
      const x = 12;
      const style = { letterSpacing: 0, scale };
      const inkLeft = (["title", "body"] as const).map((font) => {
        addPixelText(scene, x, 0, text, { colour: 0, font, scale });
        const shown = font === "title" ? text.toUpperCase() : text;
        return (drawn.at(-1)?.x ?? 0) + fontInk(FONTS[font], style, shown).left;
      });
      expect(inkLeft).toEqual([x, x]);
    },
  );
});
