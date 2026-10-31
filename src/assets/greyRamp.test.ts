import { describe, expect, it } from "vitest";

import { greyFor, remapToGrey } from "./greyRamp";

const RAMP = [0xffffff, 0xd8d8d8, 0xa4a4a4, 0x727272, 0x4a4a4a, 0x181425];

describe("greyFor", () => {
  // A grey of the ramp stays, or steps down it and stops at its darkest; light colours go to
  // light greys and dark ones to dark greys.
  it("keeps or steps a ramp grey down to its darkest, and maps other colours by lightness", () => {
    const cases: [number, number, number | undefined][] = [
      [0, 0xa4a4a4, 0xa4a4a4],
      [1, 0xa4a4a4, 0x727272],
      [1, 0x181425, 0x181425],
      [0, 0xead4aa, 0xd8d8d8],
      [0, 0x733e39, 0x4a4a4a],
      [1, 0xead4aa, 0xa4a4a4],
    ];
    const wrong = cases.filter(([steps, colour, grey]) => greyFor(RAMP, steps, colour) !== grey);
    expect(wrong).toEqual([]);
  });
});

describe("remapToGrey", () => {
  it("replaces each pixel's colour and keeps its alpha", () => {
    const pixels = new Uint8ClampedArray([0xea, 0xd4, 0xaa, 0x80, 0x73, 0x3e, 0x39, 0xff]);
    remapToGrey(RAMP, 0, pixels);
    expect([...pixels]).toEqual([0xd8, 0xd8, 0xd8, 0x80, 0x4a, 0x4a, 0x4a, 0xff]);
  });
});
