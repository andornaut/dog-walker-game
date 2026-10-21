import { closeControl } from "../layout/closeControl";
import type { Rect } from "../layout/rect";
import { TEXT_FIT_STYLES } from "../layout/textFit";
import { SHOP_TABS } from "./shop";

// The Pet shop page under the home screen's top bar, which stays in view with the bank:
// a card with its title band and close control, the Gear and Dogs tabs, and each tab's
// lists. Rows are hit areas at least 44 tall; tabs draw 28 tall in a 44-tall hit area.
const PANEL = { height: 512, width: 352, x: 4, y: 44 };
const ROW_X = PANEL.x + 12;
const ROW_WIDTH = 328;

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
  // The last tap's message: one line, its capitals' top at y, under the lists.
  message: { y: 540 },
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
  tab: { drawHeight: 28, drawY: 80, gap: 8, height: 44, width: 162, x: PANEL.x + 10, y: 72 },
} as const;

// The message on one line across a row's width, in the first of TEXT_FIT_STYLES whose ink fits:
// a second line would fall below the card.
export const SHOP_MESSAGE_FIT = { room: ROW_WIDTH, styles: TEXT_FIT_STYLES } as const;

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
