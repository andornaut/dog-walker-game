import { describe, expect, it } from "vitest";

import { fittingText, type TextFitStyle, WRAPPING_TEXT_FIT_STYLES } from "./textFit";

// Every character 4 font pixels wide, with spacing between glyphs, at the style's scale.
const width = (style: TextFitStyle, line: string) =>
  (line.length * 4 + style.letterSpacing * (line.length - 1)) * style.scale;

describe("fittingText", () => {
  it.each<[string, number, string, string[], TextFitStyle | undefined]>([
    ["on one line at 2x", 80, "ab cd", ["ab cd"], WRAPPING_TEXT_FIT_STYLES[0]],
    ["at 2x a screen pixel closer", 38, "ab cd", ["ab cd"], WRAPPING_TEXT_FIT_STYLES[1]],
    ["on two lines at 2x", 30, "abc def", ["abc", "def"], WRAPPING_TEXT_FIT_STYLES[2]],
    ["at 1x when two lines at 2x are too few", 32, "ab cd ef", ["ab cd ef"], undefined],
    ["at 1x when a word is too wide for 2x", 24, "abcdef", ["abcdef"], undefined],
    ["a paragraph a line at 2x", 30, "ab\ncd", ["ab", "cd"], WRAPPING_TEXT_FIT_STYLES[2]],
  ])("sets text %s", (_name, room, text, lines, style) => {
    const fitted = fittingText(WRAPPING_TEXT_FIT_STYLES, width, room, text);
    expect(fitted.lines).toEqual(lines);
    expect(fitted.style).toEqual(style ?? WRAPPING_TEXT_FIT_STYLES.at(-1));
  });
});
