import { readFileSync } from "node:fs";

// The body font's advances, from its .fnt, for measuring a line of text as the game draws it.
const BODY_FNT = new URL("../../public/art/fonts/font-body.fnt", import.meta.url);
const BODY_ADVANCES = new Map(
  [...readFileSync(BODY_FNT, "utf8").matchAll(/<char id="(\d+)"[^>]*\bxadvance="(\d+)"/g)].map(
    ([, id, advance]) => [String.fromCodePoint(Number(id)), Number(advance)],
  ),
);

// A line's width in screen pixels in the body font at scale.
export function bodyTextWidth(scale: number, line: string): number {
  return scale * [...line].reduce((sum, char) => sum + (BODY_ADVANCES.get(char) ?? 0), 0);
}

// The body font's line height in font pixels, from its .fnt: one line's box before scaling.
export const BODY_LINE_HEIGHT = Number(
  /<common[^>]*\blineHeight="(\d+)"/.exec(readFileSync(BODY_FNT, "utf8"))?.[1],
);
