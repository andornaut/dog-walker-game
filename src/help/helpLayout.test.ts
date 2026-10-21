import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { closeFace } from "../layout/closeControl";
import { type Rect } from "../layout/rect";
import { bodyTextWidth } from "../testing/bodyFont";
import { fontFileMetrics, fontInk } from "../testing/fontInk";
import { wrapWords } from "../text/lines";
import { inkRowsFromCapTop } from "../ui/fontMetrics";
import { helpBody } from "./helpBody";
import {
  CLOSE_HIT_RECT,
  dotRects,
  HELP_LAYOUT,
  helpActionAt,
  MIN_TAP_SIZE,
  tapRect,
} from "./helpLayout";
import type { HelpAction } from "./helpPaging";

const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

const encloses = (outer: Rect, inner: Rect) =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.x + inner.width <= outer.x + outer.width &&
  inner.y + inner.height <= outer.y + outer.height;

describe("tapRect", () => {
  it("grows small art about its centre to the minimum, keeps a larger side and stays on screen", () => {
    expect(tapRect({ height: 8, width: 8, x: 44, y: 478 })).toEqual({
      height: 44,
      width: 44,
      x: 26,
      y: 460,
    });
    expect(tapRect({ height: 44, width: 110, x: 8, y: 504 }).width).toBe(110);
    expect(tapRect({ height: 4, width: 4, x: 358, y: 558 })).toEqual({
      height: 44,
      width: 44,
      x: 316,
      y: 516,
    });
  });
});

describe("help tap targets", () => {
  const targets = [
    CLOSE_HIT_RECT,
    tapRect(HELP_LAYOUT.previous),
    tapRect(HELP_LAYOUT.next),
    ...dotRects(7).map(tapRect),
  ];

  it("are at least the minimum tap size each way, enclose their art and never overlap", () => {
    for (const target of targets) {
      expect(target.width).toBeGreaterThanOrEqual(MIN_TAP_SIZE);
      expect(target.height).toBeGreaterThanOrEqual(MIN_TAP_SIZE);
    }
    expect(encloses(CLOSE_HIT_RECT, closeFace(HELP_LAYOUT.close))).toBe(true);
    dotRects(7).forEach((dot) => expect(encloses(tapRect(dot), dot)).toBe(true));
    targets.forEach((a, i) => {
      targets.slice(i + 1).forEach((b) => expect(overlaps(a, b)).toBe(false));
    });
  });
});

describe("helpActionAt", () => {
  // Taps at the edges of each target and just outside them.
  it("maps a tap on each target to its action, and one outside them to none", () => {
    const taps: [number, number, HelpAction | undefined][] = [
      [330, 20, { kind: "close" }],
      [20, 520, { kind: "previous" }],
      [300, 520, { kind: "advance" }],
      [26, 458, { kind: "goTo", page: 0 }],
      [333, 482, { kind: "goTo", page: 6 }],
      [180, 200, undefined],
      [180, 457, undefined],
    ];
    for (const [x, y, expected] of taps) {
      expect(helpActionAt(7, { x, y }), `${x}, ${y}`).toEqual(expected);
    }
  });
});

const BODY = fontFileMetrics("font-body");

describe("help pages", () => {
  const { lineHeight, maxLines, scale, width, y } = HELP_LAYOUT.body;
  const dotsTop = Math.min(...dotRects(gameData.help.length).map((dot) => dot.y));
  it("fits every page's body in its lines above the page dots, and its title across the screen", () => {
    const { scale: titleScale, x } = HELP_LAYOUT.title;
    const inkBottom = y + (maxLines - 1) * lineHeight + inkRowsFromCapTop(BODY) * scale;
    expect(inkBottom).toBeLessThanOrEqual(dotsTop);
    const offenders = gameData.help.filter((page) => {
      const lines = wrapWords(
        (line) => bodyTextWidth(scale, line),
        width,
        helpBody(gameData, page),
      );
      const title = fontInk(
        "font-title",
        { letterSpacing: 0, scale: titleScale },
        page.title.toUpperCase(),
      );
      return (
        lines.some((line) => bodyTextWidth(scale, line) > width) ||
        lines.length > maxLines ||
        x + title.right > HELP_LAYOUT.screen.width - x
      );
    });
    expect(offenders.map(({ title }) => title)).toEqual([]);
  });
});
