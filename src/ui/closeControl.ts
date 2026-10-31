import type { Rect } from "@andornaut/game-kit/rect";

import { BUTTON_SIZE } from "./buttonGeometry";
import { MODAL } from "./modalGeometry";

// Modal close faces sit 6px inside the top-left corner, within a 44px corner target.
// Full pages keep their separate top-right control placement.
const FACE_SIZE = BUTTON_SIZE.icon.face;
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

// The close control in a card's or panel's top-left corner.
export function closeControl(frame: Rect): CloseControl {
  return {
    hit: { height: HIT_SIZE, width: HIT_SIZE, x: frame.x, y: frame.y },
    x: frame.x + MODAL.closeInset,
    y: frame.y + MODAL.closeInset,
  };
}

// The close control in a full-screen page's top-right corner, its face top px down.
export function pageCloseControl(screen: Rect, top: number = PAGE_FACE.top): CloseControl {
  return placeClose(screen, PAGE_FACE.right, top);
}

// The face's own rect, for a focus ring.
export function closeFace(control: CloseControl): Rect {
  return { height: FACE_SIZE, width: FACE_SIZE, x: control.x, y: control.y };
}
