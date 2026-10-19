import { describe, expect, it } from "vitest";

import { itemAt } from "../arrays";
import { type Rect } from "../layout/rect";
import {
  CLOSE_HIT_RECT,
  dotRects,
  HELP_LAYOUT,
  helpActionAt,
  MIN_TAP_SIZE,
  tapRect,
} from "./helpLayout";

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
  it("grows small art about its centre to the minimum", () => {
    expect(tapRect({ height: 8, width: 8, x: 44, y: 478 })).toEqual({
      height: 44,
      width: 44,
      x: 26,
      y: 460,
    });
  });

  it("keeps a side already larger than the minimum", () => {
    expect(tapRect(HELP_LAYOUT.back)).toEqual({ height: 44, width: 110, x: 8, y: 502 });
  });

  it("shifts a target that would leave the screen back onto it", () => {
    expect(CLOSE_HIT_RECT).toEqual({ height: 44, width: 44, x: 313, y: 0 });
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
    tapRect(HELP_LAYOUT.back),
    tapRect(HELP_LAYOUT.next),
    ...dotRects(7).map(tapRect),
  ];

  it("are at least the minimum tap size each way and enclose their art", () => {
    for (const target of targets) {
      expect(target.width).toBeGreaterThanOrEqual(MIN_TAP_SIZE);
      expect(target.height).toBeGreaterThanOrEqual(MIN_TAP_SIZE);
    }
    expect(encloses(CLOSE_HIT_RECT, HELP_LAYOUT.close)).toBe(true);
    dotRects(7).forEach((dot) => expect(encloses(tapRect(dot), dot)).toBe(true));
  });

  it("never overlap", () => {
    targets.forEach((a, i) => {
      targets.slice(i + 1).forEach((b) => expect(overlaps(a, b)).toBe(false));
    });
  });
});

describe("helpActionAt", () => {
  it("maps the close X, Back and Next by their whole targets", () => {
    expect(helpActionAt(7, { x: 330, y: 20 })).toEqual({ kind: "close" });
    expect(helpActionAt(7, { x: 313, y: 0 })).toEqual({ kind: "close" });
    expect(helpActionAt(7, { x: 356, y: 43 })).toEqual({ kind: "close" });
    expect(helpActionAt(7, { x: 20, y: 520 })).toEqual({ kind: "previous" });
    expect(helpActionAt(7, { x: 20, y: 502 })).toEqual({ kind: "previous" });
    expect(helpActionAt(7, { x: 300, y: 520 })).toEqual({ kind: "advance" });
  });

  it("jumps to the page of the dot slot under the tap", () => {
    expect(helpActionAt(7, { x: 48, y: 482 })).toEqual({ kind: "goTo", page: 0 });
    expect(helpActionAt(7, { x: 26, y: 458 })).toEqual({ kind: "goTo", page: 0 });
    expect(helpActionAt(7, { x: 70, y: 501 })).toEqual({ kind: "goTo", page: 1 });
    expect(helpActionAt(7, { x: 333, y: 482 })).toEqual({ kind: "goTo", page: 6 });
  });

  it("ignores taps outside every target", () => {
    expect(helpActionAt(7, { x: 180, y: 200 })).toBeUndefined();
    expect(helpActionAt(7, { x: 312, y: 20 })).toBeUndefined();
    expect(helpActionAt(7, { x: 330, y: 44 })).toBeUndefined();
    expect(helpActionAt(7, { x: 180, y: 520 })).toBeUndefined();
    expect(helpActionAt(7, { x: 180, y: 457 })).toBeUndefined();
    expect(helpActionAt(7, { x: 25, y: 482 })).toBeUndefined();
  });
});
