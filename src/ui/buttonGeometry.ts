// Standard button geometry in game pixels. Text uses the existing fixed font sizes.
export const BUTTON_SIZE = {
  compact: { height: 44, width: 128 },
  icon: { face: 20, glyph: 16, target: 44 },
  pairGap: 12,
  press: 2,
  wide: { height: 44, width: 296 },
} as const;
