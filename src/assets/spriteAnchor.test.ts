import { describe, expect, it } from "vitest";

import { spriteAnchor } from "./spriteAnchor";

describe("spriteAnchor", () => {
  it("stands a sprite on its last opaque row, and a blank frame on its bottom row", () => {
    const cases = [
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
    ];
    for (const { anchor, bounds, height } of cases) {
      expect(spriteAnchor(bounds, 32, height)).toEqual(anchor);
    }
  });
});
