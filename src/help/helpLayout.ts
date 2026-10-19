import type { Rect } from "../layout/rect";
import type { HelpAction } from "./helpPaging";

export interface Point {
  readonly x: number;
  readonly y: number;
}

// The help screen's geometry at the 360x640 render resolution. A text position is the
// top-left of its first line.
export const HELP_LAYOUT = {
  back: { height: 40, width: 110, x: 8, y: 584 },
  body: { lineHeight: 15, width: 336, x: 12, y: 340 },
  buttonLip: 4,
  close: { height: 24, width: 34, x: 318, y: 8 },
  counter: { x: 12, y: 300 },
  dots: { centerX: 180, hitHeight: 20, size: 8, spacing: 14, y: 562 },
  heading: { x: 12, y: 15 },
  illustration: { height: 236, width: 344, x: 8, y: 48 },
  next: { height: 40, width: 110, x: 242, y: 584 },
  screen: { height: 640, width: 360, x: 0, y: 0 },
  title: { x: 12, y: 314 },
  topBar: { height: 40, width: 360, x: 0, y: 0 },
  topBarEdge: 2,
} as const;

// One dot per page, centred as a row.
export function dotRects(pageCount: number): Rect[] {
  const { centerX, size, spacing, y } = HELP_LAYOUT.dots;
  const left = centerX - (pageCount * spacing) / 2 + (spacing - size) / 2;
  return Array.from({ length: pageCount }, (_, i) => ({
    height: size,
    width: size,
    x: Math.round(left + i * spacing),
    y,
  }));
}

// Each dot's tap target is its whole slot in the row, taller than the dot itself.
export function dotHitRect(dot: Rect): Rect {
  const { hitHeight, size, spacing } = HELP_LAYOUT.dots;
  return {
    height: hitHeight,
    width: spacing,
    x: dot.x - (spacing - size) / 2,
    y: dot.y - (hitHeight - size) / 2,
  };
}

export const rectContains = (rect: Rect, point: Point): boolean =>
  point.x >= rect.x &&
  point.x < rect.x + rect.width &&
  point.y >= rect.y &&
  point.y < rect.y + rect.height;

// The button or dot under a tap, if any.
export function helpActionAt(pageCount: number, point: Point): HelpAction | undefined {
  if (rectContains(HELP_LAYOUT.close, point)) {
    return { kind: "close" };
  }
  if (rectContains(HELP_LAYOUT.back, point)) {
    return { kind: "previous" };
  }
  if (rectContains(HELP_LAYOUT.next, point)) {
    return { kind: "advance" };
  }
  const page = dotRects(pageCount).findIndex((dot) => rectContains(dotHitRect(dot), point));
  return page === -1 ? undefined : { kind: "goTo", page };
}
