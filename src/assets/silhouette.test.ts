import { describe, expect, it } from "vitest";

import { remapToSilhouette } from "./silhouette";

describe("remapToSilhouette", () => {
  it("fills opaque and part-clear pixels with the colour, and leaves clear ones", () => {
    const cases: [string, number[], number[]][] = [
      ["an opaque pixel", [0xea, 0xd4, 0xaa, 0xff], [0x26, 0x2b, 0x44, 0xff]],
      ["a part-clear pixel, made opaque", [0xff, 0xff, 0xff, 0x40], [0x26, 0x2b, 0x44, 0xff]],
      ["a clear pixel, left clear", [0xea, 0xd4, 0xaa, 0x00], [0xea, 0xd4, 0xaa, 0x00]],
    ];
    for (const [name, from, to] of cases) {
      const pixels = new Uint8ClampedArray(from);
      remapToSilhouette(0x262b44, pixels);
      expect([...pixels], name).toEqual(to);
    }
  });
});
