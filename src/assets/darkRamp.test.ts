import { describe, expect, it } from "vitest";

import { darkerRamp } from "./darkRamp";
import { PALETTE_COLOURS, paletteColour } from "./housePalette";

describe("darkerRamp", () => {
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
    const wrong = cases.filter(([, steps, from, to]) => darkerRamp(steps)(from) !== to);
    expect(wrong).toEqual([]);
  });

  it("keeps every palette colour on the palette and steps each down to ink", () => {
    const ink = paletteColour("ink");
    const wrong = [...PALETTE_COLOURS].filter(
      ([, colour]) =>
        darkerRamp(0)(colour) !== colour || darkerRamp(PALETTE_COLOURS.size)(colour) !== ink,
    );
    expect(wrong).toEqual([]);
  });
});
