import { describe, expect, it } from "vitest";

import { choiceFull, selectLook } from "./selection";

describe("selectLook", () => {
  it("turns a selected face yellow with plum text, full or not", () => {
    for (const full of [false, true]) {
      expect(selectLook("cream", true, full)).toEqual({
        box: "amber",
        face: "yellow",
        selected: true,
        text: "plum",
      });
      expect(selectLook("tan", true, full).face).toBe("yellow");
    }
  });

  it("keeps an unselected face at rest while the choice has room", () => {
    expect(selectLook("cream", false, false)).toMatchObject({ box: "tan", face: "cream" });
    expect(selectLook("tan", false, false)).toMatchObject({ box: "brown", face: "tan" });
  });

  it("darkens an unselected face one ramp step once the choice is full", () => {
    expect(selectLook("cream", false, true)).toMatchObject({
      box: "brown",
      face: "tan",
      text: "plum",
    });
    expect(selectLook("tan", false, true)).toMatchObject({
      box: "darkBrown",
      face: "brown",
      text: "ink",
    });
  });
});

describe("choiceFull", () => {
  it("is full once the picks reach the capacity", () => {
    expect(choiceFull(2, 3)).toBe(false);
    expect(choiceFull(3, 3)).toBe(true);
    expect(choiceFull(0, 1)).toBe(false);
    expect(choiceFull(1, 1)).toBe(true);
  });
});
