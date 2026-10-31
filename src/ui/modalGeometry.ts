import { BUTTON_SIZE } from "./buttonGeometry";

// Modal spacing in base pixels; action height and font roles retain their approved sizes.
export const MODAL = {
  gap: 8,
  header: 16 + BUTTON_SIZE.icon.face + 8,
  margin: 16,
  pad: 16,
  rowGap: 4,
} as const;
