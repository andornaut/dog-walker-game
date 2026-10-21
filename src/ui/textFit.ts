import { wrapWords } from "../lib/lines";

// A label's scale, the font pixels added between its glyphs, and how many lines it may wrap
// onto (1 when unset). letterSpacing is in font pixels, before the scale, so letterSpacing
// times scale is a whole number of screen pixels, keeping the glyphs on the pixel grid.
export interface TextFitStyle {
  letterSpacing: number;
  lines?: number;
  scale: number;
}

// Text that may not fit its room at 2x tries 2x with its glyphs a screen pixel closer, then 1x.
// The body and title fonts leave a font pixel between glyphs, two screen pixels at 2x, so a
// screen pixel closer keeps one between them.
export const TEXT_FIT_STYLES: readonly TextFitStyle[] = [
  { letterSpacing: 0, scale: 2 },
  { letterSpacing: -0.5, scale: 2 },
  { letterSpacing: 0, scale: 1 },
];

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

// The first style that sets text in at most its lines, broken at spaces, each line's ink no
// wider than room as inkWidth measures it; else the last style on one line.
export function fittingText(
  styles: readonly TextFitStyle[],
  inkWidth: (style: TextFitStyle, line: string) => number,
  room: number,
  text: string,
): FittedText {
  for (const style of styles) {
    const most = style.lines ?? 1;
    const lines = most === 1 ? [text] : wrapWords((line) => inkWidth(style, line), room, text);
    if (lines.length <= most && lines.every((line) => inkWidth(style, line) <= room)) {
      return { lines, style };
    }
  }
  return { lines: [text], style: styles.at(-1) as TextFitStyle };
}
