import { describe, expect, it } from "vitest";

import { selectLook } from "../home/selection";
import { PALETTE } from "./palette";

// WCAG relative luminance and contrast ratio.
function luminance(color: number): number {
  const [r, g, b] = [16, 8, 0].map((shift) => {
    const channel = ((color >> shift) & 0xff) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: number, b: number): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}

describe("selected-state colours", () => {
  it("hold text at 4.5:1 on every face a tile can show", () => {
    for (const rest of ["cream", "tan"] as const) {
      for (const selected of [false, true]) {
        for (const full of [false, true]) {
          const look = selectLook(rest, selected, full);
          expect(contrast(PALETTE[look.text], PALETTE[look.face])).toBeGreaterThanOrEqual(4.5);
        }
      }
    }
  });

  it("would fail plum on a darkened tan face, which is why it takes ink", () => {
    expect(contrast(PALETTE.plum, PALETTE.brown)).toBeLessThan(4.5);
  });
});
