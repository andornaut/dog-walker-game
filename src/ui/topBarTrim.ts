import type { Rect } from "../lib/rect";

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
