import type { TextFitStyle } from "../ui/textFit";
import { gameGlyphs } from "./fontInk";

// A line's width in screen pixels in the body font at scale: the sum of its glyphs' advances,
// as Phaser measures a label's width, from the font's .fnt and its pill glyphs.
export function bodyTextWidth(scale: number, line: string): number {
  const glyphs = gameGlyphs("font-body");
  return scale * [...line].reduce((sum, char) => sum + (glyphs.get(char)?.advance ?? 0), 0);
}

// A run of text's width in screen pixels in the body font at a style, as Phaser measures a
// label's width: its glyphs' advances and the style's letterSpacing between each pair.
export function bodyRunWidth(style: TextFitStyle, run: string): number {
  const gaps = Math.max(0, [...run].length - 1);
  return bodyTextWidth(style.scale, run) + style.letterSpacing * gaps * style.scale;
}
