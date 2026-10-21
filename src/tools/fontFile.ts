import { readFileSync } from "node:fs";

import { type BitmapFontFile, parseBitmapFont } from "../ui/fontMetrics";

const FONTS = new Map<string, BitmapFontFile>();

// A font's .fnt, as the game loads it from public/art/fonts/.
export function readBitmapFont(font: string): BitmapFontFile {
  const known = FONTS.get(font);
  if (known !== undefined) {
    return known;
  }
  const fnt = new URL(`../../public/art/fonts/${font}.fnt`, import.meta.url);
  const parsed = parseBitmapFont(readFileSync(fnt, "utf8"));
  FONTS.set(font, parsed);
  return parsed;
}
