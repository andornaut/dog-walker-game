import { describe, expect, it } from "vitest";

import { buttonIcon, PAUSE_BUTTON, SOUND_BUTTON, topBarButtonAt } from "./topBar";

describe("topBarButtonAt", () => {
  it("finds the sound and pause buttons over their 44px hit areas", () => {
    expect(topBarButtonAt(124, 0)).toBe("sound");
    expect(topBarButtonAt(167, 43)).toBe("sound");
    expect(topBarButtonAt(168, 0)).toBe("pause");
    expect(topBarButtonAt(211, 43)).toBe("pause");
  });

  it("reaches 4px into the road and no further", () => {
    expect(topBarButtonAt(150, 43)).toBe("sound");
    expect(topBarButtonAt(150, 44)).toBeUndefined();
  });

  it("finds no button elsewhere on the bar", () => {
    expect(topBarButtonAt(60, 20)).toBeUndefined();
    expect(topBarButtonAt(300, 20)).toBeUndefined();
  });

  it("keeps both hit areas at least 44px square, without overlapping", () => {
    for (const { hit } of [SOUND_BUTTON, PAUSE_BUTTON]) {
      expect(Math.min(hit.width, hit.height)).toBeGreaterThanOrEqual(44);
    }
    expect(SOUND_BUTTON.hit.x + SOUND_BUTTON.hit.width).toBeLessThanOrEqual(PAUSE_BUTTON.hit.x);
  });
});

describe("buttonIcon", () => {
  it("puts the icon at +2,+1 on the face, and 2px lower while pressed", () => {
    expect(buttonIcon(PAUSE_BUTTON, false)).toEqual({ x: 172, y: 11 });
    expect(buttonIcon(PAUSE_BUTTON, true)).toEqual({ x: 172, y: 13 });
  });
});
