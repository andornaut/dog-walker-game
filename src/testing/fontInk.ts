import { type FittedText, fittingText, type TextFitStyle } from "../layout/textFit";
import { readBitmapFont } from "../tools/fontFile";
import { type FontMetrics, fontMetrics } from "../ui/fontMetrics";

// A font's rows, from its .fnt.
export function fontFileMetrics(font: string): FontMetrics {
  return fontMetrics(readBitmapFont(font));
}

// The screen columns each inked glyph of text covers in a font at a style, from the text's
// left edge, as Phaser lays it out: the pen moves by each glyph's advance, the pair's kerning
// and the style's letterSpacing, all in font pixels before the style's scale. A glyph that inks
// nothing, such as a space, is left out.
function glyphSpans(
  font: string,
  style: TextFitStyle,
  text: string,
): { left: number; right: number }[] {
  const { glyphs, kernings } = readBitmapFont(font);
  let x = 0;
  let previous = "";
  return [...text].flatMap((char) => {
    const glyph = glyphs.get(char);
    if (glyph === undefined) {
      throw new Error(`${font} has no ${char}`);
    }
    x += kernings.get(previous + char) ?? 0;
    const span = { left: x + glyph.xOffset, right: x + glyph.xOffset + glyph.width };
    x += glyph.advance + style.letterSpacing;
    previous = char;
    const scaled = { left: span.left * style.scale, right: span.right * style.scale };
    return glyph.width === 0 ? [] : [scaled];
  });
}

// The screen columns text inks in a font at a style, from its left edge.
export function fontInk(
  font: string,
  style: TextFitStyle,
  text: string,
): { left: number; right: number } {
  const spans = glyphSpans(font, style, text);
  if (spans.length === 0) {
    return { left: 0, right: 0 };
  }
  return {
    left: Math.min(...spans.map((span) => span.left)),
    right: Math.max(...spans.map((span) => span.right)),
  };
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
