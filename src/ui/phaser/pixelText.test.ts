import type { Scene } from "phaser";
import { describe, expect, it } from "vitest";

import { fontInk, phaserFontData } from "../../testing/fontInk";
import { addPixelText, type FontRole } from "./pixelText";

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

describe("addPixelText", () => {
  it.each(FIRSTS.flatMap((first) => [1, 2].map((scale) => ({ scale, text: `${first}ow` }))))(
    "starts left-aligned title and body $text's ink in one column at scale $scale",
    ({ scale, text }) => {
      const { drawn, scene } = fakeScene();
      const x = 12;
      const style = { letterSpacing: 0, scale };
      const inkLeft = (["title", "body"] as const).map((font) => {
        addPixelText(scene, x, 0, text, { color: 0, font, scale });
        const shown = font === "title" ? text.toUpperCase() : text;
        return (drawn.at(-1)?.x ?? 0) + fontInk(FONTS[font], style, shown).left;
      });
      expect(inkLeft).toEqual([x, x]);
    },
  );
});
