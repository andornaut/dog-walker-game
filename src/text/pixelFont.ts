// The 3x5 pixel font from the art mocks, plus a 5-wide heart. Each glyph is its rows top
// to bottom, "1" for a lit pixel. Text is drawn in capitals.
const GLYPHS: Readonly<Record<string, string>> = {
  "!": "010010010000010",
  '"': "101101000000000",
  $: "011110111011110",
  "%": "101001010100101",
  "&": "010101010101011",
  "'": "010010000000000",
  "(": "001010010010001",
  ")": "100010010010100",
  "+": "000010111010000",
  ",": "000000000010100",
  "-": "000000111000000",
  ".": "000000000000010",
  "/": "001001010100100",
  "0": "111101101101111",
  "1": "010110010010111",
  "2": "110001010100111",
  "3": "110001010001110",
  "4": "101101111001001",
  "5": "111100110001110",
  "6": "011100111101111",
  "7": "111001010010010",
  "8": "111101111101111",
  "9": "111101111001110",
  ":": "000010000010000",
  ";": "000010000010100",
  "?": "110001010000010",
  A: "010101111101101",
  B: "110101110101110",
  C: "011100100100011",
  D: "110101101101110",
  E: "111100110100111",
  F: "111100110100100",
  G: "011100101101011",
  H: "101101111101101",
  I: "111010010010111",
  J: "001001001101010",
  K: "101101110101101",
  L: "100100100100111",
  M: "101111111101101",
  N: "110101101101101",
  O: "010101101101010",
  P: "110101110100100",
  Q: "010101101110011",
  R: "110101110101101",
  S: "011100010001110",
  T: "111010010010010",
  U: "101101101101111",
  V: "101101101101010",
  W: "101101111111101",
  X: "101101010101101",
  Y: "101101010010010",
  Z: "111001010100111",
  "♥": "0101011111111110111000100",
};

export const GLYPH_HEIGHT = 5;
// The distance from one line's top to the next.
export const LINE_HEIGHT = 8;
const SPACE_WIDTH = 3;
const WIDE_GLYPHS: Readonly<Record<string, number>> = { "♥": 5 };

// Typographic marks drawn as their plain ASCII equivalents, which every font here has.
const PLAIN_EQUIVALENTS: Readonly<Record<string, string>> = {
  "×": "x",
  "‘": "'",
  "’": "'",
  "“": '"',
  "”": '"',
  "−": "-",
};

export function plainMarks(text: string): string {
  return [...text].map((char) => PLAIN_EQUIVALENTS[char] ?? char).join("");
}

// The text as this font draws it: capitals, with typographic marks made plain.
export function normalizePixelText(text: string): string {
  return plainMarks(text).toUpperCase();
}

export interface Glyph {
  bits: string;
  char: string;
  width: number;
}

export const PIXEL_GLYPHS: readonly Glyph[] = Object.entries(GLYPHS).map(([char, bits]) => ({
  bits,
  char,
  width: WIDE_GLYPHS[char] ?? 3,
}));

const GLYPH_WIDTHS = new Map(PIXEL_GLYPHS.map(({ char, width }) => [char, width]));

// One pixel of space follows every glyph; a character the font lacks draws as a space.
export function glyphAdvance(char: string): number {
  return (GLYPH_WIDTHS.get(char) ?? SPACE_WIDTH) + 1;
}

export interface AtlasGlyph {
  advance: number;
  char: string;
  // Lit pixels, relative to the glyph's top-left corner in the atlas.
  pixels: readonly (readonly [number, number])[];
  width: number;
  x: number;
}

export interface PixelFontAtlas {
  glyphs: readonly AtlasGlyph[];
  height: number;
  width: number;
}

// Every glyph side by side on one row, a pixel apart so no glyph bleeds into the next.
export function pixelFontAtlas(): PixelFontAtlas {
  let x = 0;
  const glyphs = PIXEL_GLYPHS.map(({ bits, char, width }): AtlasGlyph => {
    const pixels: [number, number][] = [];
    [...bits].forEach((bit, index) => {
      if (bit === "1") {
        pixels.push([index % width, Math.floor(index / width)]);
      }
    });
    const glyph = { advance: glyphAdvance(char), char, pixels, width, x };
    x += width + 1;
    return glyph;
  });
  return { glyphs, height: GLYPH_HEIGHT, width: x };
}
