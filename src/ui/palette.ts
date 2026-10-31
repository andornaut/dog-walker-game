// The Endesga 32 colours the scenes draw with.
const ENDESGA = {
  amber: 0xfeae34,
  blue: 0x124e89,
  brown: 0xb86f50,
  cream: 0xead4aa,
  cyan: 0x2ce8f5,
  darkBrown: 0x733e39,
  darkGreen: 0x3e8948,
  darkRed: 0xa22633,
  darkSlate: 0x3a4466,
  forest: 0x265c42,
  green: 0x63c74d,
  grey: 0x8b9bb4,
  ink: 0x181425,
  lightGrey: 0xc0cbdc,
  mauve: 0xb55088,
  navy: 0x262b44,
  orange: 0xf77622,
  pink: 0xf6757a,
  plum: 0x3e2731,
  purple: 0x68386c,
  red: 0xe43b44,
  rust: 0xbe4a2f,
  sky: 0x0099db,
  slate: 0x5a6988,
  tan: 0xe4a672,
  white: 0xffffff,
  yellow: 0xfee761,
} as const;

// The neutral greys, outside Endesga 32 and allowed only for disabled and locked UI: the
// neutral counterparts of lightGrey, grey, slate and darkSlate, with ink as their darkest step.
const NEUTRAL = {
  neutralDarkSlate: 0x4a4a4a,
  neutralGrey: 0xa4a4a4,
  neutralLightGrey: 0xd8d8d8,
  neutralSlate: 0x727272,
} as const;

// Colours outside Endesga 32 and the neutral greys: deepAmber is the background for picked
// portraits and icons; Toronto canopy and violet distinguish neutral home headers. The other Toronto
// colours style effect name pills: dlake on foam for buffs, walnut on tan for Muddy, and lime
// for Zoomies.
const EXTRA = {
  canopy: 0x357a2f,
  deepAmber: 0xfc9124,
  dlake: 0x1d5576,
  foam: 0xa8e0e6,
  lime: 0xb2d94a,
  violet: 0x6d4bb0,
  walnut: 0x2e2019,
} as const;

// Every colour the scenes draw with, by name.
export const PALETTE = { ...ENDESGA, ...NEUTRAL, ...EXTRA } as const;

// The ramp every disabled thing's grey copy is drawn in, lightest first: white, the neutral
// greys, then ink.
export const NEUTRAL_RAMP: readonly number[] = [
  ENDESGA.white,
  NEUTRAL.neutralLightGrey,
  NEUTRAL.neutralGrey,
  NEUTRAL.neutralSlate,
  NEUTRAL.neutralDarkSlate,
  ENDESGA.ink,
];

// The data files write colours as "#rrggbb".
export function colourFromHex(hex: string): number {
  return Number.parseInt(hex.replace(/^#/, ""), 16);
}
