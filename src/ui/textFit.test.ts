import { describe, expect, it } from "vitest";

import { fitsRoom, fittingText, type TextFitStyle } from "./textFit";

// Every character 4 font pixels wide, at the style's scale.
const width = (style: TextFitStyle, line: string) => line.length * 4 * style.scale;

describe("fittingText", () => {
  it.each<[string, TextFitStyle, number, string, string[], boolean]>([
    ["one line that fits", { scale: 2 }, 80, "ab cd", ["ab cd"], true],
    ["one line too wide, at its size", { scale: 2 }, 30, "ab cd", ["ab cd"], false],
    ["two lines wrapped at spaces", { lines: 2, scale: 2 }, 30, "abc def", ["abc", "def"], true],
    [
      "more lines than the style holds",
      { lines: 2, scale: 2 },
      20,
      "ab cd ef",
      ["ab", "cd", "ef"],
      false,
    ],
    ["a word too wide on its own line", { lines: 2, scale: 2 }, 24, "abcdef", ["abcdef"], false],
    ["a paragraph a line", { lines: 2, scale: 2 }, 30, "ab\ncd", ["ab", "cd"], true],
  ])("sets %s", (_case, style, room, text, lines, fits) => {
    const fitted = fittingText(style, width, room, text);
    expect(fitted).toEqual({ lines, style });
    expect(fitsRoom(width, room, fitted)).toBe(fits);
  });
});
