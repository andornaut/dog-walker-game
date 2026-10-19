import { describe, expect, it } from "vitest";

import {
  badgePopOffset,
  bobOffset,
  effectFrame,
  FEEDBACK,
  hopOffset,
  pressDip,
  pulseFrame,
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

describe("pulseFrame", () => {
  it("alternates frames, and holds the first with reduced motion", () => {
    expect(pulseFrame(false, 0)).toBe(0);
    expect(pulseFrame(false, FEEDBACK.pulseFrameMs)).toBe(1);
    expect(pulseFrame(true, FEEDBACK.pulseFrameMs)).toBe(0);
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
