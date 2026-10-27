import type { GameObjects, Scene } from "phaser";
import { describe, expect, it } from "vitest";

import { fontInk, laidChars, phaserFontData } from "../../testing/fontInk";
import { inPill, laidPills } from "../namePills";
import { addPixelText, type FontRole, labelPills } from "./pixelText";

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

describe("labelPills", () => {
  it("places a pill on its line, in the label's parent, by the label's origin and scale", () => {
    const second = `${inPill(1, "Hi")} x`;
    const laid = [
      { char: "a", ink: { left: 0, right: 4 }, line: 0 },
      ...laidChars("font-body", { letterSpacing: 0, scale: 1 }, second).map((char) => ({
        ...char,
        line: 1,
      })),
    ];
    // As Phaser lays the label out: line tops a line height apart, the line break not drawn.
    const characters = laid.map(({ char, ink, line }, i) => ({
      char,
      i,
      line,
      t: line * 10,
      w: ink === null ? 0 : ink.right - ink.left,
      x: ink?.left ?? 0,
    }));
    const label = {
      displayOriginX: 4,
      displayOriginY: 0,
      getTextBounds: () => ({ characters }),
      scaleX: 2,
      scaleY: 2,
      x: 100,
      y: 50,
    } as unknown as GameObjects.BitmapText;
    const [pill] = laidPills(1, laid);
    expect(labelPills(label)).toEqual([
      {
        index: 1,
        name: [2, 3],
        rect: {
          height: 22,
          width: ((pill?.right ?? 0) - (pill?.left ?? 0)) * 2,
          x: 100 + ((pill?.left ?? 0) - 4) * 2,
          y: 50 + (10 - 1) * 2,
        },
      },
    ]);
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
