import { describe, expect, it } from "vitest";

import { lostTouches } from "./touches";

describe("lostTouches", () => {
  it("names the held touches that are no longer on the screen", () => {
    expect(lostTouches([3, 4], [4, 9])).toEqual([3]);
  });

  it("names none while every held touch is still down", () => {
    expect(lostTouches([3], [3, 9])).toEqual([]);
    expect(lostTouches([], [9])).toEqual([]);
  });
});
