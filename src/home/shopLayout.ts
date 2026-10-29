import type { Rect } from "@andornaut/game-kit/rect";

import { DOG_SLOTS } from "../data/dogSlots";
import { TITLE_CAP_ROWS } from "../hud/walkHud";
import { closeControl } from "../ui/closeControl";
import { type FontMetrics, helpCapDy, inkRowsFromCapTop } from "../ui/fontMetrics";
import { type ScrollbarRects, scrollbarRects } from "../ui/scrollbar";
import { SELECT_OUTSET } from "../ui/selection";
import { TEXT_SCALE, TEXT_STYLE } from "../ui/textFit";

// The Pet shop page under the home screen's top bar, which stays in view with the bank:
// a card with its title band and close control, the Dogs and Gear tabs, and each tab's
// lists. Rows are hit areas at least 44 tall; tabs draw 28 tall in a 44-tall hit area. The
// lists scroll in the list area under the tabs, laid out here as they sit scrolled to the top.
// The Logbook wears the same page (src/home/statsLayout.ts).
const PANEL = { height: 512, width: 352, x: 4, y: 44 };
const ROW_X = PANEL.x + 12;
// Rows run to the tabs' right edge, or with a scrollbar stop 6px short of its track.
const ROW_WIDTH = 328;
const ROW_SCROLL_WIDTH = 314;
const TAB = { drawHeight: 28, drawY: 85, gap: 8, height: 44, span: ROW_WIDTH, x: ROW_X, y: 77 };
// A selected tab's ui-select frame and its shadow end SELECT_OUTSET under its face. TAB_GAP clear
// rows lie between the selected tab and the title band over it, and between it and the list.
const TAB_BOTTOM = TAB.drawY + TAB.drawHeight + SELECT_OUTSET;
const TAB_GAP = 6;
// The list area: from TAB_GAP under the tabs to the card's inner edge, from the card's 8px frame
// to 2px short of the scrollbar's track, or with no scrollbar to the card's frame.
const LIST_Y = TAB_BOTTOM + TAB_GAP;
const LIST = {
  height: PANEL.y + PANEL.height - 8 - LIST_Y,
  width: 322,
  x: PANEL.x + 8,
  y: LIST_Y,
};
const LIST_UNSCROLLED = { ...LIST, width: PANEL.width - 16 };
// The message's plate across the tabs' span at the list's top. Each tab's first heading takes
// the plate's strip, its capitals centred on it as the message's are, and the first rows start
// TAB_GAP under the plate, so a message never covers a row.
const PLATE = { height: 28, width: TAB.span, x: TAB.x, y: LIST.y };
const FIRST_HEADING_Y = PLATE.y + Math.floor((PLATE.height - TITLE_CAP_ROWS * TEXT_SCALE) / 2);
const FIRST_ROWS_Y = PLATE.y + PLATE.height + TAB_GAP;
// Every heading sits in a strip like the first's: HEADING_TO_ROWS above its rows, and
// ROWS_TO_HEADING under the rows before it, as far as the first heading is under the tabs. The
// dogs follow however many slots there are.
const HEADING_TO_ROWS = FIRST_ROWS_Y - FIRST_HEADING_Y;
const ROWS_TO_HEADING = FIRST_HEADING_Y - TAB_BOTTOM;
const SLOT_HEADING_Y = FIRST_HEADING_Y;
const SLOT_ROWS = { height: 48, pitch: 54, y: FIRST_ROWS_Y };
const DOG_HEADING_Y =
  SLOT_ROWS.y + (DOG_SLOTS.length - 1) * SLOT_ROWS.pitch + SLOT_ROWS.height + ROWS_TO_HEADING;

