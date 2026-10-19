// The Endesga 32 colours the scenes draw with, named as in the art mocks.
export const PALETTE = {
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
  red: 0xe43b44,
  rust: 0xbe4a2f,
  slate: 0x5a6988,
  tan: 0xe4a672,
  white: 0xffffff,
  yellow: 0xfee761,
} as const;

// The data files write colours as "#rrggbb".
export function colorFromHex(hex: string): number {
  return Number.parseInt(hex.replace(/^#/, ""), 16);
}
