import { readFileSync } from "node:fs";

import { getOrInsertComputed } from "../lib/maps";
import { type BitmapFontFile, parseBitmapFont } from "../ui/fontMetrics";

const FONTS = new Map<string, BitmapFontFile>();

// A font's .fnt, as the game loads it from public/art/fonts/.
export function readBitmapFont(font: string): BitmapFontFile {
  return getOrInsertComputed(
    font,
    () => {
      const fnt = new URL(`../../public/art/fonts/${font}.fnt`, import.meta.url);
      return parseBitmapFont(readFileSync(fnt, "utf8"));
    },
    FONTS,
  );
}
