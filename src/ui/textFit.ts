// A label's scale and the font pixels added between its glyphs.
export interface TextFitStyle {
  letterSpacing: number;
  scale: number;
}

// Text that may not fit its room at 2x tries 2x with its glyphs a font pixel closer, then 1x.
export const TEXT_FIT_STYLES: readonly TextFitStyle[] = [
  { letterSpacing: 0, scale: 2 },
  { letterSpacing: -1, scale: 2 },
  { letterSpacing: 0, scale: 1 },
];

// The first style whose ink, measured by inkWidth, is no wider than room; the last when none is.
export function fittingTextStyle(
  styles: readonly TextFitStyle[],
  inkWidth: (style: TextFitStyle) => number,
  room: number,
): TextFitStyle {
  return styles.find((style) => inkWidth(style) <= room) ?? (styles.at(-1) as TextFitStyle);
}
