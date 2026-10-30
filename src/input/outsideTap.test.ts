import { isOutside } from "@andornaut/game-kit/input/outsideTap";
import type { Point, Rect } from "@andornaut/game-kit/rect";
import { describe, expect, it } from "vitest";

import { SCREEN_LAYOUT } from "../data/screen";
import { screenArea } from "./outsideTap";

describe("screenArea", () => {
  const { screen } = SCREEN_LAYOUT;
  const panel = { height: 40, width: 40, x: 30, y: 30 };
  // A full-screen page covers the screen itself.
  it.each<[string, Rect[], Point, boolean]>([
    ["the screen beside a panel", [panel], { x: 5, y: 50 }, true],
    ["the screen's top-left corner beside a panel", [panel], { x: 0, y: 0 }, true],
    ["the panel", [panel], { x: 50, y: 50 }, false],
    ["past the screen's right edge", [panel], { x: screen.width, y: 50 }, false],
    ["past the screen's bottom edge", [panel], { x: 5, y: screen.height }, false],
    ["a full-screen page's corner", [screen], { x: 0, y: 0 }, false],
    ["a full-screen page's middle", [screen], { x: 50, y: 50 }, false],
  ])("%s", (_, covered, point, outside) => {
    expect(isOutside(screenArea(covered), point)).toBe(outside);
  });
});
