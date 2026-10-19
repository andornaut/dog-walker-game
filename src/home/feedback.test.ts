import { describe, expect, it } from "vitest";

import {
  badgePopOffset,
  bobOffset,
  effectFrame,
  FEEDBACK,
  hopOffset,
  loopFrame,
  pressDip,
  settleDelay,
  shakeOffset,
} from "./feedback";

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

describe("hopOffset", () => {
  it("rises up to the hop height and lands", () => {
    expect(hopOffset(false, 1000 + FEEDBACK.hopMs / 4, 1000)).toBe(-FEEDBACK.hopPx);
    expect(hopOffset(false, 1000 + FEEDBACK.hopMs, 1000)).toBe(0);
  });

  it("is still with reduced motion", () => {
    expect(hopOffset(true, 1000 + FEEDBACK.hopMs / 4, 1000)).toBe(0);
  });
});

describe("badgePopOffset", () => {
  it("raises the badge briefly after a pick, except with reduced motion", () => {
    expect(badgePopOffset(false, 1100, 1000)).toBe(-FEEDBACK.badgePopPx);
    expect(badgePopOffset(false, 1000 + FEEDBACK.badgePopMs, 1000)).toBe(0);
    expect(badgePopOffset(true, 1100, 1000)).toBe(0);
  });
});

describe("pressDip", () => {
  it("dips for a moment after the press and while the finger is down", () => {
    expect(pressDip(false, 1100, 1000)).toBe(FEEDBACK.pressDipPx);
    expect(pressDip(false, 1000 + FEEDBACK.pressDipMs, 1000)).toBe(0);
    expect(pressDip(true, 5000, 1000)).toBe(FEEDBACK.pressDipPx);
  });
});

describe("settleDelay", () => {
  it("holds a quick tap's result until the dip is over", () => {
    expect(settleDelay(1050, 1000)).toBe(FEEDBACK.pressDipMs - 50);
    expect(settleDelay(1000, 1000)).toBe(FEEDBACK.pressDipMs);
  });

  it("shows a long press's result on release", () => {
    expect(settleDelay(1000 + FEEDBACK.pressDipMs, 1000)).toBe(0);
    expect(settleDelay(5000, 1000)).toBe(0);
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
  });

  it("holds the first frame with reduced motion or no frames", () => {
    expect(loopFrame(true, [450, 450], 450)).toBe(0);
    expect(loopFrame(false, [], 450)).toBe(0);
  });
});

describe("bobOffset", () => {
  it("bobs a ready button on alternate beats only", () => {
    expect(bobOffset(false, FEEDBACK.bobBeatMs, true)).toBe(-1);
    expect(bobOffset(false, 0, true)).toBe(0);
    expect(bobOffset(false, FEEDBACK.bobBeatMs, false)).toBe(0);
    expect(bobOffset(true, FEEDBACK.bobBeatMs, true)).toBe(0);
  });
});

describe("effectFrame", () => {
  it("steps through the frames, then ends", () => {
    expect(effectFrame(60, 4, 1000, 1000)).toBe(0);
    expect(effectFrame(60, 4, 1185, 1000)).toBe(3);
    expect(effectFrame(60, 4, 1240, 1000)).toBeUndefined();
  });
});
