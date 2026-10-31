import type { Rect } from "@andornaut/game-kit/rect";

import { BUTTON_SIZE } from "./buttonGeometry";

// Every page's and overlay's close control: the 20x20 ui-icon-button face in its frame's
// top-right corner, tapped anywhere in the 44x44 square in that corner. On a card or panel the
// face sits 16px in from the right edge and 16px down; on a full-screen page, 7px in and 9px
// down unless the page gives its own top.
const FACE_SIZE = BUTTON_SIZE.icon.face;
const CARD_FACE = { right: 16, top: 16 } as const;
const PAGE_FACE = { right: 7, top: 9 } as const;
const HIT_SIZE = BUTTON_SIZE.icon.target;

export interface CloseControl {
  readonly hit: Rect;
  // The face's top-left corner.
  readonly x: number;
  readonly y: number;
}

function placeClose(frame: Rect, right: number, top: number): CloseControl {
  const frameRight = frame.x + frame.width;
  return {
    hit: { height: HIT_SIZE, width: HIT_SIZE, x: frameRight - HIT_SIZE, y: frame.y },
    x: frameRight - right - FACE_SIZE,
    y: frame.y + top,
  };
}

// The close control in a card's or panel's top-right corner.
export function closeControl(frame: Rect): CloseControl {
  return placeClose(frame, CARD_FACE.right, CARD_FACE.top);
}

// The close control in a full-screen page's top-right corner, its face top px down.
export function pageCloseControl(screen: Rect, top: number = PAGE_FACE.top): CloseControl {
  return placeClose(screen, PAGE_FACE.right, top);
}

// The face's own rect, for a focus ring.
export function closeFace(control: CloseControl): Rect {
  return { height: FACE_SIZE, width: FACE_SIZE, x: control.x, y: control.y };
}
