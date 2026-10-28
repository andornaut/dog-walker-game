import { getOrInsertComputed } from "../lib/maps";
import { readBitmapFont } from "../tools/fontFile";
import { type BitmapFontFile, type FontMetrics, fontMetrics, leftBearing } from "../ui/fontMetrics";
import { inkWithPills, type LaidChar, pillGlyphAdvances } from "../ui/namePills";
import {
  type FittedText,
  fittingText,
  TEXT_FIT_STYLES,
  TEXT_SCALE,
  type TextFitStyle,
} from "../ui/textFit";

// The TEXT_FIT_STYLES at TEXT_SCALE: the sizes a list of names is built to keep, since the
// list shares one size and one name too wide at 2x sets them all at 1x.
export const TWO_X_FIT_STYLES: readonly TextFitStyle[] = TEXT_FIT_STYLES.filter(
  (style) => style.scale === TEXT_SCALE,
);

const GAME_GLYPHS = new Map<string, BitmapFontFile["glyphs"]>();

// A font's glyphs as the game holds them: its .fnt's, and a blank glyph for each pill character,
// a copy of its space with the pill's advance, as addPillGlyphs adds them.
export function gameGlyphs(font: string): BitmapFontFile["glyphs"] {
  return getOrInsertComputed(
    font,
    () => {
      const { glyphs } = readBitmapFont(font);
      const space = glyphs.get(" ");
      const pills =
        space === undefined
          ? []
          : [...pillGlyphAdvances(space.advance)].map(([char, advance]): [string, typeof space] => [
              char,
              { ...space, advance },
            ]);
      return new Map([...glyphs, ...pills]);
    },
    GAME_GLYPHS,
  );
}

// A font's rows, from its .fnt.
export function fontFileMetrics(font: string): FontMetrics {
  return fontMetrics(readBitmapFont(font));
}

// A font's .fnt as Phaser's bitmap font cache holds it: glyphs keyed by character code.
export function phaserFontData(font: string): {
  chars: Record<
    number,
    { height: number; width: number; xAdvance: number; xOffset: number; yOffset: number }
  >;
  lineHeight: number;
} {
  const { lineHeight } = readBitmapFont(font);
  const chars = Object.fromEntries(
    [...gameGlyphs(font)].map(([char, glyph]) => [
      char.codePointAt(0) ?? 0,
      { ...glyph, xAdvance: glyph.advance },
    ]),
  );
  return { chars, lineHeight };
}

// Each character of a line of text in a font at a style, with the screen columns it inks from
// the line's left edge, as Phaser lays it out: the pen moves by each glyph's advance, the pair's
// kerning and the style's letterSpacing, all in font pixels before the style's scale. A glyph
// that inks nothing, such as a space, inks no columns.
export function laidChars(font: string, style: TextFitStyle, text: string): LaidChar[] {
  const { kernings } = readBitmapFont(font);
  const glyphs = gameGlyphs(font);
  let x = 0;
  let previous = "";
  return [...text].map((char) => {
    const glyph = glyphs.get(char);
    if (glyph === undefined) {
      throw new Error(`${font} has no ${char}`);
    }
    x += kernings.get(previous + char) ?? 0;
    const span = { left: x + glyph.xOffset, right: x + glyph.xOffset + glyph.width };
    x += glyph.advance + style.letterSpacing;
    previous = char;
    const scaled = { left: span.left * style.scale, right: span.right * style.scale };
    return { char, ink: glyph.width === 0 ? null : scaled, line: 0 };
  });
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

// Text set in a font in the first of styles that fits room, as fitPixelText sets it, with the
// widest of its lines' ink.
export function fitInFont(
  font: string,
  styles: readonly TextFitStyle[],
  room: number,
  text: string,
): FittedText & { widest: number } {
  const width = (style: TextFitStyle, line: string) => inkWidth(font, style, line);
  const fitted = fittingText(styles, width, room, text);
  return { ...fitted, widest: Math.max(...fitted.lines.map((line) => width(fitted.style, line))) };
}
