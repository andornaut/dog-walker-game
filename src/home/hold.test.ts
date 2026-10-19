import { describe, expect, it } from "vitest";

import { HOLD, moveHold, releaseHold, startHold, tickHold } from "./hold";

const at = { x: 100, y: 200 };
const pressed = startHold(at, 1_000);
const due = 1_000 + HOLD.holdMs;

describe("a press on a holdable item", () => {
  it("taps when released before the hold time", () => {
    expect(tickHold(pressed, due - 1).fire).toBe(false);
    expect(releaseHold(pressed, due - 1)).toBe("tap");
  });

  it("fires the hold once at the hold time, and the release then does nothing", () => {
    const fired = tickHold(pressed, due);
    expect(fired.fire).toBe(true);
    expect(tickHold(fired.press, due + 500).fire).toBe(false);
    expect(releaseHold(fired.press, due + 500)).toBe("none");
  });

  it("holds rather than taps when released past the hold time before a frame fired it", () => {
    expect(releaseHold(pressed, due)).toBe("hold");
  });

  it("stays a hold within the slop, and only taps once it moves past it", () => {
    const wobble = moveHold(pressed, { x: at.x + HOLD.slopPx, y: at.y });
    expect(tickHold(wobble, due).fire).toBe(true);
    const dragged = moveHold(pressed, { x: at.x + HOLD.slopPx + 1, y: at.y });
    expect(tickHold(dragged, due).fire).toBe(false);
    expect(releaseHold(dragged, due + HOLD.holdMs)).toBe("tap");
  });
});
