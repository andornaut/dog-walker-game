import type { GameObjects } from "phaser";

import { type EffectNameKind, pillKind } from "../hud/effectNames";
import { fillCutRect } from "../ui/phaser/draw";
import { PALETTE } from "../ui/phaser/palette";
import { labelPills } from "../ui/phaser/pixelText";

type PaletteName = keyof typeof PALETTE;

// Each effect's name pill: a pale pill behind a dark name, so the pair reads the same on cream,
// ink or the walk bar, the name at 4.5:1 or better on its pill. A change a debuff zeroed, as
// Stinky's "+$0" tip, is drawn in that debuff's pill.
export const EFFECT_PILLS: Readonly<
  Record<EffectNameKind, { readonly name: PaletteName; readonly pill: PaletteName }>
> = {
  buff: { name: "dlake", pill: "foam" },
  muddy: { name: "walnut", pill: "tan" },
  spotlight: { name: "navy", pill: "yellow" },
  stinky: { name: "plum", pill: "pink" },
  zoomies: { name: "forest", pill: "lime" },
};

export function pillColours(kind: EffectNameKind): { name: number; pill: number } {
  const { name, pill } = EFFECT_PILLS[kind];
  return { name: PALETTE[name], pill: PALETTE[pill] };
}

// A disabled item's pills, such as on a card the player cannot afford: neutral, the name left in
// the label's own grey.
const GREY_PILL: PaletteName = "neutralLightGrey";

// Draws the pill behind each effect's name the labels' text sets in one (hud/effectNames.ts),
// under its label in the label's parent, and the name in its colour, or grey for a disabled
// item. Call it once the labels' text is set, fitted and placed. Returns the pills drawn, which go
// when their label does.
export function addNamePills(
  labels: readonly GameObjects.BitmapText[],
  grey = false,
): GameObjects.Graphics[] {
  return labels.flatMap((label) => {
    label.setCharacterTint(0, -1);
    const pills = labelPills(label);
    if (pills.length === 0) {
      return [];
    }
    const g = label.scene.add.graphics();
    for (const { index, name, rect } of pills) {
      const kind = pillKind(index);
      if (kind === undefined) {
        continue;
      }
      if (grey) {
        fillCutRect(g, PALETTE[GREY_PILL], rect, label.scaleX);
        continue;
      }
      const colours = pillColours(kind);
      fillCutRect(g, colours.pill, rect, label.scaleX);
      name.forEach((i) => label.setCharacterTint(i, 1, undefined, colours.name));
    }
    const parent = label.parentContainer;
    if (parent === null) {
      g.setDepth(label.depth);
      label.scene.children.moveBelow(g as GameObjects.GameObject, label);
    } else {
      parent.addAt(g, parent.getIndex(label));
    }
    label.once("destroy", () => g.destroy());
    return [g];
  });
}
