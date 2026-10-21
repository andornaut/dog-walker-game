import { describe, expect, it } from "vitest";

import { darkerColor, remapDarker } from "./darkRamp";

describe("darkerColor", () => {
  it("moves a colour down its ramp, no further than ink, from its nearest palette colour", () => {
    const cases: [string, number, number, number][] = [
      ["one step down its ramp", 1, 0xead4aa, 0xe4a672],
      ["two steps down its ramp", 2, 0xead4aa, 0xb86f50],
      ["two steps down another ramp", 2, 0x2ce8f5, 0x124e89],
      ["down to ink", 2, 0x3e2731, 0x181425],
      ["no further than ink", 2, 0x181425, 0x181425],
      ["off the palette to its nearest palette colour", 0, 0xebd5ab, 0xead4aa],
      ["off the palette, then down its ramp", 2, 0xebd5ab, 0xb86f50],
    ];
    const wrong = cases.filter(([, steps, from, to]) => darkerColor(steps, from) !== to);
    expect(wrong).toEqual([]);
  });
});

describe("remapDarker", () => {
  it("replaces each pixel's colour and keeps its alpha", () => {
    const pixels = new Uint8ClampedArray([0xea, 0xd4, 0xaa, 0x80, 0xff, 0xff, 0xff, 0xff]);
    remapDarker(2, pixels);
    expect([...pixels]).toEqual([0xb8, 0x6f, 0x50, 0x80, 0x8b, 0x9b, 0xb4, 0xff]);
  });
});
