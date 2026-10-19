import { describe, expect, it } from "vitest";

import { cardNumberForKey, laneDirectionForKey } from "./keyBindings";

describe("laneDirectionForKey", () => {
  it("moves left on the left arrow, A and H", () => {
    for (const key of ["ArrowLeft", "a", "h"]) {
      expect(laneDirectionForKey(key)).toBe(-1);
    }
  });

  it("moves right on the right arrow, D and L", () => {
    for (const key of ["ArrowRight", "d", "l"]) {
      expect(laneDirectionForKey(key)).toBe(1);
    }
  });

  it("matches letters typed with Shift or Caps Lock", () => {
    expect(laneDirectionForKey("A")).toBe(-1);
    expect(laneDirectionForKey("L")).toBe(1);
  });

  it("ignores other keys", () => {
    for (const key of ["ArrowUp", "e", "w", "1", " "]) {
      expect(laneDirectionForKey(key)).toBeUndefined();
    }
  });
});

describe("cardNumberForKey", () => {
  it("picks the card numbered by a digit key", () => {
    expect(cardNumberForKey(3, "1")).toBe(1);
    expect(cardNumberForKey(3, "3")).toBe(3);
  });

  it("ignores digits beyond the cards on offer", () => {
    expect(cardNumberForKey(2, "3")).toBeUndefined();
    expect(cardNumberForKey(3, "0")).toBeUndefined();
  });

  it("ignores keys that are not digits", () => {
    for (const key of ["e", "Enter", " "]) {
      expect(cardNumberForKey(3, key)).toBeUndefined();
    }
  });
});
