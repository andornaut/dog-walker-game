import { describe, expect, it } from "vitest";

import { lostTouches } from "./touches";

describe("lostTouches", () => {
  it("counts touches", () => {
    for (const [, held, onScreen, expected] of [
      ["names the held touches that are no longer on the screen", [3, 4], [4, 9], [3]],
      ["names none while every held touch is still down", [3], [3, 9], []],
    ] as const) {
      expect(lostTouches(held, onScreen)).toEqual(expected);
    }
  });
});
