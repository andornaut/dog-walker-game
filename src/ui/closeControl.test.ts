import { describe, expect, it } from "vitest";

import type { Rect } from "../lib/rect";
import { closeControl, closeFace, closeTopOnBar, pageCloseControl } from "./closeControl";

const encloses = (outer: Rect, inner: Rect) =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.x + inner.width <= outer.x + outer.width &&
  inner.y + inner.height <= outer.y + outer.height;

const card = { height: 120, width: 200, x: 24, y: 140 };
const screen = { height: 640, width: 360, x: 0, y: 0 };
const bar = { height: 48, width: 360, x: 0, y: 0 };

describe("closeControl", () => {
  it.each([
    ["a card", card, closeControl(card)],
    ["a page", screen, pageCloseControl(screen)],
    ["a page with a top bar", screen, pageCloseControl(screen, closeTopOnBar(bar))],
  ])("sits its face and its 44x44 target in %s's top-right corner", (_, frame, control) => {
    expect(control.hit).toMatchObject({ height: 44, width: 44, y: frame.y });
    expect(control.hit.x + control.hit.width).toBe(frame.x + frame.width);
    expect(encloses(control.hit, closeFace(control))).toBe(true);
    expect(encloses(frame, control.hit)).toBe(true);
  });

  it("centres the face on a bar", () => {
    const face = closeFace(pageCloseControl(screen, closeTopOnBar(bar)));
    expect(face.y - bar.y).toBe(bar.y + bar.height - (face.y + face.height));
  });
});
