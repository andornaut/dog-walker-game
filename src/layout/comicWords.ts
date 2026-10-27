import type { EncounterId } from "../data/types";
import type { Point } from "../lib/rect";

// Where the comic words, drawn in font-comic, sit on the effects they letter, in the effect
// frame's pixels from its top-left. A word's place is its ring's top-left.
export const COMIC_WORDS = {
  // WOOF! in place of fx-bark, in a 32x16 frame centred on the bark's point: one top per
  // step, each held for its ms.
  bark: { frame: { height: 16, width: 32 }, ms: [60, 60, 140, 140], tops: [4, 1, 2, 2], x: 0 },
  // An obstacle's word over its 77x77 burst on the burst's first frames: centred on column
  // centreX, its ring's top ringAboveStar rows above the impact star's centre row.
  burst: {
    centreX: 38,
    frames: 6,
    ringAboveStar: 5,
    // By encounter, as fx-hit-<encounter> draws its star.
    starRows: {
      capybara: 48,
      droppedCone: 48,
      fishCrates: 46,
      otherDog: 46,
      porchCat: 43,
      promoTeam: 43,
      skunk: 38,
      thief: 48,
      weddingShoot: 43,
    } as Readonly<Partial<Record<EncounterId, number>>>,
  },
  // DODGE! on fx-dodge's 48x48 frame, over its first frames.
  dodge: { frames: 4, x: 6, y: 0 },
} as const;

// A font-comic glyph's drawn width and how far it moves the next one along.
export interface ComicGlyph {
  readonly width: number;
  readonly xAdvance: number;
}

// The word's drawn width, ring and shadow included: its last glyph's width past the advances
// before it. undefined when the font lacks one of its characters.
export function comicWordWidth(
  glyph: (char: string) => ComicGlyph | undefined,
  word: string,
): number | undefined {
  let x = 0;
  let width = 0;
  for (const char of word) {
    const found = glyph(char);
    if (found === undefined) {
      return undefined;
    }
    width = Math.max(width, x + found.width);
    x += found.xAdvance;
  }
  return width;
}

// Rounds a value ending in .5 to the even neighbour, others to the nearest whole number.
function roundHalfEven(value: number): number {
  const floor = Math.floor(value);
  const rest = value - floor;
  if (rest !== 0.5) {
    return Math.round(value);
  }
  return floor % 2 === 0 ? floor : floor + 1;
}

// A burst word's top-left on the burst frame, from its drawn width and the star's centre row.
export function burstWordPlace(width: number, starRow: number): Point {
  const { centreX, ringAboveStar } = COMIC_WORDS.burst;
  return { x: roundHalfEven(centreX - width / 2), y: starRow - ringAboveStar };
}
