import { describe, expect, it } from "vitest";

import { GREY_RAMP, greyFor, remapToGrey } from "./greyRamp";

describe("greyFor", () => {
  it("keeps a grey of the ramp as it is", () => {
    for (const grey of GREY_RAMP) {
      expect(greyFor(grey)).toBe(grey);
    }
  });

  it("maps light colours to light greys and dark colours to dark greys", () => {
    expect(greyFor(0xead4aa)).toBe(0xc0cbdc);
    expect(greyFor(0x3e2731)).toBe(0x262b44);
  });
});

describe("remapToGrey", () => {
  it("replaces each pixel's colour and keeps its alpha", () => {
    const pixels = new Uint8ClampedArray([0xea, 0xd4, 0xaa, 0x80, 0x3e, 0x27, 0x31, 0xff]);
    remapToGrey(pixels);
    expect([...pixels]).toEqual([0xc0, 0xcb, 0xdc, 0x80, 0x26, 0x2b, 0x44, 0xff]);
  });
});
