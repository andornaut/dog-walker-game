import { DOG_SLOTS } from "../data/dogSlots";
import type { Rect } from "../lib/rect";
import { closeControl } from "../ui/closeControl";
import type { FontMetrics } from "../ui/fontMetrics";
import { scrollbarRects } from "../ui/scrollbar";
import { TEXT_FIT_STYLES } from "../ui/textFit";
import { HOME_LAYOUT } from "./homeLayout";
import { SHOP_TABS } from "./shop";

// The Pet shop page under the home screen's top bar, which stays in view with the bank:
// a card with its title band and close control, the Dogs and Gear tabs, and each tab's
// lists. Rows are hit areas at least 44 tall; tabs draw 28 tall in a 44-tall hit area. The
// lists scroll in the list area under the tabs, laid out here as they sit scrolled to the top.
const PANEL = { height: 512, width: 352, x: 4, y: 44 };
const ROW_X = PANEL.x + 12;
// Rows run to the tabs' right edge, or with a scrollbar stop 6px short of its track.
const ROW_WIDTH = 328;
const ROW_SCROLL_WIDTH = 314;
// The list area: from under the tabs to the card's inner edge, from the card's 8px frame to
// 2px short of the scrollbar's track, or with no scrollbar to the card's frame.
const LIST = { height: 431, width: 322, x: PANEL.x + 8, y: 117 };
const LIST_UNSCROLLED = { ...LIST, width: PANEL.width - 16 };
// The Dogs tab's lists: each heading HEADING_TO_ROWS above its first row, and the dog heading
// ROWS_TO_HEADING under the last slot row, so the dogs follow however many slots there are.
const HEADING_TO_ROWS = 16;
const ROWS_TO_HEADING = 12;
const SLOT_HEADING_Y = 123;
const SLOT_ROWS = { height: 42, pitch: 48, y: SLOT_HEADING_Y + HEADING_TO_ROWS };
const DOG_HEADING_Y =
  SLOT_ROWS.y + (DOG_SLOTS.length - 1) * SLOT_ROWS.pitch + SLOT_ROWS.height + ROWS_TO_HEADING;

export const SHOP_LAYOUT = {
  // The detail card's title band, the title from titleX.
  band: { ...HOME_LAYOUT.card.band, titleX: 16 },
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
    headingY: 123,
    rows: { height: 44, pitch: 54, y: 141 },
  },
  // Headings sit on the card at the rows' left, a note right-aligned at their right.
  headingX: ROW_X,
  // The headings and rows scroll in rect, masked to it, with padBottom of card under the last
  // row when scrolled to the bottom; a list with no scrollbar is masked to unscrolledRect. A
  // page key moves the list its height less pageOverlap, keeping the row at the edge in view.
  list: { padBottom: 8, pageOverlap: 48, rect: LIST, unscrolledRect: LIST_UNSCROLLED },
  // The last tap's message: one line on the ui-hint plate across the list's top, over the rows,
  // from textDx inside the plate's left and right edges, its capitals centred on the plate.
  // The plate's frame is frame pixels thick.
  message: {
    frame: 3,
    plate: { height: 28, width: LIST.width, x: LIST.x, y: LIST.y },
    textDx: 10,
  },
  panel: PANEL,
  // In a row: the 36x36 art box and the art in it, the padlock over the row's top-left
  // corner, the name and line, and the price plate or OWNED (ownedDx left of the tick's right
  // edge) plateInset inside the right edge, the name and line keeping textGap clear of it. A
  // row is width wide, or scrollWidth beside a scrollbar.
  row: {
    art: 2,
    box: { dx: 4, size: 36 },
    lock: { dx: -2, dy: -3 },
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
  tab: { drawHeight: 28, drawY: 85, gap: 8, height: 44, width: 160, x: ROW_X, y: 77 },
} as const;

// The message on one line inside its plate, in the first of TEXT_FIT_STYLES whose ink fits.
export const SHOP_MESSAGE_FIT = {
  room: LIST.width - 2 * SHOP_LAYOUT.message.textDx,
  styles: TEXT_FIT_STYLES,
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
export function shopScrollbar(max: number, y: number): { thumb: Rect; track: Rect } | null {
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

// A tab's hit area; its face is drawHeight tall at drawY inside it.
export function shopTabRects(): Rect[] {
  const { gap, height, width, x, y } = SHOP_LAYOUT.tab;
  return SHOP_TABS.map((_, i) => ({ height, width, x: x + i * (width + gap), y }));
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

// How wide the name and line of a row rowWidth wide may be beside the price plate or OWNED,
// rightWidth wide from its left edge to the row's right edge less plateInset.
export function shopRowTextRoom(rowWidth: number, rightWidth: number): number {
  const { plateInset, textDx, textGap } = SHOP_LAYOUT.row;
  return rowWidth - plateInset - rightWidth - textGap - textDx;
}
