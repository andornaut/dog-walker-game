import { SCREEN_CONFIG } from "../data/screen";
import { closeControl } from "../layout/closeControl";
import type { Rect } from "../layout/rect";

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
  // The gap between one number column and the next, or the names.
  dogColumns: { gap: 4 },
  // Each row's 32x32 face, its top faceTop above the row's text row, and the name beside it.
  dogRow: { faceSize: 32, faceTop: 12, faceX: 12, nameX: 46, pitch: 34, top: PANEL.y + 32 },
  panel: PANEL,
  rows: { left: 16, pitch: 17, right: 344 },
  // Tabs are 44 game pixels tall (48 CSS pixels on a phone) with 8 between them.
  tab: { height: 44, pitch: 120, width: 112, x: 4, y: 56 },
  // The badge wall: two columns filled down, each row the badge then a 132-wide text column
  // of three lines at 2x (the name, the goal, then a locked badge's progress across walks).
  wall: { columnGap: 8, columnWidth: 168, rowHeight: 52, rows: 8, x: 8, y: PANEL.y + 24 },
  wallText: { lineHeight: 16, lines: 3, scale: 2, width: 132, x: 36, y: 4 },
} as const;

export function statsTabRects(): Rect[] {
  const { height, pitch, width, x, y } = STATS_LAYOUT.tab;
  return STATS_TABS.map((_, i) => ({ height, width, x: x + i * pitch, y }));
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
