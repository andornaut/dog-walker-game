import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { SCREEN_CONFIG } from "../data/screen";
import { fittingTextStyle, TEXT_FIT_STYLES, type TextFitStyle } from "../layout/textFit";
import { bodyTextWidth } from "../testing/bodyFont";
import { END_LAYOUT, endPanelLayout, QUIP_TEXT_ROOM } from "./endLayout";

const { badges, breakdown, panel: most, quips, side } = END_LAYOUT;

// Fees, tips and card costs always show, lucky finds and the starting money only sometimes;
// a walk has one owner's row per dog, up to a slot each.
const cases = [3, 4, 5].flatMap((lines) =>
  Array.from({ length: SCREEN_CONFIG.dogSlotCount }, (_, i) => [lines, i + 1] as const),
);

describe("endPanelLayout", () => {
  it.each(cases)("fits %i breakdown lines and %i owners' rows", (lines, rows) => {
    const { panel, quipsTop } = endPanelLayout(lines, rows);
    const totalBottom = breakdown.top + lines * breakdown.pitch + 8 + 10;
    const rule = quipsTop - 8;
    const lastBubble = quipsTop + (rows - 1) * quips.pitch + quips.bubble.height;
    expect(rule).toBeGreaterThan(Math.max(totalBottom, side.iconY + 16));
    expect(rule - Math.max(totalBottom, side.iconY + 16)).toBeLessThanOrEqual(8);
    expect(panel.y + panel.height).toBe(lastBubble + 8);
    expect(panel.height).toBeLessThanOrEqual(most.height);
    expect(panel.y + panel.height).toBeLessThanOrEqual(badges.y);
  });
});

// The end screen closes on each owner's fired or happier line, in the body font.
describe("an owner's closing line", () => {
  // Glyph advances, letterSpacing font pixels apart, at the style's scale.
  const width = (text: string) => (style: TextFitStyle) =>
    bodyTextWidth(style.scale, text) + style.letterSpacing * style.scale * (text.length - 1);
  const longest = Object.values(gameData.quips)
    .flatMap(({ fired, happier }) => [...fired, ...happier])
    .reduce((a, b) => (bodyTextWidth(1, b) > bodyTextWidth(1, a) ? b : a), "");

  it("fits the longest line inside its bubble", () => {
    const style = fittingTextStyle(TEXT_FIT_STYLES, width(longest), QUIP_TEXT_ROOM);
    expect(width(longest)(style)).toBeLessThanOrEqual(QUIP_TEXT_ROOM);
  });
});
