import { SCREEN_CONFIG } from "../data/screen";
import { closeControl } from "../layout/closeControl";
import { rectIndexAt } from "../layout/grid";
import { containsPoint, type Point, type Rect } from "../layout/rect";
import { screenLayout } from "../layout/screenLayout";
import type { HelpAction } from "./helpPaging";

export type { Point } from "../layout/rect";

const { height, width } = SCREEN_CONFIG;

// The smallest tap target, in render pixels: at least 44 CSS px on a phone 360 CSS px wide.
export const MIN_TAP_SIZE = 44;

// The help screen's geometry at the render resolution. A text position is the top-left of
// its first line.
// The body's lines, at most maxLines of them, are lineHeight apart. The picture is the walk
// screen's width, ruled off a row above and below.
export const HELP_LAYOUT = {
  body: { lineHeight: 18, maxLines: 6, scale: 2, width: 336, x: 12, y: 334 },
  close: closeControl({ height, width, x: 0, y: 0 }),
  // A tap target apart, so each dot's target is its own slot, ending above Previous's and
  // Next's.
  dots: { centerX: width / 2, size: 8, spacing: MIN_TAP_SIZE, y: height - 84 },
  heading: { x: 12, y: 15 },
  illustration: { height: 236, width, x: 0, y: 48 },
  next: { height: MIN_TAP_SIZE, width: 110, x: 242, y: height - 56 },
  previous: { height: MIN_TAP_SIZE, width: 110, x: 8, y: height - 56 },
  screen: { height, width, x: 0, y: 0 },
  title: { scale: 2, x: 12, y: 310 },
  topBar: screenLayout(SCREEN_CONFIG).topBar,
  topBarEdge: 2,
} as const;

// The art's rect grown about its centre to at least MIN_TAP_SIZE each way, then shifted back
// onto the screen, so small art keeps a full-size target.
export function tapRect(art: Rect): Rect {
  const grow = (start: number, size: number, limit: number) => {
    const grown = Math.max(size, MIN_TAP_SIZE);
    const from = start - (grown - size) / 2;
    return { from: Math.min(Math.max(0, from), limit - grown), grown };
  };
  const across = grow(art.x, art.width, width);
  const down = grow(art.y, art.height, height);
  return { height: down.grown, width: across.grown, x: across.from, y: down.from };
}

// The close control's tap target.
export const CLOSE_HIT_RECT = HELP_LAYOUT.close.hit;

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

// The button or dot under a tap, if any.
export function helpActionAt(pageCount: number, { x, y }: Point): HelpAction | undefined {
  if (containsPoint(CLOSE_HIT_RECT, x, y)) {
    return { kind: "close" };
  }
  if (containsPoint(tapRect(HELP_LAYOUT.previous), x, y)) {
    return { kind: "previous" };
  }
  if (containsPoint(tapRect(HELP_LAYOUT.next), x, y)) {
    return { kind: "advance" };
  }
  const page = rectIndexAt(dotRects(pageCount).map(tapRect), x, y);
  return page === undefined ? undefined : { kind: "goTo", page };
}
