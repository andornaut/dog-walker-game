import { readFileSync } from "node:fs";

import { decodePng } from "@andornaut/game-kit/art/png";
import { describe, expect, it } from "vitest";

import { SCREEN_CONFIG } from "../data/screen";
import { PALETTE } from "../ui/palette";
import { TOP_BAR_TRIM, topBarRects } from "../ui/topBarTrim";

// The walk bar's art, ui-walk-bar, is the one top bar art draws: its first column, clear of its
// wells, as the colour of each row.
describe("the top bars' trim", () => {
  const png = decodePng(readFileSync("public/art/images/ui-walk-bar.png"));
  const artRows = Array.from({ length: png.height }, (_, row) => {
    const [r = 0, g = 0, b = 0] = png.data.subarray(row * png.width * 4);
    return (r << 16) | (g << 8) | b;
  });
  const bar = { height: SCREEN_CONFIG.topBarHeight, width: 1, x: 0, y: 0 };
  // Each row as the code fills it, the last rect over a row winning.
  const codeRows = Array.from({ length: bar.height }, (_, row) => {
    const over = topBarRects(bar).filter(({ rect }) => row >= rect.y && row < rect.y + rect.height);
    return over.at(-1)?.colour ?? TOP_BAR_TRIM.fill;
  });

  it("is as tall as ui-walk-bar", () => {
    expect(png.height).toBe(bar.height);
  });

  it.each(codeRows.map((colour, row) => [row, colour] as const))(
    "fills row %i in %s, as ui-walk-bar draws it",
    (row, colour) => {
      expect(artRows[row]).toBe(PALETTE[colour]);
    },
  );
});
