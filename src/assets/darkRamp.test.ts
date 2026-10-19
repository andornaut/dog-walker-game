import { describe, expect, it } from "vitest";

import { darkerColor, remapDarker } from "./darkRamp";

describe("darkerColor", () => {
  it("moves a palette colour down its ramp one step at a time", () => {
    expect(darkerColor(1, 0xead4aa)).toBe(0xe4a672);
    expect(darkerColor(2, 0xead4aa)).toBe(0xb86f50);
    expect(darkerColor(2, 0x2ce8f5)).toBe(0x124e89);
  });

  it("stops at ink", () => {
    expect(darkerColor(2, 0x3e2731)).toBe(0x181425);
    expect(darkerColor(2, 0x181425)).toBe(0x181425);
  });

  it("snaps a colour off the palette to its nearest palette colour first", () => {
    expect(darkerColor(0, 0xebd5ab)).toBe(0xead4aa);
    expect(darkerColor(2, 0xebd5ab)).toBe(0xb86f50);
  });
});

describe("remapDarker", () => {
  it("replaces each pixel's colour and keeps its alpha", () => {
    const pixels = new Uint8ClampedArray([0xea, 0xd4, 0xaa, 0x80, 0xff, 0xff, 0xff, 0xff]);
    remapDarker(2, pixels);
    expect([...pixels]).toEqual([0xb8, 0x6f, 0x50, 0x80, 0x8b, 0x9b, 0xb4, 0xff]);
  });
});
