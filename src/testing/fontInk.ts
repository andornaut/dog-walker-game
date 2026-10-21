import { readFileSync } from "node:fs";

import type { TextFitStyle } from "../layout/textFit";

interface Glyph {
  readonly advance: number;
  readonly width: number;
  readonly xOffset: number;
}

const FONTS = new Map<string, ReadonlyMap<string, Glyph>>();

// A font's glyphs, from its .fnt: each one's left side bearing, inked width and advance.
function fontGlyphs(font: string): ReadonlyMap<string, Glyph> {
  const known = FONTS.get(font);
  if (known !== undefined) {
    return known;
  }
  const fnt = new URL(`../../public/art/fonts/${font}.fnt`, import.meta.url);
  const glyphs = new Map(
    [
      ...readFileSync(fnt, "utf8").matchAll(
        /<char id="(\d+)"[^>]*\bwidth="(\d+)"[^>]*\bxoffset="(-?\d+)"[^>]*\bxadvance="(\d+)"/g,
      ),
    ].map(([, id, width, xOffset, advance]) => [
      String.fromCodePoint(Number(id)),
      { advance: Number(advance), width: Number(width), xOffset: Number(xOffset) },
    ]),
  );
  FONTS.set(font, glyphs);
  return glyphs;
}

// The screen columns text inks in a font at a style, from its left edge, as Phaser lays it
// out; a glyph that inks nothing, such as a space, is left out.
export function fontInk(
  font: string,
  style: TextFitStyle,
  text: string,
): { left: number; right: number } {
  const glyphs = fontGlyphs(font);
  let x = 0;
  const spans = [...text].flatMap((char) => {
    const glyph = glyphs.get(char);
    if (glyph === undefined) {
      throw new Error(`${font} has no ${char}`);
    }
    const span = { left: x + glyph.xOffset, right: x + glyph.xOffset + glyph.width };
    x += glyph.advance + style.letterSpacing;
    return glyph.width === 0 ? [] : [span];
  });
  const left = Math.min(...spans.map((span) => span.left));
  const right = Math.max(...spans.map((span) => span.right));
  return { left: left * style.scale, right: right * style.scale };
}
