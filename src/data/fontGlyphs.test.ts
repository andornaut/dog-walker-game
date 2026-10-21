import { describe, expect, it } from "vitest";

import bodyFont from "../../public/art/fonts/font-body.fnt?raw";
import titleFont from "../../public/art/fonts/font-title.fnt?raw";
import { plainMarks } from "../text/pixelFont";
import { gameData } from "./index";

// The characters a bitmap font file has a glyph for.
function fontChars(fnt: string): Set<string> {
  const ids = [...fnt.matchAll(/<char id="(\d+)"/g)].map((match) => Number(match[1]));
  return new Set(ids.map((id) => String.fromCodePoint(id)));
}

// Every string in the game data, with where it is.
function strings(value: unknown, path: string): [string, string][] {
  if (typeof value === "string") {
    return [[path, value]];
  }
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => strings(entry, `${path}[${index}]`));
  }
  if (typeof value === "object" && value !== null) {
    return Object.entries(value).flatMap(([key, entry]) => strings(entry, `${path}.${key}`));
  }
  return [];
}

// Text is drawn in either font, the title font in capitals, after the typographic marks that
// pixelFont.ts maps are made plain.
const FONTS = [
  ["font-body", fontChars(bodyFont), (text: string) => plainMarks(text)],
  ["font-title", fontChars(titleFont), (text: string) => plainMarks(text).toUpperCase()],
] as const;

describe("the text data", () => {
  const lines = strings(gameData, "gameData");

  it("has text to check", () => {
    expect(lines.length).toBeGreaterThan(100);
  });

  it.each(FONTS)("uses only characters %s can draw", (_, chars, drawn) => {
    const missing = lines.flatMap(([path, text]) =>
      [...drawn(text)].filter((char) => !chars.has(char)).map((char) => `${path}: ${char}`),
    );
    expect(missing).toEqual([]);
  });
});
