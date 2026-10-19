import { describe, expect, it } from "vitest";

import { defined } from "../testing/defined";
import { dotHitRect, dotRects, helpActionAt } from "./helpLayout";

describe("dotRects", () => {
  it("centres a row of 8px dots 14px apart", () => {
    const dots = dotRects(6);
    expect(dots.map((dot) => dot.x)).toEqual([141, 155, 169, 183, 197, 211]);
    expect(dots.every((dot) => dot.y === 562 && dot.width === 8 && dot.height === 8)).toBe(true);
    const first = defined(dots[0]);
    const last = defined(dots[5]);
    expect(first.x - 180).toBe(180 - (last.x + last.width));
  });

  it("gives each dot a 14x20 tap target around it", () => {
    expect(dotHitRect(defined(dotRects(6)[0]))).toEqual({ height: 20, width: 14, x: 138, y: 556 });
  });
});

describe("helpActionAt", () => {
  it("maps the close X, Back and Next", () => {
    expect(helpActionAt(6, { x: 330, y: 20 })).toEqual({ kind: "close" });
    expect(helpActionAt(6, { x: 20, y: 600 })).toEqual({ kind: "previous" });
    expect(helpActionAt(6, { x: 300, y: 600 })).toEqual({ kind: "advance" });
  });

  it("jumps to the page of the dot slot under the tap, gap included", () => {
    expect(helpActionAt(6, { x: 145, y: 566 })).toEqual({ kind: "goTo", page: 0 });
    expect(helpActionAt(6, { x: 152, y: 557 })).toEqual({ kind: "goTo", page: 1 });
    expect(helpActionAt(6, { x: 221, y: 575 })).toEqual({ kind: "goTo", page: 5 });
  });

  it("ignores taps outside every target", () => {
    expect(helpActionAt(6, { x: 180, y: 200 })).toBeUndefined();
    expect(helpActionAt(6, { x: 180, y: 600 })).toBeUndefined();
    expect(helpActionAt(6, { x: 145, y: 576 })).toBeUndefined();
    expect(helpActionAt(6, { x: 137, y: 566 })).toBeUndefined();
  });
});
