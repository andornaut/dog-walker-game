import { closeControl } from "../layout/closeControl";
import type { Rect } from "../layout/rect";
import { TEXT_FIT_STYLES } from "../layout/textFit";
import type { FontMetrics } from "../ui/fontMetrics";
import { SHOP_TABS } from "./shop";

// The Pet shop page under the home screen's top bar, which stays in view with the bank:
// a card with its title band and close control, the Gear and Dogs tabs, and each tab's
// lists. Rows are hit areas at least 44 tall; tabs draw 28 tall in a 44-tall hit area. The
// lists scroll in the list area under the tabs, laid out here as they sit scrolled to the top.
const PANEL = { height: 512, width: 352, x: 4, y: 44 };
const ROW_X = PANEL.x + 12;
const ROW_WIDTH = 328;
// The list area: from under the tabs to the card's inner edge, as wide as the card inside its
// 8px frame.
const LIST = { height: 436, width: PANEL.width - 16, x: PANEL.x + 8, y: 112 };

export const SHOP_LAYOUT = {
  band: { height: 22, inset: 6, titleX: 16, titleY: 6 },
  close: closeControl(PANEL),
  // The Dogs tab: the slot heading and rows, then the dog heading and rows.
  dogs: {
    dogHeadingY: 236,
    dogRows: { height: 42, pitch: 48, y: 252 },
    slotHeadingY: 118,
    slotRows: { height: 42, pitch: 48, y: 134 },
  },
  // The Gear tab: its heading and rows.
  gear: {
    headingY: 118,
    rows: { height: 44, pitch: 54, y: 136 },
  },
  // Headings sit on the card at the row's left, a note right-aligned at its right.
  headingRight: ROW_X + ROW_WIDTH,
  headingX: ROW_X,
  // The headings and rows scroll in rect, masked to it, with padBottom of card under the last
  // row when scrolled to the bottom. A page key moves the list its height less pageOverlap,
  // keeping the row at the edge in view.
  list: { padBottom: 8, pageOverlap: 48, rect: LIST },
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
  // edge) plateInset inside the right edge, the name and line keeping textGap clear of it.
  row: {
    art: 2,
    box: { dx: 4, size: 36 },
    lock: { dx: -2, dy: -3 },
    ownedDx: 20,
    plateInset: 6,
    textDx: 46,
    textGap: 6,
    width: ROW_WIDTH,
    x: ROW_X,
  },
  // Beside a list longer than the view: a thumb in plum with an edge-wide ink edge, thumbWidth
  // wide, inset from the panel's right edge and at least thumbMin tall, on a trackWidth-wide
  // tan track, centred under it and as tall as the list area.
  scrollbar: {
    edge: 1,
    edgeColor: "ink",
    inset: 2,
    thumbColor: "plum",
    thumbMin: 16,
    thumbWidth: 5,
    trackColor: "tan",
    trackWidth: 3,
  },
  tab: { drawHeight: 28, drawY: 80, gap: 8, height: 44, width: 160, x: ROW_X, y: 72 },
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

// The scrollbar's track and thumb for a list max pixels taller than its view, scrolled y, or
// null for a list that fits. The thumb is as tall a share of the track as the view is of the
// list.
export function shopScrollbar(max: number, y: number): { thumb: Rect; track: Rect } | null {
  if (max <= 0) {
    return null;
  }
  const { inset, thumbMin, thumbWidth, trackWidth } = SHOP_LAYOUT.scrollbar;
  const thumbX = PANEL.x + PANEL.width - inset - thumbWidth;
  const height = Math.max(thumbMin, Math.round((LIST.height * LIST.height) / (LIST.height + max)));
  const share = Math.min(1, Math.max(0, y / max));
  return {
    thumb: {
      height,
      width: thumbWidth,
      x: thumbX,
      y: LIST.y + Math.round((LIST.height - height) * share),
    },
    track: {
      height: LIST.height,
      width: trackWidth,
      x: thumbX + (thumbWidth - trackWidth) / 2,
      y: LIST.y,
    },
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

// Rows from top, pitch apart.
export function rowRects(
  spec: { height: number; pitch: number; y: number },
  count: number,
): Rect[] {
  const { width, x } = SHOP_LAYOUT.row;
  return Array.from({ length: count }, (_, i) => ({
    height: spec.height,
    width,
    x,
    y: spec.y + i * spec.pitch,
  }));
}

// How wide a row's name and line may be beside the price plate or OWNED, rightWidth wide from
// its left edge to the row's right edge less plateInset.
export function shopRowTextRoom(rightWidth: number): number {
  const { plateInset, textDx, textGap, width } = SHOP_LAYOUT.row;
  return width - plateInset - rightWidth - textGap - textDx;
}