export const SHOP_LAYOUT = {
  close: closeControl(PANEL),
  // The Dogs tab: the slot heading and a row for every slot, then the dog heading and rows.
  dogs: {
    dogHeadingY: DOG_HEADING_Y,
    dogRows: { ...SLOT_ROWS, y: DOG_HEADING_Y + HEADING_TO_ROWS },
    slotHeadingY: SLOT_HEADING_Y,
    slotRows: SLOT_ROWS,
  },
  // The Gear tab: its heading and rows.
  gear: {
    headingY: FIRST_HEADING_Y,
    rows: { height: 50, pitch: 60, y: FIRST_ROWS_Y },
  },
  // Headings sit on the card at the rows' left, a note right-aligned at their right.
  headingX: ROW_X,
  // The headings and rows scroll in rect, masked to it, with padBottom of card under the last
  // row when scrolled to the bottom; a list with no scrollbar is masked to unscrolledRect. A
  // page key moves the list its height less pageOverlap, keeping the row at the edge in view.
  // firstHeadingY is where each tab's first heading puts its capitals.
  list: {
    firstHeadingY: FIRST_HEADING_Y,
    padBottom: 8,
    pageOverlap: 48,
    rect: LIST,
    unscrolledRect: LIST_UNSCROLLED,
  },
  // The last tap's message: one line on the ui-hint plate across the tabs' span at the list's
  // top, over the first heading, from textDx inside the plate's left and right edges, its
  // capitals centred on the plate. The plate's frame is frame pixels thick.
  message: {
    frame: 3,
    plate: PLATE,
    textDx: 10,
  },
  panel: PANEL,
  // In a row: the 36x36 art box and the art in it, the badge over the row's top-left
  // corner, the name and line, and the price plate or OWNED (ownedDx left of the tick's right
  // edge) plateInset inside the right edge, the name and line keeping textGap clear of it. A
  // row is width wide, or scrollWidth beside a scrollbar.
  row: {
    art: 2,
    badge: { dx: -2, dy: -3 },
    box: { dx: 4, size: 36 },
    ownedDx: 20,
    plateInset: 6,
    scrollWidth: ROW_SCROLL_WIDTH,
    textDx: 46,
    textGap: 6,
    width: ROW_WIDTH,
    x: ROW_X,
  },
  // Beside a list longer than the view: a trackWidth-wide track at x, as tall as the list area,
  // and in it a thumbWidth-wide thumb thumbInset inside the track's edges, at least thumbMin
  // tall.
  scrollbar: { thumbInset: 1, thumbMin: 16, thumbWidth: 6, trackWidth: 8, x: 336 },
  // The tabs split span, the rows' width from x, evenly with gap between them, each a hit
  // area height tall at y with its face drawHeight tall at drawY.
  tab: TAB,
} as const;

// The message at 2x on one line inside its plate.
export const SHOP_MESSAGE_FIT = {
  room: PLATE.width - 2 * SHOP_LAYOUT.message.textDx,
  style: TEXT_STYLE,
} as const;

// The top of the message's capitals at scale, centred on its plate.
export function shopMessageCapTop(body: FontMetrics, scale: number): number {
  const { plate } = SHOP_LAYOUT.message;
  return plate.y + Math.floor((plate.height - body.capHeight * scale) / 2);
}

// The bottom of a list of count rows, with the list area's padding under it. A list with no
// rows keeps one row's room, for the line saying so.
export function shopListBottom(
  spec: { height: number; pitch: number; y: number },
  count: number,
): number {
  return spec.y + (Math.max(1, count) - 1) * spec.pitch + spec.height + SHOP_LAYOUT.list.padBottom;
}

// The shop list's scrollbar (scrollbarRects), or null for a list that fits.
export function shopScrollbar(max: number, y: number): ScrollbarRects | null {
  return scrollbarRects(SHOP_LAYOUT.scrollbar, LIST, max, y);
}

// The open list's area (its mask and hit area), its rows' width and its heading note's right
// edge, by whether it scrolls: a list with no scrollbar runs to the tabs' right edge.
export function shopListFrame(scrolls: boolean): {
  headingRight: number;
  rect: Rect;
  rowWidth: number;
} {
  const { list, row } = SHOP_LAYOUT;
  const rowWidth = scrolls ? row.scrollWidth : row.width;
  return {
    headingRight: row.x + rowWidth,
    rect: scrolls ? list.rect : list.unscrolledRect,
    rowWidth,
  };
}

// The hit areas of count tabs, left to right, splitting the tab span evenly; the last takes
// any odd pixels. Each one's face is drawHeight tall at drawY inside it.
export function shopTabRects(count: number): Rect[] {
  const { gap, height, span, x, y } = SHOP_LAYOUT.tab;
  const width = Math.floor((span - (count - 1) * gap) / count);
  return Array.from({ length: count }, (_, i) => {
    const left = x + i * (width + gap);
    return { height, width: i === count - 1 ? x + span - left : width, x: left, y };
  });
}

export function shopTabFace(hit: Rect): Rect {
  const { drawHeight, drawY } = SHOP_LAYOUT.tab;
  return { ...hit, height: drawHeight, y: drawY };
}

// Rows width wide from top, pitch apart.
export function rowRects(
  width: number,
  spec: { height: number; pitch: number; y: number },
  count: number,
): Rect[] {
  const { x } = SHOP_LAYOUT.row;
  return Array.from({ length: count }, (_, i) => ({
    height: spec.height,
    width,
    x,
    y: spec.y + i * spec.pitch,
  }));
}

// The capitals' tops of a row's name and line, from the row's middle row: the line
// LABEL_HELP_GAP clear rows under the body font's lowest ink (helpCapDy), the pair from the
// name's capitals to the line's lowest ink centred down the row.
export function shopRowTextTops(body: FontMetrics): { line: number; name: number } {
  const ink = inkRowsFromCapTop(body) * 2;
  const name = -Math.floor((helpCapDy(body, 2) + ink) / 2);
  return { line: name + helpCapDy(body, 2), name };
}

// How wide the name and line of a row rowWidth wide may be beside the price plate or OWNED,
// rightWidth wide from its left edge to the row's right edge less plateInset.
export function shopRowTextRoom(rowWidth: number, rightWidth: number): number {
  const { plateInset, textDx, textGap } = SHOP_LAYOUT.row;
  return rowWidth - plateInset - rightWidth - textGap - textDx;
}
