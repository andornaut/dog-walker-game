import { describe, expect, it } from "vitest";

import { TUNING } from "../data/tuning";
import { read } from "../rules/units";
import { GRACE_BLINK, graceAlpha } from "./graceBlink";

const WINDOW = read(TUNING, "seconds", "collisionGrace");
const { blinkSeconds, dimAlpha } = GRACE_BLINK;

describe("graceAlpha", () => {
  // remaining is the grace left; elapsed blinks count from the window's start.
  it.each([
    { alpha: 1, name: "with no window open", remaining: 0 },
    { alpha: 1, name: "past the window's end", remaining: -blinkSeconds },
    { alpha: 1, name: "as the window opens, through the hit stop", remaining: WINDOW },
    { alpha: 1, name: "in the first blink", remaining: WINDOW - 0.5 * blinkSeconds },
    { alpha: 0, name: "in the second blink", remaining: WINDOW - 1.5 * blinkSeconds },
    { alpha: 1, name: "in the third blink", remaining: WINDOW - 2.5 * blinkSeconds },
    { alpha: 0, name: "in the fourth blink", remaining: WINDOW - 3.5 * blinkSeconds },
  ])("shows the pack at $alpha $name", ({ alpha, remaining }) => {
    expect(graceAlpha(GRACE_BLINK, false, WINDOW, remaining)).toBe(alpha);
  });

  it.each([
    { alpha: dimAlpha, remaining: WINDOW },
    { alpha: dimAlpha, remaining: WINDOW - 1.5 * blinkSeconds },
    { alpha: dimAlpha, remaining: blinkSeconds / 2 },
    { alpha: 1, remaining: 0 },
  ])("holds the pack at $alpha with reduced motion, $remaining s of grace left", (row) => {
    expect(graceAlpha(GRACE_BLINK, true, WINDOW, row.remaining)).toBe(row.alpha);
  });

  // Stepped through the window at the walk's 60 Hz, the pack is hidden for about half of it,
  // in runs no longer than a blink, and shown again once it ends.
  it("blinks the pack through the whole window at the blink rate", () => {
    const step = 1 / 60;
    const alphas: number[] = [];
    for (let remaining: number = WINDOW; remaining > 0; remaining -= step) {
      alphas.push(graceAlpha(GRACE_BLINK, false, WINDOW, remaining));
    }
    const hidden = alphas.filter((alpha) => alpha === 0).length / alphas.length;
    expect(hidden).toBeGreaterThan(0.4);
    expect(hidden).toBeLessThan(0.6);
    const runs = alphas.join("").match(/0+/g) ?? [];
    expect(Math.max(...runs.map((run) => run.length))).toBeLessThanOrEqual(
      Math.ceil(blinkSeconds / step),
    );
    expect(graceAlpha(GRACE_BLINK, false, WINDOW, 0)).toBe(1);
  });
});
