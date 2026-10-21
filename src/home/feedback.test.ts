import { describe, expect, it } from "vitest";

import { FEEDBACK, loopFrame, settleDelay, shakeOffset } from "./feedback";

describe("shakeOffset", () => {
  it("swings within the shake width and settles once the shake is over", () => {
    const offsets = Array.from({ length: 32 }, (_, i) => shakeOffset(false, 1000 + i * 10, 1000));
    expect(offsets.some((offset) => offset !== 0)).toBe(true);
    expect(offsets.every((offset) => Math.abs(offset) <= FEEDBACK.shakePx)).toBe(true);
    expect(shakeOffset(false, 1000 + FEEDBACK.shakeMs, 1000)).toBe(0);
  });

  it("is still with reduced motion or no shake", () => {
    expect(shakeOffset(true, 1100, 1000)).toBe(0);
    expect(shakeOffset(false, 1100, undefined)).toBe(0);
  });
});

describe("settleDelay", () => {
  it("holds a tap until the press dip is over, and shows a press held past it at once", () => {
    for (const [, releasedMs, expected] of [
      ["holds a tap released at once until the dip is over", 1000, FEEDBACK.pressDipMs],
      ["holds a quick tap for the rest of the dip", 1050, FEEDBACK.pressDipMs - 50],
      ["shows a press held for the dip on release", 1000 + FEEDBACK.pressDipMs, 0],
      ["shows a long press's result on release", 5000, 0],
    ] as const) {
      expect(settleDelay(releasedMs, 1000)).toBe(expected);
    }
  });
});

describe("loopFrame", () => {
  it("steps through the frames by their durations and loops", () => {
    const durations = [450, 150, 300];
    expect(loopFrame(false, durations, 0)).toBe(0);
    expect(loopFrame(false, durations, 449)).toBe(0);
    expect(loopFrame(false, durations, 450)).toBe(1);
    expect(loopFrame(false, durations, 600)).toBe(2);
    expect(loopFrame(false, durations, 900)).toBe(0);
    expect(loopFrame(true, durations, 450)).toBe(0);
  });
});
