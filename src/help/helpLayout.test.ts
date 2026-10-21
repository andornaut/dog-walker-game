import { describe, expect, it } from "vitest";

import { itemAt } from "../arrays";
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

describe("dotRects", () => {
  it("centres a row of 8px dots one tap target apart", () => {
    const dots = dotRects(7);
    expect(dots.map((dot) => dot.x)).toEqual([44, 88, 132, 176, 220, 264, 308]);
    expect(dots.every((dot) => dot.y === 476 && dot.width === 8 && dot.height === 8)).toBe(true);
    const first = itemAt(dots, 0);
    const last = itemAt(dots, 6);
    expect(first.x - 180).toBe(180 - (last.x + last.width));
  });
});

describe("tapRect", () => {
  it.each<[string, Rect, Rect]>([
    [
      "grows small art about its centre to the minimum",
      { height: 8, width: 8, x: 44, y: 478 },
      { height: 44, width: 44, x: 26, y: 460 },
    ],
    [
      "keeps a side already larger than the minimum",
      HELP_LAYOUT.previous,
      { height: 44, width: 110, x: 8, y: 504 },
    ],
    [
      "shifts a target that would leave the screen back onto it",
      { height: 4, width: 4, x: 358, y: 558 },
      { height: 44, width: 44, x: 316, y: 516 },
    ],
  ])("%s", (_name, art, expected) => {
    expect(tapRect(art)).toEqual(expected);
  });
});

describe("help tap targets", () => {
  const targets = [
    CLOSE_HIT_RECT,
    tapRect(HELP_LAYOUT.previous),
    tapRect(HELP_LAYOUT.next),
    ...dotRects(7).map(tapRect),
  ];

  it("are at least the minimum tap size each way and enclose their art", () => {
    for (const target of targets) {
      expect(target.width).toBeGreaterThanOrEqual(MIN_TAP_SIZE);
      expect(target.height).toBeGreaterThanOrEqual(MIN_TAP_SIZE);
    }
    expect(encloses(CLOSE_HIT_RECT, closeFace(HELP_LAYOUT.close))).toBe(true);
    dotRects(7).forEach((dot) => expect(encloses(tapRect(dot), dot)).toBe(true));
  });

  it("never overlap", () => {
    targets.forEach((a, i) => {
      targets.slice(i + 1).forEach((b) => expect(overlaps(a, b)).toBe(false));
    });
  });
});

describe("helpActionAt", () => {
  // Taps at the edges of each target and just outside them.
  it.each<[number, number, HelpAction | undefined]>([
    [330, 20, { kind: "close" }],
    [316, 0, { kind: "close" }],
    [356, 43, { kind: "close" }],
    [20, 520, { kind: "previous" }],
    [20, 504, { kind: "previous" }],
    [300, 520, { kind: "advance" }],
    [48, 482, { kind: "goTo", page: 0 }],
    [26, 458, { kind: "goTo", page: 0 }],
    [70, 501, { kind: "goTo", page: 1 }],
    [333, 482, { kind: "goTo", page: 6 }],
    [180, 200, undefined],
    [312, 20, undefined],
    [330, 44, undefined],
    [180, 520, undefined],
    [180, 457, undefined],
    [25, 482, undefined],
  ])("maps a tap at (%i, %i) to %j", (x, y, expected) => {
    expect(helpActionAt(7, { x, y })).toEqual(expected);
  });
});

const BODY = fontFileMetrics("font-body");

describe("help pages", () => {
  const { lineHeight, maxLines, scale, width, y } = HELP_LAYOUT.body;
  const dotsTop = Math.min(...dotRects(gameData.help.length).map((dot) => dot.y));
  const pages = gameData.help.map((page, index) => [index + 1, page.title, page] as const);

  it.each(pages)("fits page %i, %s, in its lines above the page dots", (_, _title, page) => {
    const body = helpBody(gameData, page);
    const lines = wrapWords((line) => bodyTextWidth(scale, line), width, body);
    expect(lines.every((line) => bodyTextWidth(scale, line) <= width)).toBe(true);
    expect(lines.length).toBeLessThanOrEqual(maxLines);
    const inkBottom = y + (maxLines - 1) * lineHeight + inkRowsFromCapTop(BODY) * scale;
    expect(inkBottom).toBeLessThanOrEqual(dotsTop);
  });

  it.each(pages)("fits page %i's title, %s, across the screen", (_, title) => {
    const { scale: titleScale, x } = HELP_LAYOUT.title;
    const ink = fontInk("font-title", { letterSpacing: 0, scale: titleScale }, title.toUpperCase());
    expect(x + ink.right).toBeLessThanOrEqual(HELP_LAYOUT.screen.width - x);
  });
});
