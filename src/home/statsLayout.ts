import { SCREEN_CONFIG } from "../data/screen";
import { closeControl } from "../layout/closeControl";
import type { Rect } from "../layout/rect";
import type { FontMetrics } from "../ui/fontMetrics";

export type StatsTab = "badges" | "dogs" | "runs";

// The Dogs tab's number columns, left to right after the dog's face and name; each one's
// heading is menuText.stats.dogColumns[column].
export type DogColumn = "fired" | "walks" | "zones";
export const DOG_COLUMNS: readonly DogColumn[] = ["walks", "zones", "fired"];

// The tabs, left to right; each one's label is menuText.stats.tabs[tab].
export const STATS_TABS: readonly StatsTab[] = ["runs", "dogs", "badges"];

const PANEL = { height: 444, width: 344, x: 8, y: 108 };

// The Stats page's geometry, from the menus mock.
export const STATS_LAYOUT = {
  // The close control, in the screen's corner.
  close: closeControl({ height: SCREEN_CONFIG.height, width: SCREEN_CONFIG.width, x: 0, y: 0 }),
  // The badge tapped open, over the wall.
  detail: { height: 268, width: 312, x: 24, y: PANEL.y + 32 },
  // In the open badge, from its top: the badge's centre at badgeY, the name's and the status's
  // capitals at nameY and statusY, then the goal and the badge's line at 2x from x, textRight
  // in from its right edge, a line of the body font apart and gap between them; the line's
  // lowest ink keeps foot over the bottom.
  detailText: {
    badgeY: 48,
    foot: 8,
    gap: 8,
    goalY: 136,
    nameY: 92,
    statusY: 112,
    textRight: 16,
    x: 16,
  },
  // The gap between one number column and the next, or the names.
  dogColumns: { gap: 4 },
  // Each row's 32x32 face, its top faceTop above the row's text row, and the name beside it.
  dogRow: { faceSize: 32, faceTop: 12, faceX: 12, nameX: 46, pitch: 34, top: PANEL.y + 32 },
  panel: PANEL,
  rows: { left: 16, pitch: 17, right: 344 },
  // Tabs are 44 game pixels tall (48 CSS pixels on a phone), spanning the panel's width with
  // gap between them, the panel's margin from the screen's edge; widths, left to right, share
  // the odd pixel with the middle tab.
  tab: { gap: 8, height: 44, widths: [109, 110, 109], x: PANEL.x, y: 56 },
  // The badge wall: two columns filled down, each row the badge then a 132-wide text column
  // of three lines at 2x (the name, the goal, then a locked badge's progress across walks).
  wall: { columnGap: 8, columnWidth: 168, rowHeight: 52, rows: 8, x: 8, y: PANEL.y + 24 },
  wallText: { lineHeight: 16, lines: 3, scale: 2, width: 132, x: 36, y: 4 },
} as const;

// How wide the open badge's goal and line may be.
export const DETAIL_TEXT_WIDTH =
  STATS_LAYOUT.detail.width - STATS_LAYOUT.detailText.x - STATS_LAYOUT.detailText.textRight;

// The capitals' top of the open badge's line, from its top, under a goal goalLines lines long.
export function detailLineY(body: FontMetrics, goalLines: number): number {
  const { gap, goalY } = STATS_LAYOUT.detailText;
  return goalY + goalLines * body.lineHeight * 2 + gap;
}

export function statsTabRects(): Rect[] {
  const { gap, height, widths, x, y } = STATS_LAYOUT.tab;
  let left = x;
  return STATS_TABS.map((_, i) => {
    const width = widths[i] ?? 0;
    const rect = { height, width, x: left, y };
    left += width + gap;
    return rect;
  });
}

// Each number column's right edge, its heading and numbers right-aligned on it: the last
// column's on the rows' right edge, and each one before it its neighbour's width and the gap
// further left. width is a column's width: its heading's, or its widest number's if wider.
export function dogColumnRights(width: (column: DogColumn) => number): Record<DogColumn, number> {
  const rights: Partial<Record<DogColumn, number>> = {};
  let right: number = STATS_LAYOUT.rows.right;
  for (const column of [...DOG_COLUMNS].reverse()) {
    rights[column] = right;
    right -= width(column) + STATS_LAYOUT.dogColumns.gap;
  }
  return rights as Record<DogColumn, number>;
}
