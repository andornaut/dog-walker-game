import { describe, expect, it } from "vitest";

import comicFont from "../../public/art/fonts/font-comic.fnt?raw";
import shippedManifest from "../../public/art/manifest.json";
import { kebabCase } from "../assets/spriteKeys";
import { gameData } from "../data";
import type { EncounterId } from "../data/types";
import { hitWord } from "../rules/encounters";
import { burstWordPlace, COMIC_WORDS, type ComicGlyph, comicWordWidth } from "./comicWords";

// font-comic's glyphs by character, read from its .fnt.
const glyphs = new Map(
  [...comicFont.matchAll(/<char id="(\d+)"[^>]*\bwidth="(\d+)"[^>]*\bxadvance="(\d+)"/g)].map(
    ([, id, width, xAdvance]): [string, ComicGlyph] => [
      String.fromCodePoint(Number(id)),
      { width: Number(width), xAdvance: Number(xAdvance) },
    ],
  ),
);
const widthOf = (word: string) => comicWordWidth((char) => glyphs.get(char), word);
const LINE_HEIGHT = Number(/lineHeight="(\d+)"/.exec(comicFont)?.[1]);

const sprites = new Set(shippedManifest.sprites.map(({ key }) => key));
const bursts = (Object.keys(gameData.encounters) as EncounterId[]).filter((id) =>
  sprites.has(`fx-hit-${kebabCase(id)}`),
);

// Art's measured place (the ring's top-left) and size of each word on its 77x77 burst frame,
// for each burst the manifest has.
const ART_PLACES: Readonly<Partial<Record<EncounterId, [number, number, number]>>> = {
  capybara: [16, 43, 43],
  cheeseCrates: [20, 41, 35],
  droppedCone: [20, 43, 37],
  fishCrates: [23, 41, 30],
  otherDog: [21, 41, 34],
  porchCat: [24, 38, 27],
  promoTeam: [20, 38, 36],
  skunk: [22, 33, 32],
  thief: [20, 43, 35],
  weddingShoot: [22, 38, 33],
};

describe("font-comic", () => {
  it("draws A to Z, ! ? - and space", () => {
    const chars = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ!?- "];
    expect([...glyphs.keys()].sort()).toEqual(chars.sort());
  });
});

describe("the burst words", () => {
  it("star the burst of every encounter the manifest has one for, and no other", () => {
    expect(Object.keys(COMIC_WORDS.burst.starRows).sort()).toEqual([...bursts].sort());
  });

  it("give every burst a word font-comic draws as wide as art's", () => {
    for (const id of bursts) {
      const word = hitWord(gameData.encounters[id]) ?? "";
      expect(widthOf(word)).toBe(ART_PLACES[id]?.[2]);
    }
  });

  it("place every burst's word where art does", () => {
    for (const id of bursts) {
      const word = hitWord(gameData.encounters[id]) ?? "";
      const place = burstWordPlace(widthOf(word) ?? 0, COMIC_WORDS.burst.starRows[id] ?? 0);
      expect([place.x, place.y]).toEqual(ART_PLACES[id]?.slice(0, 2));
    }
  });
});

describe("the pack's words", () => {
  const { bark, dodge } = COMIC_WORDS;
  const words = gameData.runText.comicWords;

  it("draw the bark and dodge words in font-comic inside their frames", () => {
    for (const [, word, x, y, width, height] of [
      ["bark", words.bark, bark.x, Math.max(...bark.tops), bark.frame.width, bark.frame.height],
      ["dodge", words.dodge, dodge.x, dodge.y, 48, 48],
    ] as const) {
      const drawn = widthOf(word);
      expect(drawn).toBeDefined();
      expect(x + (drawn ?? Infinity)).toBeLessThanOrEqual(width);
      expect(y + LINE_HEIGHT).toBeLessThanOrEqual(height);
    }
  });

  it("hold the bark word for each of its tops", () => {
    expect(bark.ms).toHaveLength(bark.tops.length);
  });
});
