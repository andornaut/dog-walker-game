import palette from "../../shared/palette.json";

// The house palette as art writes it (shared/palette.json, from art/tools/pixel.py): every
// colour by name, as RGB, and the colour one step down its ramp. Ink is the darkest step and
// stays ink.

export const PALETTE_COLORS: ReadonlyMap<string, number> = new Map(
  Object.entries(palette).map(([name, { hex }]) => [name, Number.parseInt(hex, 16)]),
);

// The colour a palette name names; an unknown name throws, so a typo in art's tables fails
// on load.
export function paletteColor(name: string): number {
  const color = PALETTE_COLORS.get(name);
  if (color === undefined) {
    throw new Error(`No palette colour named ${name}`);
  }
  return color;
}

export const ONE_STEP_DARKER: ReadonlyMap<number, number> = new Map(
  Object.values(palette).map(({ darker, hex }) => [Number.parseInt(hex, 16), paletteColor(darker)]),
);
