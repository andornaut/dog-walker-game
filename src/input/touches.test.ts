import { describe, expect, it } from "vitest";

import { lostTouches } from "./touches";

describe("lostTouches", () => {
  it.each([
    ["names the held touches that are no longer on the screen", [3, 4], [4, 9], [3]],
    ["names none while every held touch is still down", [3], [3, 9], []],
  ])("%s", (_name, held, onScreen, expected) => {
    expect(lostTouches(held, onScreen)).toEqual(expected);
  });
});
