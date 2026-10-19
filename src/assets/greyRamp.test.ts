import { describe, expect, it } from "vitest";

import { GREY_RAMP, greyFor, remapToGrey } from "./greyRamp";

describe("greyFor", () => {
  // A grey of the ramp stays; light colours go to light greys and dark ones to dark greys.
  it.each([...GREY_RAMP.map((grey) => [grey, grey]), [0xead4aa, 0xc0cbdc], [0x3e2731, 0x262b44]])(
    "maps %i to %i",
    (colour, grey) => {
      expect(greyFor(colour)).toBe(grey);
    },
  );
});

describe("remapToGrey", () => {
  it("replaces each pixel's colour and keeps its alpha", () => {
    const pixels = new Uint8ClampedArray([0xea, 0xd4, 0xaa, 0x80, 0x3e, 0x27, 0x31, 0xff]);
    remapToGrey(pixels);
    expect([...pixels]).toEqual([0xc0, 0xcb, 0xdc, 0x80, 0x26, 0x2b, 0x44, 0xff]);
  });
});
