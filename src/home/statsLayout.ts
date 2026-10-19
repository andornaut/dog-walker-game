import type { Rect } from "../layout/rect";

export type StatsTab = "badges" | "dogs" | "runs";

// The tabs, left to right; each one's label is menuText.stats.tabs[tab].
export const STATS_TABS: readonly StatsTab[] = ["runs", "dogs", "badges"];

const PANEL = { height: 444, width: 344, x: 8, y: 108 };

// The Stats page's geometry, from the menus mock.
export const STATS_LAYOUT = {
  // The close button's face, with its 44x44 hit area in the corner.
  close: { hit: { height: 44, width: 44, x: 316, y: 0 }, x: 332, y: 10 },
  // The badge tapped open, over the wall.
  detail: { height: 268, width: 312, x: 24, y: PANEL.y + 32 },
  dogColumns: { fired: 344, walks: 236, zones: 290 },
  dogRow: { iconX: 14, nameX: 54, pitch: 34, top: PANEL.y + 32 },
  panel: PANEL,
  rows: { left: 16, pitch: 17, right: 344 },
  // Tabs are 44 game pixels tall (48 CSS pixels on a phone) with 8 between them.
  tab: { height: 44, pitch: 120, width: 112, x: 4, y: 56 },
  // The badge wall: two columns filled down, each row the badge then a 132-wide text column
  // of three lines at 2x (the name, then the goal).
  wall: { columnGap: 8, columnWidth: 168, rowHeight: 52, rows: 8, x: 8, y: PANEL.y + 24 },
  wallText: { lineHeight: 16, lines: 3, width: 132, x: 36, y: 4 },
} as const;

export function statsTabRects(): Rect[] {
  const { height, pitch, width, x, y } = STATS_LAYOUT.tab;
  return STATS_TABS.map((_, i) => ({ height, width, x: x + i * pitch, y }));
}
