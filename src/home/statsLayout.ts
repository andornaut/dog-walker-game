import { SCREEN_LAYOUT } from "../data/screen";
import type { Rect } from "../lib/rect";
import { pageCloseControl } from "../ui/closeControl";
import { type FontMetrics, inkRowsOfLines } from "../ui/fontMetrics";
import { scrollbarRects, type ScrollbarSpec } from "../ui/scrollbar";
import { BADGE_STRIP } from "./badgesView";

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
// Between the Dogs tab's blocks and the Walks tab's sections, under the last row's pitch.
const BLOCK_GAP = 12;
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
  close: pageCloseControl(SCREEN_LAYOUT.screen),
  // The badge tapped open, over the wall, at most height tall: detailPanel sizes it.
  detail: { height: 268, width: 312, x: 24, y: PANEL.y + 32 },
  // In the open badge, from its top: the badge's centre at badgeY, the name's and the status's
  // capitals at nameY and statusY, then the goal and the badge's line at 2x, centred and
  // wrapped between x in from its left edge and textRight in from its right, a line of the body
  // font apart and gap between them; foot rows of cream under the line's lowest ink, then the
  // ui-panel's frame, frame rows deep, end the panel.
  detailText: {
    badgeY: 48,
    foot: 8,
    frame: 3,
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
    gap: BLOCK_GAP,
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
  // The Walks tab: the first section's heading with its capitals at top, level with the Dogs
  // tab's first block, each section's rows rowsY under its heading, and the next heading
  // sectionGap under the last row's pitch, as far as the Dogs tab's blocks are apart.
  walks: { rowsY: 20, sectionGap: BLOCK_GAP, top: PANEL.y + 10 },
  // The badge wall: the heading and the earned count with their capitals at headingY, then one
  // badge per row from y, gap apart, each the badge badgeTop under the row's top then a text
  // column of up to lines lines at 2x from x (the name, the goal, then a locked badge's
  // progress across walks), its capitals' top y under the row's top and pad over the row's
  // bottom. The wall ends foot under its last row. An earned badge's row lies on a band in
  // earned.fill with a 1px earned.outline frame, bandWidth wide from bandLeft left of the row
  // and bandY over and under it; the ui-check tick, checkSize square, sits over the badge's
  // top-right corner, its top-left checkDx right of the row's left and checkDy below its top.
  wall: {
    badgeTop: 2,
    earned: {
      bandLeft: 4,
      bandWidth: 329,
      bandY: 2,
      checkDx: 20,
      checkDy: -1,
      checkSize: 16,
      fill: "yellow",
      outline: "amber",
    },
    foot: 16,
    gap: 8,
    headingY: PANEL.y + 10,
    width: 316,
    x: 16,
    y: PANEL.y + 30,
  },
  wallText: { lineHeight: 16, lines: 3, pad: 4, width: 276, x: 38, y: 4 },
} as const;

// How wide the open badge's goal and line may be.
export const DETAIL_TEXT_WIDTH =
  STATS_LAYOUT.detail.width - STATS_LAYOUT.detailText.x - STATS_LAYOUT.detailText.textRight;

// The capitals' top of the open badge's line, from its top, under a goal goalLines lines long.
export function detailLineY(body: FontMetrics, goalLines: number): number {
  const { gap, goalY } = STATS_LAYOUT.detailText;
  return goalY + goalLines * body.lineHeight * 2 + gap;
}

// The open badge's panel, its frame detailText.foot under its line's lowest ink, under a goal
// goalLines lines long and a line lineLines lines long, all at 2x.
export function detailPanel(body: FontMetrics, goalLines: number, lineLines: number): Rect {
  const { detail, detailText } = STATS_LAYOUT;
  const inkBottom = detailLineY(body, goalLines) + inkRowsOfLines(body, lineLines) * 2;
  return { ...detail, height: inkBottom + detailText.foot + detailText.frame };
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

// The capitals' top of each Walks tab section's heading, scrolled to its top, for sections of
// rows.
export function walksHeadingTops(sections: readonly number[]): number[] {
  const { rowsY, sectionGap, top } = STATS_LAYOUT.walks;
  let y = top;
  return sections.map((rows) => {
    const heading = y;
    y += rowsY + rows * PITCH + sectionGap;
    return heading;
  });
}

// The bottom of each tab's content as laid out, scrolled to its top: the Walks tab with
// sections of rows, the Dogs tab with dogs blocks and the Badges tab with badges rows.
export function walksBottom(sections: readonly number[]): number {
  const { rowsY, top } = STATS_LAYOUT.walks;
  const tops = walksHeadingTops(sections);
  const last = tops.at(-1);
  const rows = sections.at(-1) ?? 0;
  const end = last === undefined ? top : last + rowsY + rows * PITCH;
  return end + STATS_LAYOUT.scroll.padBottom;
}

export function dogsBottom(dogs: number): number {
  const { gap } = STATS_LAYOUT.dogs;
  return dogBlockTop(dogs) - gap + STATS_LAYOUT.scroll.padBottom;
}

export function badgesBottom(rows: readonly Rect[]): number {
  const { foot, y } = STATS_LAYOUT.wall;
  const last = rows.at(-1);
  return (last === undefined ? y : last.y + last.height) + foot;
}

// The band under an earned badge's row.
export function earnedBand(row: Rect): Rect {
  const { bandLeft, bandWidth, bandY } = STATS_LAYOUT.wall.earned;
  return {
    height: row.height + 2 * bandY,
    width: bandWidth,
    x: row.x - bandLeft,
    y: row.y - bandY,
  };
}

// The tick over an earned badge's top-right corner.
export function earnedCheck(row: Rect): Rect {
  const { checkDx, checkDy, checkSize } = STATS_LAYOUT.wall.earned;
  return { height: checkSize, width: checkSize, x: row.x + checkDx, y: row.y + checkDy };
}

// A wall row's height for a badge whose text runs lines lines: as tall as the badge with
// badgeTop over and under it, or as the text with pad under its last line, whichever is taller.
export function wallRowHeight(lines: number): number {
  const { badgeTop } = STATS_LAYOUT.wall;
  const { lineHeight, pad, y } = STATS_LAYOUT.wallText;
  return Math.max(BADGE_STRIP.badgeSize + 2 * badgeTop, y + lines * lineHeight + pad);
}

// The scrollbar's track and thumb for content max pixels taller than the view, scrolled y, or
// null for content that fits.
export function statsScrollbar(max: number, y: number): { thumb: Rect; track: Rect } | null {
  return scrollbarRects(SCROLLBAR, VIEW, max, y);
}
