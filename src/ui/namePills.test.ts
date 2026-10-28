import { describe, expect, it } from "vitest";

import { wrapWords } from "../lib/lines";
import { bodyTextWidth } from "../testing/bodyFont";
import { fontInk, laidChars } from "../testing/fontInk";
import {
  inkWithPills,
  inPill,
  laidPills,
  PILL,
  pillIndex,
  pillOpener,
  pillRows,
} from "./namePills";

const NAME = "Running shoes";
const TEXT = `${inPill(2, NAME)} faster lane changes`;

describe("a name pill in the body font", () => {
  it.each([1, 2])("insets the name, then gaps the description, by its columns at %ix", (scale) => {
    const chars = laidChars("font-body", { letterSpacing: 0, scale }, TEXT);
    const [pill] = laidPills(scale, chars);
    const name = chars.slice(1, 1 + NAME.length).flatMap((char) => char.ink ?? []);
    const next = chars.slice(NAME.length + 2).find((char) => char.ink !== null)?.ink;
    expect(pill).toMatchObject({ index: 2, left: 0, line: 0 });
    expect(Math.min(...name.map((ink) => ink.left)) - (pill?.left ?? 0)).toBe(PILL.inset * scale);
    expect((pill?.right ?? 0) - Math.max(...name.map((ink) => ink.right))).toBe(PILL.inset * scale);
    expect((next?.left ?? 0) - (pill?.right ?? 0)).toBe(PILL.gap * scale);
  });

  it("counts the pill as the text's ink, and its advance holds the pill", () => {
    const style = { letterSpacing: 0, scale: 2 };
    const chars = laidChars("font-body", style, inPill(0, NAME));
    const [pill] = laidPills(2, chars);
    expect(fontInk("font-body", style, inPill(0, NAME))).toEqual({
      left: pill?.left,
      right: pill?.right,
    });
    expect(inkWithPills(2, chars)).toEqual({ left: pill?.left, right: pill?.right });
    expect(bodyTextWidth(2, inPill(0, NAME))).toBeGreaterThanOrEqual(pill?.right ?? Infinity);
  });

  it("never wraps inside a name", () => {
    const lines = wrapWords((line) => bodyTextWidth(1, line), 1, TEXT);
    expect(lines[0]).toBe(inPill(2, NAME));
  });

  it("stands 11 rows tall from a row above its line, at the text's scale", () => {
    expect(pillRows(2)).toEqual({ height: 22, top: -2 });
  });
});

describe("pill openers", () => {
  // The first and last kinds.
  it.each([0, 15])("name their kind, %i", (index) => {
    expect(pillIndex(pillOpener(index))).toBe(index);
  });

  it("are no other character's", () => {
    expect([..."aZ $"].map(pillIndex)).toEqual([undefined, undefined, undefined, undefined]);
  });
});
