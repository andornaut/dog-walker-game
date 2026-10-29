import { describe, expect, it } from "vitest";

import type { Rect } from "../lib/rect";
import { inkWidth } from "../testing/fontInk";
import { cardTitles } from "../testing/textRoles";
import { BAR_TITLE, barTitleLeft } from "../ui/barTitle";
import { type CloseControl, closeControl } from "../ui/closeControl";
import { plainMarks } from "../ui/pixelFont";
import { TEXT_STYLE } from "../ui/textFit";
import { cardBand } from "./homeLayout";

// The clear space left of a title's ink, from the bar's left edge, and right of it, to the close
// control's face.
function clearSpace(bar: Rect, close: CloseControl, width: number) {
  const left = barTitleLeft(bar, close, width);
  return { left: left - bar.x, right: close.x - (left + width) };
}

// A centred title has the same clear space each side, to within the odd pixel, at least inset;
// one too wide for that starts inset in.
function expectPlaced(bar: Rect, close: CloseControl, width: number): void {
  const { left, right } = clearSpace(bar, close, width);
  if (left > BAR_TITLE.inset) {
    expect(right - left).toBeGreaterThanOrEqual(0);
    expect(right - left).toBeLessThanOrEqual(1);
  } else {
    expect(left).toBe(BAR_TITLE.inset);
    expect(right).toBeLessThanOrEqual(BAR_TITLE.inset + 1);
  }
}

describe("barTitleLeft", () => {
  const card: Rect = { height: 100, width: 300, x: 30, y: 0 };
  const bar = cardBand(card);
  const close = closeControl(card);
  const room = close.x - bar.x;

  it.each([
    ["a short title", 40],
    ["an odd width", 41],
    ["a title with exactly inset each side", room - 2 * BAR_TITLE.inset],
    ["a title a pixel too wide to centre", room - 2 * BAR_TITLE.inset + 1],
    ["a title too wide to centre", room - BAR_TITLE.inset - BAR_TITLE.closeGap],
  ])("places %s centred or at the inset", (_, width) => {
    expectPlaced(bar, close, width);
  });

  it.each([
    ["centres a title with room for inset each side", room - 2 * BAR_TITLE.inset, "centre"],
    ["starts a wider title at the inset", room - 2 * BAR_TITLE.inset + 2, "left"],
  ])("%s", (_, width, placed) => {
    const { left, right } = clearSpace(bar, close, width);
    expect(left === right ? "centre" : "left").toBe(placed);
  });
});

describe.each(cardTitles())("the $role", ({ card, titles }) => {
  const bar = cardBand(card);
  const close = closeControl(card);

  it.each(titles)("places %s centred beside the close control, or at the inset", (title) => {
    expectPlaced(bar, close, inkWidth("font-title", TEXT_STYLE, plainMarks(title).toUpperCase()));
  });
});
