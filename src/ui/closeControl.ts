import type { Rect } from "../lib/rect";

// Every page's and overlay's close control: the 20x20 ui-icon-button face 8px in from its
// frame's right edge and 10px down, tapped anywhere in the 44x44 square in that corner.
const FACE = { fromRight: 28, size: 20, top: 10 } as const;
const HIT_SIZE = 44;

export interface CloseControl {
  readonly hit: Rect;
  // The face's top-left corner.
  readonly x: number;
  readonly y: number;
}

// The close control in frame's top-right corner: the screen for a full-screen page, the
// card or panel for an overlay.
export function closeControl(frame: Rect): CloseControl {
  const right = frame.x + frame.width;
  return {
    hit: { height: HIT_SIZE, width: HIT_SIZE, x: right - HIT_SIZE, y: frame.y },
    x: right - FACE.fromRight,
    y: frame.y + FACE.top,
  };
}

// The face's own rect, for a focus ring.
export function closeFace(control: CloseControl): Rect {
  return { height: FACE.size, width: FACE.size, x: control.x, y: control.y };
}
