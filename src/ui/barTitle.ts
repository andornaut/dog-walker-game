import type { Rect } from "@andornaut/game-kit/rect";

import type { CloseControl } from "./closeControl";
import { MODAL } from "./modalGeometry";

// Modal titles clear the full left-corner hit area. Pages retain their right-face clearance.
// A title is centred within its available row, or begins at the inset when too wide.
export const BAR_TITLE = { closeGap: MODAL.gap, inset: 0 } as const;

function titleRange(bar: Rect, close: CloseControl | undefined): { left: number; right: number } {
  const leftClose = close !== undefined && close.hit.x <= bar.x;
  return {
    left: leftClose ? Math.max(bar.x, close.hit.x + close.hit.width + BAR_TITLE.closeGap) : bar.x,
    right: close === undefined || leftClose ? bar.x + bar.width : close.x - BAR_TITLE.closeGap,
  };
}

// The title's actual ink room after the relevant corner clearance.
export function barTitleRoom(bar: Rect, close: CloseControl): number {
  const { left, right } = titleRange(bar, close);
  return right - left - BAR_TITLE.inset;
}

// The first ink column, centred in the title's available row.
export function barTitleLeft(bar: Rect, close: CloseControl | undefined, inkWidth: number): number {
  const { left, right } = titleRange(bar, close);
  const clear = Math.floor((right - left - inkWidth) / 2);
  return left + Math.max(clear, BAR_TITLE.inset);
}
