import { describe, expect, it } from "vitest";

import type { Point, Rect } from "../layout/rect";
import {
  isOutside,
  type OutsideArea,
  outsidePressDown,
  outsidePressMove,
  outsideTapped,
  screenArea,
} from "./outsideTap";

// A 100x100 dimmed area with a panel in its middle and a close control in its top-right corner.
const AREA: OutsideArea = {
  covered: [
    { height: 40, width: 40, x: 30, y: 30 },
    { height: 20, width: 20, x: 80, y: 0 },
  ],
  dim: { height: 100, width: 100, x: 0, y: 0 },
};
const TAP_MAX = 10;

describe("isOutside", () => {
  it.each<[string, Point, boolean]>([
    ["the dimmed area", { x: 5, y: 50 }, true],
    ["the dimmed area just left of the panel", { x: 29, y: 50 }, true],
    ["the panel", { x: 50, y: 50 }, false],
    ["the panel's left edge", { x: 30, y: 50 }, false],
    ["the close control", { x: 90, y: 10 }, false],
    ["past the dimmed area", { x: 50, y: 100 }, false],
  ])("counts a point on %s as %s", (_name, point, expected) => {
    expect(isOutside(AREA, point)).toBe(expected);
  });
});

describe("screenArea", () => {
  const screen = { height: 100, width: 100 };
  const panel = { height: 40, width: 40, x: 30, y: 30 };
  // A full-screen page covers the screen itself.
  it.each<[string, Rect[], Point, boolean]>([
    ["the screen beside a panel", [panel], { x: 5, y: 50 }, true],
    ["the screen's top-left corner beside a panel", [panel], { x: 0, y: 0 }, true],
    ["the panel", [panel], { x: 50, y: 50 }, false],
    ["past the screen's right edge", [panel], { x: 100, y: 50 }, false],
    ["a full-screen page's corner", [{ ...screen, x: 0, y: 0 }], { x: 0, y: 0 }, false],
    ["a full-screen page's middle", [{ ...screen, x: 0, y: 0 }], { x: 50, y: 50 }, false],
  ])("decides a point on %s", (_name, covered, point, expected) => {
    expect(isOutside(screenArea(screen, covered), point)).toBe(expected);
  });
});

describe("a tap outside the panel", () => {
  // Where the press lands, where it travels on the way, where it is released, and whether the
  // browser cancelled it.
  it.each<[string, Point, Point[], Point, boolean, boolean]>([
    ["taps on a release where it landed", { x: 5, y: 50 }, [], { x: 5, y: 50 }, false, true],
    [
      "taps after travelling within the tap distance",
      { x: 5, y: 50 },
      [{ x: 11, y: 58 }],
      { x: 5, y: 50 },
      false,
      true,
    ],
    [
      "is a drag once it travels past the tap distance, even back again",
      { x: 5, y: 50 },
      [{ x: 5, y: 61 }],
      { x: 5, y: 50 },
      false,
      false,
    ],
    [
      "taps nothing when it lands on the panel",
      { x: 50, y: 50 },
      [],
      { x: 50, y: 50 },
      false,
      false,
    ],
    [
      "taps nothing when it lands on a control",
      { x: 90, y: 10 },
      [],
      { x: 90, y: 10 },
      false,
      false,
    ],
    [
      "taps nothing when it is released on the panel",
      { x: 25, y: 50 },
      [],
      { x: 31, y: 50 },
      false,
      false,
    ],
    ["taps nothing when the browser cancels it", { x: 5, y: 50 }, [], { x: 5, y: 50 }, true, false],
  ])("%s", (_name, down, moves, up, cancelled, expected) => {
    const press = moves.reduce<ReturnType<typeof outsidePressDown>>(
      (current, point) =>
        current === undefined ? undefined : outsidePressMove(TAP_MAX, point, current),
      outsidePressDown(AREA, down),
    );
    expect(outsideTapped(AREA, TAP_MAX, cancelled, press, up)).toBe(expected);
  });
});
