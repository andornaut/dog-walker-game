import { closeControl } from "../layout/closeControl";
import type { Rect } from "../layout/rect";
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
  // The Gear tab: its heading and rows, then the chosen item's name and effect.
  gear: {
    effect: { lineHeight: 16, nameY: 422, y: 442 },
    headingY: 118,
    rows: { height: 44, pitch: 54, y: 136 },
  },
  // Headings sit on the card at the row's left, a note right-aligned at its right.
  headingRight: ROW_X + ROW_WIDTH,
  headingX: ROW_X,
  message: { y: 540 },
  panel: PANEL,
  // In a row: the 36x36 art box and the art in it, the name and line, the trait and
  // temperament icons with the fee after them, and the price plate or OWNED at the right.
  row: {
    art: 2,
    box: { dx: 4, size: 36 },
    feeDx: 83,
    iconDx: 45,
    iconPitch: 18,
    plateInset: 6,
    textDx: 46,
    width: ROW_WIDTH,
    x: ROW_X,
  },
  tab: { drawHeight: 28, drawY: 80, gap: 8, height: 44, width: 162, x: PANEL.x + 10, y: 72 },
} as const;

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
