import { wrapWords } from "../lib/lines";

// A label's scale, the font pixels added between its glyphs, and how many lines it may wrap
// onto (1 when unset). letterSpacing is in font pixels, before the scale, so letterSpacing
// times scale is a whole number of screen pixels, keeping the glyphs on the pixel grid.
export interface TextFitStyle {
  letterSpacing: number;
  lines?: number;
  scale: number;
}

// The scale menu and HUD text draws at.
export const TEXT_SCALE = 2;

// Text that may not fit its room at 2x tries 2x with its glyphs a screen pixel closer, then 1x.
// The body and title fonts leave a font pixel between glyphs, two screen pixels at 2x, so a
// screen pixel closer keeps one between them.
export const TEXT_FIT_STYLES: readonly TextFitStyle[] = [
  { letterSpacing: 0, scale: 2 },
  { letterSpacing: -0.5, scale: 2 },
  { letterSpacing: 0, scale: 1 },
];

// TEXT_FIT_STYLES, each wrapping onto up to lines lines.
export function textFitStylesOnLines(lines: number): TextFitStyle[] {
  return TEXT_FIT_STYLES.map((style) => ({ ...style, lines }));
}

// TEXT_FIT_STYLES with two lines at 2x tried before 1x, for text in a box that can grow a line.
export const WRAPPING_TEXT_FIT_STYLES: readonly TextFitStyle[] = [
  { letterSpacing: 0, scale: 2 },
  { letterSpacing: -0.5, scale: 2 },
  { letterSpacing: 0, lines: 2, scale: 2 },
  { letterSpacing: 0, scale: 1 },
];

// Text set in a style, broken into its lines.
export interface FittedText {
  lines: string[];
  style: TextFitStyle;
}

// Whether fitted keeps to its style's lines, each line's ink no wider than room as inkWidth
// measures it.
export function fitsRoom(
  inkWidth: (style: TextFitStyle, line: string) => number,
  room: number,
  fitted: FittedText,
): boolean {
  const { lines, style } = fitted;
  return lines.length <= (style.lines ?? 1) && lines.every((line) => inkWidth(style, line) <= room);
}

// The first style that sets text in at most its lines, each paragraph (split at "\n") starting a
// line and broken at spaces, each line's ink no wider than room as inkWidth measures it; else
// the last style, a line per paragraph.
export function fittingText(
  styles: readonly TextFitStyle[],
  inkWidth: (style: TextFitStyle, line: string) => number,
  room: number,
  text: string,
): FittedText {
  const paragraphs = text.split("\n");
  for (const style of styles) {
    const most = style.lines ?? 1;
    const lines = paragraphs.flatMap((paragraph) =>
      most === 1 ? [paragraph] : wrapWords((line) => inkWidth(style, line), room, paragraph),
    );
    if (fitsRoom(inkWidth, room, { lines, style })) {
      return { lines, style };
    }
  }
  return { lines: paragraphs, style: styles.at(-1) as TextFitStyle };
}
