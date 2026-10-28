import type { ChangeLabel } from "../hud/hudView";
import { PALETTE } from "../ui/phaser/palette";

// A change label's text colour on its cream chip, each at 4.5:1 or better: a gain in forest, and
// a loss, or a plus amount a debuff zeroed (a Stinky tip's "+$0"), in dark red.
export const CHANGE_COLOURS = { gain: PALETTE.forest, loss: PALETTE.darkRed } as const;

export function changeLabelColour(label: Pick<ChangeLabel, "gain">): number {
  return label.gain ? CHANGE_COLOURS.gain : CHANGE_COLOURS.loss;
}
