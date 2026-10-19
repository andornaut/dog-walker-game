import { describe, expect, it } from "vitest";

import { DEFAULT_WALKER, PRESET_WALKERS, walkerSpriteKey } from "./walkers";

describe("PRESET_WALKERS", () => {
  it("gives every walker its own sprite and portrait", () => {
    const walkers = Object.values(PRESET_WALKERS);
    expect(new Set(walkers.map(({ spriteKey }) => spriteKey)).size).toBe(walkers.length);
    expect(new Set(walkers.map(({ portraitKey }) => portraitKey)).size).toBe(walkers.length);
  });

  it("keeps the original walker sprite as the default", () => {
    expect(PRESET_WALKERS[DEFAULT_WALKER].spriteKey).toBe("walker");
  });
});

describe("walkerSpriteKey", () => {
  it("is the walker's own sprite once it exists", () => {
    expect(walkerSpriteKey(() => true, "ada")).toBe("walker-girl");
  });

  it("falls back to the default walker's sprite until then", () => {
    expect(walkerSpriteKey((key) => key === "walker", "ben")).toBe("walker");
  });
});
