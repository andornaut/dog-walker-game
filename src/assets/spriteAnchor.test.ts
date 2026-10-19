import { describe, expect, it } from "vitest";

import { spriteAnchor } from "./spriteAnchor";

describe("spriteAnchor", () => {
  it.each([
    {
      anchor: { feetY: 29, opaqueWidth: 20 },
      bounds: { bottom: 30, left: 6, right: 26, top: 4 },
      height: 32,
      name: "a sprite on its last opaque row, as wide as its opaque columns",
    },
    {
      anchor: { feetY: 23, opaqueWidth: 32 },
      bounds: undefined,
      height: 24,
      name: "a blank frame on its bottom row",
    },
  ])("stands $name", ({ anchor, bounds, height }) => {
    expect(spriteAnchor(bounds, 32, height)).toEqual(anchor);
  });
});
