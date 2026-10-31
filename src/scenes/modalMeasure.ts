import type { Scene } from "phaser";

import { PALETTE } from "../ui/palette";
import { type FontRole, labelInkWidth, withProbe } from "../ui/phaser/pixelText";
import { TEXT_SCALE } from "../ui/textFit";

// Measure actual game glyph ink without changing its role's font size.
export function modalTextWidth(scene: Scene, font: FontRole, values: readonly string[]): number {
  return withProbe(scene, { colour: PALETTE.plum, font, scale: TEXT_SCALE }, (probe) => {
    const widthOf = labelInkWidth(probe);
    return Math.max(0, ...values.map((value) => widthOf({ scale: TEXT_SCALE }, value)));
  });
}
