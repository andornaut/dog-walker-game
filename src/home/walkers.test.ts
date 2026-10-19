import { describe, expect, it } from "vitest";

import {
  DEFAULT_WALKER,
  PRESET_WALKERS,
  type PresetWalkerId,
  walkerPortraitKey,
  walkerSpriteKey,
  walkerSpriteKeyOf,
} from "./walkers";

describe("walker keys", () => {
  it("give every walker its own sprite and portrait", () => {
    const ids = Object.keys(PRESET_WALKERS) as PresetWalkerId[];
    expect(new Set(ids.map(walkerSpriteKeyOf)).size).toBe(ids.length);
    expect(new Set(ids.map(walkerPortraitKey)).size).toBe(ids.length);
    expect(walkerSpriteKeyOf("ada")).toBe("walker-ada");
    expect(walkerPortraitKey("ben")).toBe("face-walker-ben");
  });

  it("default to the original walker, Casey", () => {
    expect(walkerSpriteKeyOf(DEFAULT_WALKER)).toBe("walker-casey");
  });
});

describe("walkerSpriteKey", () => {
  it("is the walker's own sprite once it exists", () => {
    expect(walkerSpriteKey(() => true, "ada")).toBe("walker-ada");
  });

  it("falls back to the default walker's sprite until then", () => {
    expect(walkerSpriteKey((key) => key === "walker-casey", "ben")).toBe("walker-casey");
  });
});
