import { containsPoint, type Point, type Rect } from "@andornaut/game-kit/rect";

import { SCREEN_LAYOUT } from "../data/screen";
import { HOME_BAR_LAST_FACE, HOME_LAYOUT } from "../home/homeLayout";
import { TITLE_CAP_ROWS } from "../hud/walkHud";
import { MIN_TAP_SIZE } from "../layout/screenLayout";
import { BUTTON_SIZE } from "../ui/buttonGeometry";
import { pageCloseControl } from "../ui/closeControl";
import { rectIndexAt } from "../ui/grid";
import { TEXT_SCALE } from "../ui/textFit";
import type { HelpAction } from "./helpPaging";

const { screen: SCREEN } = SCREEN_LAYOUT;
const { height, width } = SCREEN;

// The home pages' top bar: its height, and the row its buttons' faces and the heading's capitals
// centre on, the upper half of each above it.
const HOME_BAR = HOME_LAYOUT.topBar;
const TOP_BAR = { height: HOME_BAR.height, width, x: 0, y: 0 } as const;
// The picture starts under the bar, its top rule on the bar's last trim row.
const ILLUSTRATION = { height: 236, width, x: 0, y: TOP_BAR.height } as const;
const TITLE_Y = ILLUSTRATION.y + ILLUSTRATION.height + 26;

// The help screen's geometry at the render resolution. A text position is its first line's
// left edge and capitals' top.
// The top bar is the home pages' (HOME_LAYOUT.topBar), its heading's capitals centred on the
// bar's mid row as the home bar's button faces are, and the close control's face where the home
// bar's last face is (Exit's, or Settings' where Exit is hidden), in its 44x44 target in the
// screen's top-right corner.
// The body's lines, at most maxLines of them, are lineHeight apart, its capitals the label gap
// under the lowest row the title's font inks (helpCapDy). The picture is the walk screen's
// width, ruled off a row above and below.
export const HELP_LAYOUT = {
  body: { lineHeight: 18, maxLines: 6, scale: 2, width: 336, x: 12, y: TITLE_Y + 22 },
  close: { ...pageCloseControl(SCREEN), ...HOME_BAR_LAST_FACE },
  // A tap target apart, so each dot's target is its own slot, ending above Previous's and
  // Next's.
  dots: { centreX: width / 2, size: 8, spacing: MIN_TAP_SIZE, y: height - 84 },
  heading: { x: 12, y: HOME_BAR.mid - (TITLE_CAP_ROWS * TEXT_SCALE) / 2 },
  illustration: ILLUSTRATION,
  next: { ...BUTTON_SIZE.compact, x: width / 2 + BUTTON_SIZE.pairGap / 2, y: height - 56 },
  previous: {
    ...BUTTON_SIZE.compact,
    x: width / 2 - BUTTON_SIZE.pairGap / 2 - BUTTON_SIZE.compact.width,
    y: height - 56,
  },
  screen: SCREEN,
  title: { scale: 2, x: 12, y: TITLE_Y },
  topBar: TOP_BAR,
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
  const { centreX, size, spacing, y } = HELP_LAYOUT.dots;
  const left = centreX - (pageCount * spacing) / 2 + (spacing - size) / 2;
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
