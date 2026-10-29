import { describe, expect, it } from "vitest";

import { inside } from "../testing/rects";
import { closeControl, closeFace, pageCloseControl } from "./closeControl";

const card = { height: 120, width: 200, x: 24, y: 140 };
const screen = { height: 640, width: 360, x: 0, y: 0 };

describe("closeControl", () => {
  it.each([
    ["a card", card, closeControl(card)],
    ["a page", screen, pageCloseControl(screen)],
    ["a page with its face 9 down", screen, pageCloseControl(screen, 9)],
  ])("sits its face and its 44x44 target in %s's top-right corner", (_, frame, control) => {
    expect(control.hit).toMatchObject({ height: 44, width: 44, y: frame.y });
    expect(control.hit.x + control.hit.width).toBe(frame.x + frame.width);
    expect(inside(closeFace(control), control.hit)).toBe(true);
    expect(inside(control.hit, frame)).toBe(true);
  });
});
