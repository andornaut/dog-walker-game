import type { Rect } from "../lib/rect";
import { type FontMetrics, helpCapDy, inkRowsOfLines } from "../ui/fontMetrics";
import { type ScrollbarRects, scrollbarRects } from "../ui/scrollbar";
import { BADGE_STRIP, type WallCellLines } from "./badgesView";
import { SHOP_LAYOUT, shopListFrame, shopTabRects } from "./shopLayout";

export type StatsTab = "badges" | "dogs" | "runs";

// The Dogs tab's rows under each dog's face and name, top to bottom; each one's label is
// menuText.stats.dogColumns[stat].
export type DogStat = "fired" | "walks" | "zones";
export const DOG_STATS: readonly DogStat[] = ["walks", "zones", "fired"];

// The tabs, left to right; each one's label is menuText.stats.tabs[tab]. The Logbook opens on
// the first.
export const STATS_TABS: readonly StatsTab[] = ["badges", "dogs", "runs"];

// The Logbook wears the Pet shop's page: its card, title band, close control and tab span,
// and every tab's content scrolling in the shop's list area beside the shop's scrollbar.
const PANEL = SHOP_LAYOUT.panel;
const VIEW = SHOP_LAYOUT.list.rect;
const SCROLLBAR = SHOP_LAYOUT.scrollbar;
// Each tab's first heading, level with the shop's.
const TOP = SHOP_LAYOUT.list.firstHeadingY;
const PITCH = 17;
// Between the Dogs tab's blocks and the Walks tab's sections, under the last row's pitch.
const BLOCK_GAP = 12;
// Label and value rows run across the shop's rows: from the headings' left edge to the rows'
// right edge, beside the scrollbar at right (statsListFrame).
const ROWS = {
  left: SHOP_LAYOUT.headingX,
  pitch: PITCH,
  right: SHOP_LAYOUT.row.x + SHOP_LAYOUT.row.scrollWidth,
};

// The Logbook's geometry.
export const STATS_LAYOUT = {
  // The close control, in the card's corner.
  close: SHOP_LAYOUT.close,
  // The badge tapped open, over the wall, at most height tall: detailPanel sizes it. The end
  // screen opens the same card.
  detail: { height: 268, width: 312, x: 24, y: 140 },
  // In the open badge, from its top: the badge's centre at badgeY, the name's capitals at nameY,
  // the status's LABEL_HELP_GAP clear rows under the title font's lowest ink (helpCapDy) and the
  // goal's goalDy under the status's, then the goal and the badge's line at 2x, centred and
  // wrapped between x in from its left edge and textRight in from its right, a line of the body
  // font apart and gap between them; foot rows of cream under the line's lowest ink, then the
  // ui-panel's frame, frame rows deep, end the panel.
  detailText: {
    badgeY: 48,
    foot: 8,
    frame: 3,
    gap: 8,
    goalDy: 24,
    nameY: 92,
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
    ruleDx: 2,
    top: TOP,
  },
  panel: PANEL,
  // Label and value rows, pitch apart: the label's ink from left and the value's ink up to right
  // beside the scrollbar, or further right on a tab with none (statsListFrame).
  rows: ROWS,
  // Content scrolled to its end keeps the shop list's padBottom of cream under its last row. A
  // page key moves it the view's height less pageOverlap; an arrow key moves it keyStep.
  scroll: {
    keyStep: 2 * PITCH,
    padBottom: SHOP_LAYOUT.list.padBottom,
    pageOverlap: SHOP_LAYOUT.list.pageOverlap,
  },
  scrollbar: SCROLLBAR,
  view: VIEW,
  // The Walks tab: the first section's heading with its capitals at top, level with the Dogs
  // tab's first block, each section's rows rowsY under its heading, and the next heading
  // sectionGap under the last row's pitch, as far as the Dogs tab's blocks are apart.
  walks: { rowsY: 20, sectionGap: BLOCK_GAP, top: TOP },
  // The badge wall: the earned count at the rows' right with its capitals at headingY, then one
  // badge per row from y, gap apart, each the badge badgeTop under the row's top then a text
  // column of up to lines lines at 2x from x (the name, the goal, then a locked badge's
  // progress across walks, wallLineTops), its capitals' top y under the row's top and its last
  // line's pitch and pad over the row's bottom. The wall ends foot under its last row. An
  // earned badge's row lies on a band in earned.fill with a 1px earned.outline frame, across
  // the view: bandWidth wide from bandLeft left of the row, and bandY over and under it. The
  // ui-check tick, checkSize square, sits over the badge's top-right corner, its top-left
  // checkDx right of the row's left and checkDy below its top.
  wall: {
    badgeTop: 2,
    earned: {
      bandLeft: ROWS.left - VIEW.x,
      bandWidth: VIEW.width,
      bandY: 2,
      checkDx: 20,
      checkDy: -1,
      checkSize: 16,
      fill: "yellow",
      outline: "amber",
    },
    foot: 16,
    gap: 8,
    headingY: TOP,
    width: ROWS.right - ROWS.left,
    x: ROWS.left,
    y: TOP + 20,
  },
  wallText: { lineHeight: 16, lines: 3, pad: 4, width: 276, x: 38, y: 4 },
} as const;

