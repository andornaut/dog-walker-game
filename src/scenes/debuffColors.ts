import type { DebuffId } from "../data/types";
import { PALETTE } from "../ui/phaser/palette";

// Each debuff bar's colours the game draws with: the fill, the name, and the face drawn while
// the bar art is missing. The name holds 4.5:1 on the face.
export const DEBUFF_COLOURS: Readonly<
  Record<DebuffId, { face: number; fill: number; name: number }>
> = {
  muddy: { face: PALETTE.brown, fill: PALETTE.tan, name: PALETTE.ink },
  spotlight: { face: PALETTE.blue, fill: PALETTE.yellow, name: PALETTE.white },
  stinky: { face: PALETTE.mauve, fill: PALETTE.pink, name: PALETTE.white },
  zoomies: { face: PALETTE.green, fill: PALETTE.yellow, name: PALETTE.ink },
};
