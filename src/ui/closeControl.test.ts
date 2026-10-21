import { describe, expect, it } from "vitest";

import type { Rect } from "../lib/rect";
import { closeControl, closeFace } from "./closeControl";

const encloses = (outer: Rect, inner: Rect) =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.x + inner.width <= outer.x + outer.width &&
  inner.y + inner.height <= outer.y + outer.height;

describe("closeControl", () => {
  it.each<[string, Rect, ReturnType<typeof closeControl>]>([
    [
      "the screen",
      { height: 560, width: 360, x: 0, y: 0 },
      { hit: { height: 44, width: 44, x: 316, y: 0 }, x: 332, y: 10 },
    ],
    [
      "a card",
      { height: 328, width: 300, x: 30, y: 140 },
      { hit: { height: 44, width: 44, x: 286, y: 140 }, x: 302, y: 150 },
    ],
  ])("sits in the top-right corner of %s", (_, frame, control) => {
    expect(closeControl(frame)).toEqual(control);
  });

  it("keeps its face and its 44x44 target inside the frame", () => {
    const frame = { height: 120, width: 200, x: 24, y: 140 };
    const control = closeControl(frame);
    expect(encloses(control.hit, closeFace(control))).toBe(true);
    expect(encloses(frame, control.hit)).toBe(true);
  });
});
