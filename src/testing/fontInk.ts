import { getOrInsertComputed } from "@andornaut/game-kit/maps";
import {
  type BitmapFont,
  type FontMetrics,
  fontMetrics,
  laidGlyphs,
  leftBearing,
} from "@andornaut/game-kit/text/bitmapFont";
import {
  type FittedText,
  fittingText,
  type TextFitStyle,
  widestLine,
} from "@andornaut/game-kit/text/textFit";

import { readBitmapFont } from "../tools/fontFile";
import { inkWithPills, type LaidChar, pillGlyphAdvances } from "../ui/namePills";

const GAME_FONTS = new Map<string, BitmapFont>();

// A font as the game holds it: its .fnt's, and a blank glyph for each pill character, a copy of
// its space with the pill's advance, as addPillGlyphs adds them.
export function gameFont(font: string): BitmapFont {
  return getOrInsertComputed(
    font,
    () => {
      const file = readBitmapFont(font);
      const space = file.glyphs.get(" ");
      const pills =
        space === undefined
          ? []
          : [...pillGlyphAdvances(space.advance)].map(([char, advance]): [string, typeof space] => [
              char,
              { ...space, advance },
            ]);
      return { ...file, glyphs: new Map([...file.glyphs, ...pills]) };
    },
    GAME_FONTS,
  );
}

// A font's glyphs as the game holds them (gameFont).
export function gameGlyphs(font: string): BitmapFont["glyphs"] {
  return gameFont(font).glyphs;
}

// A font's rows, from its .fnt.
export function fontFileMetrics(font: string): FontMetrics {
  return fontMetrics(readBitmapFont(font));
}

// A font's .fnt as Phaser's bitmap font cache holds it: glyphs keyed by character code, each
// with its kerning keyed by the code of the character before it (PhaserFontData in the kit's
// text/phaser/phaserBitmapFont).
export function phaserFontData(font: string) {
  const { kernings, lineHeight } = readBitmapFont(font);
  const code = (char: string) => char.codePointAt(0) ?? 0;
  const chars = Object.fromEntries(
    [...gameGlyphs(font)].map(([char, glyph]) => {
      const kerning = Object.fromEntries(
        [...kernings].flatMap(([pair, amount]) => {
          const [first = "", second] = [...pair];
          return second === char ? [[code(first), amount]] : [];
        }),
      );
      return [code(char), { ...glyph, kerning, xAdvance: glyph.advance }];
    }),
  );
  return { chars, lineHeight };
}

// Each character of a line of text in a font at a style, with the screen columns it inks from
// the line's left edge, as Phaser lays it out (laidGlyphs). Throws on a character the font lacks.
export function laidChars(font: string, style: TextFitStyle, text: string): LaidChar[] {
  const game = gameFont(font);
  const missing = [...text].find((char) => !game.glyphs.has(char));
  if (missing !== undefined) {
    throw new Error(`${font} has no ${missing}`);
  }
  return laidGlyphs(game, style.scale, text).map((glyph) => ({ ...glyph, line: 0 }));
}

// The screen columns each inked glyph of text covers (laidChars).
function glyphSpans(
  font: string,
  style: TextFitStyle,
  text: string,
): { left: number; right: number }[] {
  return laidChars(font, style, text).flatMap((char) => char.ink ?? []);
}

// The screen columns text inks in a font at a style, its name pills' included, from its left
// edge.
export function fontInk(
  font: string,
  style: TextFitStyle,
  text: string,
): { left: number; right: number } {
  return inkWithPills(style.scale, laidChars(font, style, text)) ?? { left: 0, right: 0 };
}

// The screen rows text inks in a font at a style, from the top of its capitals: top is its
// first inked row and bottom the row past its last.
export function fontInkRows(
  font: string,
  style: TextFitStyle,
  text: string,
): { bottom: number; top: number } {
  const { capTop } = fontFileMetrics(font);
  const glyphs = gameGlyphs(font);
  const inked = [...text].flatMap((char) => {
    const glyph = glyphs.get(char);
    return glyph === undefined || glyph.height === 0 ? [] : [glyph];
  });
  const top = Math.min(...inked.map((glyph) => glyph.yOffset));
  const bottom = Math.max(...inked.map((glyph) => glyph.yOffset + glyph.height));
  return inked.length === 0
    ? { bottom: 0, top: 0 }
    : { bottom: (bottom - capTop) * style.scale, top: (top - capTop) * style.scale };
}

// The screen columns text inks in a font at a style from the x addPixelText places a
// left-aligned label at: font-title's label sits left by its first glyph's left side bearing.
export function placedInk(
  font: string,
  style: TextFitStyle,
  text: string,
): { left: number; right: number } {
  const ink = fontInk(font, style, text);
  const { glyphs } = readBitmapFont(font);
  const shift = font === "font-title" ? leftBearing((char) => glyphs.get(char), text) : 0;
  return { left: ink.left - shift * style.scale, right: ink.right - shift * style.scale };
}

// The width of the columns text inks in a font at a style.
export function inkWidth(font: string, style: TextFitStyle, text: string): number {
  const ink = fontInk(font, style, text);
  return ink.right - ink.left;
}

// The narrowest gap in screen pixels between one inked glyph's last column and the next one's
// first, or Infinity for text with fewer than two inked glyphs. Below 1, they touch or overlap.
export function narrowestGlyphGap(font: string, style: TextFitStyle, text: string): number {
  const spans = glyphSpans(font, style, text);
  return Math.min(Infinity, ...spans.slice(1).map((span, i) => span.left - (spans[i]?.right ?? 0)));
}

// Text set in a font in style within room, as fitPixelText sets it, with the widest of its
// lines' ink.
export function fitInFont(
  font: string,
  style: TextFitStyle,
  room: number,
  text: string,
): FittedText & { widest: number } {
  const width = (at: TextFitStyle, line: string) => inkWidth(font, at, line);
  const fitted = fittingText(style, width, room, text);
  return { ...fitted, widest: widestLine(width, fitted) };
}
