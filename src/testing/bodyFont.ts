import { readBitmapFont } from "../tools/fontFile";

// A line's width in screen pixels in the body font at scale: the sum of its glyphs' advances,
// as Phaser measures a label's width, from the font's .fnt.
export function bodyTextWidth(scale: number, line: string): number {
  const { glyphs } = readBitmapFont("font-body");
  return scale * [...line].reduce((sum, char) => sum + (glyphs.get(char)?.advance ?? 0), 0);
}
