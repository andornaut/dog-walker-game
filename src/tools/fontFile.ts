import { readFileSync } from "node:fs";

import { getOrInsertComputed } from "@andornaut/game-kit/maps";
import { type BitmapFont, parseBitmapFont } from "@andornaut/game-kit/text/bitmapFont";

const FONTS = new Map<string, BitmapFont>();

// A font's .fnt, as the game loads it from public/art/fonts/.
export function readBitmapFont(font: string): BitmapFont {
  return getOrInsertComputed(
    font,
    () => {
      const fnt = new URL(`../../public/art/fonts/${font}.fnt`, import.meta.url);
      return parseBitmapFont(readFileSync(fnt, "utf8"));
    },
    FONTS,
  );
}
