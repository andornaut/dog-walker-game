import { describe, expect, it } from "vitest";

import type { Rect } from "../lib/rect";
import { closeControl, closeFace } from "./closeControl";

const encloses = (outer: Rect, inner: Rect) =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.x + inner.width <= outer.x + outer.width &&
  inner.y + inner.height <= outer.y + outer.height;

describe("closeControl", () => {
  it("sits its face and its 44x44 target in the frame's top-right corner", () => {
    const frame = { height: 120, width: 200, x: 24, y: 140 };
    const control = closeControl(frame);
    expect(control.hit).toMatchObject({ height: 44, width: 44, y: frame.y });
    expect(control.hit.x + control.hit.width).toBe(frame.x + frame.width);
    expect(encloses(control.hit, closeFace(control))).toBe(true);
    expect(encloses(frame, control.hit)).toBe(true);
  });
});
