import type { Rect } from "@andornaut/game-kit/rect";

// Every top bar (the start screen's, the walk bar, Help's) is flat fill with one trim: line's
// colour across its row, and the bar's last rows in edge's colours, top to bottom. Its wells sit
// clearance rows clear of the trim above and below (topBarWellRows).
export const TOP_BAR_TRIM = {
  clearance: 3,
  edge: ["brown", "darkBrown", "ink"],
  fill: "plum",
  line: { colour: "darkBrown", row: 1 },
} as const;

type TrimColour =
  (typeof TOP_BAR_TRIM.edge)[number] | typeof TOP_BAR_TRIM.fill | typeof TOP_BAR_TRIM.line.colour;

// A palette colour name and the rect it fills.
export interface TrimRect {
  colour: TrimColour;
  rect: Rect;
}

// The bar's fill, then its trim, as rects to fill in that order.
export function topBarRects(bar: Rect): TrimRect[] {
  const { edge, fill, line } = TOP_BAR_TRIM;
  const row = (y: number): Rect => ({ ...bar, height: 1, y: bar.y + y });
  return [
    { colour: fill, rect: bar },
    { colour: line.colour, rect: row(line.row) },
    ...edge.map((colour, i) => ({ colour, rect: row(bar.height - edge.length + i) })),
  ];
}

// The rows between the trim's line and its edge on a bar height tall, from the bar's top: top,
// the first, and bottom, one past the last.
export function topBarContentRows(height: number): { bottom: number; top: number } {
  const { edge, line } = TOP_BAR_TRIM;
  return { bottom: height - edge.length, top: line.row + 1 };
}

// A well's top row and height on a bar height tall: clearance rows clear of the trim above and
// below.
export function topBarWellRows(height: number): { height: number; y: number } {
  const { bottom, top } = topBarContentRows(height);
  const { clearance } = TOP_BAR_TRIM;
  return { height: bottom - top - 2 * clearance, y: top + clearance };
}

// Every top bar's height: the start screen's, the walk bar and Help's.
export const TOP_BAR_HEIGHT = 40;

// The top bar's content rows, between its trim's line and edge, and their middle row, which each
// button's 20-row ui-icon-button face is centred on, the upper half of the face above it.
const TOP_BAR_ROWS = topBarContentRows(TOP_BAR_HEIGHT);
export const TOP_BAR_MID =
  TOP_BAR_ROWS.top + Math.floor((TOP_BAR_ROWS.bottom - TOP_BAR_ROWS.top) / 2);
export const TOP_BAR_FACE = { size: 20, y: TOP_BAR_MID - 10 } as const;

// The well at a top bar's left that shows the money (the start screen's bank, the walk's cash):
// clear of the trim, x columns in from the bar's left, ink on all but its lip's last row.
export const TOP_BAR_WELL = { ...topBarWellRows(TOP_BAR_HEIGHT), lip: 1, x: 5 } as const;

// The top row of text capRows tall set in the well: centred on its ink rows (the well less its
// lip's row), a half row lower where their parities differ.
export function wellCapsTop(capRows: number): number {
  const { height, lip, y } = TOP_BAR_WELL;
  return y + Math.ceil((height - lip - capRows) / 2);
}
