import { describe, expect, it } from "vitest";

import { remapToSilhouette } from "./silhouette";

describe("remapToSilhouette", () => {
  it.each([
    ["an opaque pixel", [0xea, 0xd4, 0xaa, 0xff], [0x26, 0x2b, 0x44, 0xff]],
    ["a part-clear pixel, made opaque", [0xff, 0xff, 0xff, 0x40], [0x26, 0x2b, 0x44, 0xff]],
    ["a clear pixel, left clear", [0xea, 0xd4, 0xaa, 0x00], [0xea, 0xd4, 0xaa, 0x00]],
  ])("fills %s", (_, from, to) => {
    const pixels = new Uint8ClampedArray(from);
    remapToSilhouette(0x262b44, pixels);
    expect([...pixels]).toEqual(to);
  });
});
