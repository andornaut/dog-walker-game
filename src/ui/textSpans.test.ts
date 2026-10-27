import { describe, expect, it } from "vitest";

import { wrapWords } from "../lib/lines";
import { shownSpanColours } from "./textSpans";

const NAME = 0xaa0000;
const SOURCE = "−1♥ Kilo, Stinky: tips pay nothing for 30s";
const SPANS = [{ at: SOURCE.indexOf("Stinky"), colour: NAME, length: "Stinky".length }];

// The characters of shown texts drawn in colour, joined per text.
function inColour(shown: readonly string[], colour: number | undefined): string[] {
  const colours = shownSpanColours(SOURCE, SPANS, shown);
  return shown.map((text, n) =>
    text
      .split("")
      .filter((char, i) => char !== " " && char !== "\n" && colours[n]?.[i] === colour)
      .join(""),
  );
}

describe("shownSpanColours", () => {
  // Widths in characters, so the name lands at the start, middle and end of a line.
  it.each([1, 8, 12, 17, 20, 60])(
    "colours the name alone, the rest left in the text's colour, wrapped at %i",
    (room) => {
      const lines = wrapWords((line) => line.length, room, SOURCE);
      expect(inColour(lines, NAME).join("")).toBe("Stinky");
      expect(inColour(lines, undefined).join("")).toBe(
        SOURCE.replace("Stinky", "").replaceAll(" ", ""),
      );
    },
  );

  it("follows the text across a label's line breaks and across separate runs", () => {
    const lines = wrapWords((line) => line.length, 17, SOURCE);
    expect(inColour([lines.join("\n")], NAME)).toEqual(["Stinky"]);
    expect(inColour(["−1♥ Kilo, Sti", "nky: tips pay nothing for 30s"], NAME)).toEqual([
      "Sti",
      "nky",
    ]);
  });

  it("colours nothing without spans", () => {
    expect(shownSpanColours(SOURCE, [], [SOURCE])[0]?.every((c) => c === undefined)).toBe(true);
  });
});
