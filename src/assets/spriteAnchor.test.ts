import { describe, expect, it } from "vitest";

import { spriteAnchor } from "./spriteAnchor";

describe("spriteAnchor", () => {
  it("stands a sprite on its last opaque row, as wide as its opaque columns", () => {
    expect(spriteAnchor({ bottom: 30, left: 6, right: 26, top: 4 }, 32, 32)).toEqual({
      feetY: 29,
      opaqueWidth: 20,
    });
  });

  it("stands a blank frame on its bottom row", () => {
    expect(spriteAnchor(undefined, 32, 24)).toEqual({ feetY: 23, opaqueWidth: 32 });
  });
});
