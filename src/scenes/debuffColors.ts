import { PALETTE } from "./palette";

// Each debuff bar's colours the game draws with: the fill, the name, and the face drawn while
// the bar art is missing. The name holds 4.5:1 on the face.
export const DEBUFF_COLORS: Readonly<Record<string, { face: number; fill: number; name: number }>> =
  {
    muddy: { face: PALETTE.brown, fill: PALETTE.tan, name: PALETTE.ink },
    stinky: { face: PALETTE.mauve, fill: PALETTE.pink, name: PALETTE.white },
    zoomies: { face: PALETTE.green, fill: PALETTE.yellow, name: PALETTE.ink },
  };
export const DEBUFF_FALLBACK = { face: PALETTE.slate, fill: PALETTE.cream, name: PALETTE.white };
