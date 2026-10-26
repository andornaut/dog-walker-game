import { describe, expect, it } from "vitest";

import {
  fittingText,
  fittingTextsAlike,
  TEXT_FIT_STYLES,
  type TextFitStyle,
  type TextToFit,
  WRAPPING_TEXT_FIT_STYLES,
} from "./textFit";

// Every character 4 font pixels wide, with spacing between glyphs, at the style's scale.
const width = (style: TextFitStyle, line: string) =>
  (line.length * 4 + style.letterSpacing * (line.length - 1)) * style.scale;

describe("fittingText", () => {
  it("sets text in the first style that fits, wrapping at 2x before falling to 1x", () => {
    for (const [, room, text, lines, style] of [
      ["on one line at 2x", 80, "ab cd", ["ab cd"], WRAPPING_TEXT_FIT_STYLES[0]],
      ["at 2x a screen pixel closer", 38, "ab cd", ["ab cd"], WRAPPING_TEXT_FIT_STYLES[1]],
      ["on two lines at 2x", 30, "abc def", ["abc", "def"], WRAPPING_TEXT_FIT_STYLES[2]],
      ["at 1x when two lines at 2x are too few", 32, "ab cd ef", ["ab cd ef"], undefined],
      ["at 1x when a word is too wide for 2x", 24, "abcdef", ["abcdef"], undefined],
      ["a paragraph a line at 2x", 30, "ab\ncd", ["ab", "cd"], WRAPPING_TEXT_FIT_STYLES[2]],
    ] satisfies readonly [string, number, string, string[], TextFitStyle | undefined][]) {
      const fitted = fittingText(WRAPPING_TEXT_FIT_STYLES, width, room, text);
      expect(fitted.lines).toEqual(lines);
      expect(fitted.style).toEqual(style ?? WRAPPING_TEXT_FIT_STYLES.at(-1));
    }
  });
});

describe("fittingTextsAlike", () => {
  const row = (room: number, text: string) => ({ inkWidth: width, room, text });
  it.each<[string, readonly TextFitStyle[], TextToFit[], string[][]]>([
    [
      "every row at 2x when all fit",
      TEXT_FIT_STYLES,
      [row(40, "abcd"), row(40, "ab")],
      [["abcd"], ["ab"]],
    ],
    [
      "every row closer when one needs it",
      TEXT_FIT_STYLES,
      [row(40, "abcd"), row(30, "abcd")],
      [["abcd"], ["abcd"]],
    ],
    [
      "every row at 1x when one fits only at 1x",
      TEXT_FIT_STYLES,
      [row(40, "ab"), row(40, "abcd"), row(20, "abcd")],
      [["ab"], ["abcd"], ["abcd"]],
    ],
    [
      "every row in the last style when one fits none",
      TEXT_FIT_STYLES,
      [row(40, "ab"), row(10, "abcd")],
      [["ab"], ["abcd"]],
    ],
    [
      "every row on two lines when one needs them",
      WRAPPING_TEXT_FIT_STYLES,
      [row(80, "ab cd"), row(30, "abc def")],
      [["ab cd"], ["abc", "def"]],
    ],
  ])("sets %s, in the largest style that fits all", (_case, styles, rows, lines) => {
    const fitted = fittingTextsAlike(styles, rows);
    // The largest style that fits all: the smallest any one row needs on its own.
    const alone = rows.map(({ room, text }) =>
      styles.indexOf(fittingText(styles, width, room, text).style),
    );
    const largest = styles[Math.max(...alone)];
    expect(fitted.map((one) => one.style)).toEqual(rows.map(() => largest));
    expect(fitted.map((one) => one.lines)).toEqual(lines);
  });

  it("sets no rows for an empty list", () => {
    expect(fittingTextsAlike(TEXT_FIT_STYLES, [])).toEqual([]);
  });
});
