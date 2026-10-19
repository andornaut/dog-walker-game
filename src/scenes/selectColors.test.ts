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
  const faces = (["cream", "tan"] as const).flatMap((rest) =>
    [false, true].flatMap((selected) => [false, true].map((full) => ({ full, rest, selected }))),
  );

  it.each(faces)(
    "hold text at 4.5:1 on a $rest tile, selected $selected, full $full",
    ({ full, rest, selected }) => {
      const look = selectLook(rest, selected, full);
      expect(contrast(PALETTE[look.text], PALETTE[look.face])).toBeGreaterThanOrEqual(4.5);
    },
  );
});
