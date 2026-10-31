import { MODAL_CONTENT } from "@andornaut/game-kit/modalLayout";

import { BUTTON_SIZE } from "./buttonGeometry";

const GROUP_GAP = 8;

// Modal spacing in base pixels; action height and font roles retain their approved sizes.
export const MODAL = {
  closeInset: 6,
  gap: GROUP_GAP,
  header: BUTTON_SIZE.icon.target + GROUP_GAP,
  margin: 16,
  pad: MODAL_CONTENT.padding,
  rowGap: 4,
} as const;
