import { describe, expect, it } from "vitest";

import { inside } from "../testing/rects";
import { closeControl, closeFace, pageCloseControl } from "./closeControl";

const card = { height: 120, width: 200, x: 24, y: 140 };
const screen = { height: 640, width: 360, x: 0, y: 0 };

describe("closeControl", () => {
  it("places a modal face 6px inside its top-right corner and keeps its whole target inside", () => {
    const control = closeControl(card);
    expect(closeFace(control)).toEqual({
      height: 20,
      width: 20,
      x: card.x + card.width - 6 - 20,
      y: card.y + 6,
    });
    expect(control.hit).toEqual({ height: 44, width: 44, x: card.x + card.width - 44, y: card.y });
    expect(inside(closeFace(control), control.hit)).toBe(true);
    expect(inside(control.hit, card)).toBe(true);
  });

  it.each([
    ["a page", screen, pageCloseControl(screen)],
    ["a page with its face 9 down", screen, pageCloseControl(screen, 9)],
  ])("sits its face and its 44x44 target in %s's top-right corner", (_, frame, control) => {
    expect(control.hit).toMatchObject({ height: 44, width: 44, y: frame.y });
    expect(control.hit.x + control.hit.width).toBe(frame.x + frame.width);
    expect(inside(closeFace(control), control.hit)).toBe(true);
    expect(inside(control.hit, frame)).toBe(true);
  });
});
