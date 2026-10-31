import type { Rect } from "@andornaut/game-kit/rect";

import type { CloseControl } from "./closeControl";
import { MODAL } from "./modalGeometry";

// A title on a bar with the close control at its right end. It is centred between the bar's
// left edge and the close control's face, with as much clear space on its left as between its
// ink's right end and the face, while that space is at least inset. A title too wide for that
// starts its ink inset in from the bar's left, and may run to closeGap short of the face. A bar
// with no close control centres its title across the bar.
export const BAR_TITLE = { closeGap: MODAL.gap, inset: 0 } as const;

// How wide a title's ink may be on the bar: from inset in from its left to closeGap short of
// the close control's face.
export function barTitleRoom(bar: Rect, close: CloseControl): number {
  return close.x - BAR_TITLE.closeGap - (bar.x + BAR_TITLE.inset);
}

// The first column of the title's ink, for ink inkWidth wide, close undefined for a bar with no
// close control.
export function barTitleLeft(bar: Rect, close: CloseControl | undefined, inkWidth: number): number {
  const right = close === undefined ? bar.x + bar.width : close.x - BAR_TITLE.closeGap;
  const clear = Math.floor((right - bar.x - inkWidth) / 2);
  return bar.x + Math.max(clear, BAR_TITLE.inset);
}