// How wide the open badge's goal and line may be.
export const DETAIL_TEXT_WIDTH =
  STATS_LAYOUT.detail.width - STATS_LAYOUT.detailText.x - STATS_LAYOUT.detailText.textRight;

// The fonts the open badge's text is set in: its name in title, the rest in body.
export interface BadgeDetailFonts {
  readonly body: FontMetrics;
  readonly title: FontMetrics;
}

// The capitals' tops of the open badge's status, goal and line, from its top, under a goal
// goalLines lines long.
export function detailTextTops(
  fonts: BadgeDetailFonts,
  goalLines: number,
): { goal: number; line: number; status: number } {
  const { gap, goalDy, nameY } = STATS_LAYOUT.detailText;
  const status = nameY + helpCapDy(fonts.title, 2);
  const goal = status + goalDy;
  return { goal, line: goal + goalLines * fonts.body.lineHeight * 2 + gap, status };
}

// The open badge's panel, its frame detailText.foot under its line's lowest ink, under a goal
// goalLines lines long and a line lineLines lines long, all at 2x.
export function detailPanel(fonts: BadgeDetailFonts, goalLines: number, lineLines: number): Rect {
  const { detail, detailText } = STATS_LAYOUT;
  const line = detailTextTops(fonts, goalLines).line;
  const inkBottom = line + inkRowsOfLines(fonts.body, lineLines) * 2;
  return { ...detail, height: inkBottom + detailText.foot + detailText.frame };
}

// A tab's view, its mask, and where its values' ink ends, by whether it scrolls: as the shop's
// list runs, a tab with no scrollbar to the tabs' right edge, as far in from the card's right
// edge as its labels' ink is from its left, and one with a scrollbar to rows.right.
export function statsListFrame(scrolls: boolean): { rect: Rect; right: number } {
  const { headingRight, rect } = shopListFrame(scrolls);
  return { rect, right: headingRight };
}

// The tabs' hit areas, in the shop's tab span.
export function statsTabRects(): Rect[] {
  return shopTabRects(STATS_TABS.length);
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

// The capitals' top of each line of a wall cell's text, from its row's top: the name's lines from
// y, a lineHeight apart, then the goal's and the progress's, the first LABEL_HELP_GAP clear rows
// under the body font's lowest ink on the name's last line (helpCapDy) and each after it a
// lineHeight under the one before.
export function wallLineTops(
  body: FontMetrics,
  cell: Pick<WallCellLines, "goal" | "name" | "progress">,
): number[] {
  const { lineHeight, y } = STATS_LAYOUT.wallText;
  const name = cell.name.map((_, i) => y + i * lineHeight);
  const below = y + (cell.name.length - 1) * lineHeight + helpCapDy(body, 2);
  const rest = [...cell.goal, ...cell.progress].map((_, i) => below + i * lineHeight);
  return [...name, ...rest];
}

// A wall row's height for a badge whose text lines' capitals' tops are tops (wallLineTops): as
// tall as the badge with badgeTop over and under it, or as the text with its last line's pitch
// and pad under it, whichever is taller.
export function wallRowHeight(tops: readonly number[]): number {
  const { badgeTop } = STATS_LAYOUT.wall;
  const { lineHeight, pad, y } = STATS_LAYOUT.wallText;
  const last = tops.at(-1) ?? y - lineHeight;
  return Math.max(BADGE_STRIP.badgeSize + 2 * badgeTop, last + lineHeight + pad);
}

// The scrollbar's track and thumb for content max pixels taller than the view, scrolled y, or
// null for content that fits.
export function statsScrollbar(max: number, y: number): ScrollbarRects | null {
  return scrollbarRects(SCROLLBAR, VIEW, max, y);
}
