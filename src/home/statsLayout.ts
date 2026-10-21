import { SCREEN_CONFIG } from "../data/screen";
import type { Rect } from "../lib/rect";
import { pageCloseControl } from "../ui/closeControl";
import type { FontMetrics } from "../ui/fontMetrics";
import { scrollbarRects, type ScrollbarSpec } from "../ui/scrollbar";

export type StatsTab = "badges" | "dogs" | "runs";

// The Dogs tab's rows under each dog's face and name, top to bottom; each one's label is
// menuText.stats.dogColumns[stat].
export type DogStat = "fired" | "walks" | "zones";
export const DOG_STATS: readonly DogStat[] = ["walks", "zones", "fired"];

// The tabs, left to right; each one's label is menuText.stats.tabs[tab].
export const STATS_TABS: readonly StatsTab[] = ["runs", "dogs", "badges"];

const PANEL = { height: 444, width: 344, x: 8, y: 108 };
// The panel's cream inside its 2px frame, where every tab's content scrolls, clipped to it.
const VIEW = { height: PANEL.height - 4, width: PANEL.width - 4, x: PANEL.x + 2, y: PANEL.y + 2 };
const PITCH = 17;
// Beside content taller than the view: the track at the view's right edge, as tall as the view.
const SCROLLBAR: ScrollbarSpec = {
  thumbInset: 1,
  thumbMin: 16,
  thumbWidth: 5,
  trackWidth: 7,
  x: PANEL.x + PANEL.width - 9,
};

// The Stats page's geometry.
export const STATS_LAYOUT = {
  // The close control, in the screen's corner.
  close: pageCloseControl({ height: SCREEN_CONFIG.height, width: SCREEN_CONFIG.width, x: 0, y: 0 }),
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
  // The Dogs tab: a block per dog from top, each its 32x32 face at the rows' left, the name in
  // the title font nameDx right of the face's left with its capitals nameY under the block's
  // top, then a row per DOG_STATS from rowsY, and gap under the last before the next block.
  // A 1px tan rule runs ruleAbove over each block after the first, ruleDx past the rows' ends.
  dogs: {
    faceSize: 32,
    gap: 12,
    nameDx: 40,
    nameY: 12,
    rowsY: 38,
    ruleAbove: 6,
    ruleDx: 4,
    top: PANEL.y + 10,
  },
  panel: PANEL,
  // Label and value rows: the label's left edge at left and the value's right edge at right,
  // clear of the scrollbar, pitch apart.
  rows: { left: 16, pitch: PITCH, right: 332 },
  // Content scrolled to its end keeps padBottom of cream under its last row. A page key moves
  // it the view's height less pageOverlap; an arrow key moves it keyStep.
  scroll: { keyStep: 2 * PITCH, padBottom: 8, pageOverlap: 48 },
  scrollbar: SCROLLBAR,
  // Tabs are 44 game pixels tall (48 CSS pixels on a phone), spanning the panel's width with
  // gap between them, the panel's margin from the screen's edge; widths, left to right, share
  // the odd pixel with the middle tab.
  tab: { gap: 8, height: 44, widths: [109, 110, 109], x: PANEL.x, y: 56 },
  view: VIEW,
  // The Walks tab: each section's heading with its capitals at top, its rows rowsY under it,
  // and the next heading sectionGap under the last row's pitch.
  walks: { rowsY: 20, sectionGap: 6, top: PANEL.y + 10 },
  // The badge wall: the heading and the earned count with their capitals at headingY, then one
  // badge per row from y, each the badge then a text column of up to lines lines at 2x from x
  // (the name, the goal, then a locked badge's progress across walks).
  wall: { headingY: PANEL.y + 10, rowHeight: 52, width: 316, x: 16, y: PANEL.y + 30 },
  wallText: { lineHeight: 16, lines: 3, width: 276, x: 38, y: 4 },
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

// The top of the index'th dog's block.
export function dogBlockTop(index: number): number {
  const { gap, rowsY, top } = STATS_LAYOUT.dogs;
  return top + index * (rowsY + DOG_STATS.length * PITCH + gap);
}

// The bottom of each tab's content as laid out, scrolled to its top: the Walks tab with
// sections of rows, the Dogs tab with dogs blocks and the Badges tab with badges rows.
export function walksBottom(sections: readonly number[]): number {
  const { rowsY, sectionGap, top } = STATS_LAYOUT.walks;
  const height = sections.reduce((sum, rows) => sum + rowsY + rows * PITCH + sectionGap, 0);
  return top + height - sectionGap + STATS_LAYOUT.scroll.padBottom;
}

export function dogsBottom(dogs: number): number {
  const { gap } = STATS_LAYOUT.dogs;
  return dogBlockTop(dogs) - gap + STATS_LAYOUT.scroll.padBottom;
}

export function badgesBottom(badges: number): number {
  const { rowHeight, y } = STATS_LAYOUT.wall;
  return y + badges * rowHeight + STATS_LAYOUT.scroll.padBottom;
}

// The scrollbar's track and thumb for content max pixels taller than the view, scrolled y, or
// null for content that fits.
export function statsScrollbar(max: number, y: number): { thumb: Rect; track: Rect } | null {
  return scrollbarRects(SCROLLBAR, VIEW, max, y);
}
