import { fillLine, wrapWords } from "@andornaut/game-kit/lines";
import type { Rect } from "@andornaut/game-kit/rect";
import { type TextFitStyle } from "@andornaut/game-kit/text/textFit";

import { badgeKey } from "../assets/spriteKeys";
import type { AchievementCondition, AchievementId, GameData } from "../data/types";
import { MIN_TAP_SIZE } from "../layout/screenLayout";
import { achievementProgress } from "../rules/achievements";
import type { SaveDocument } from "../save/schema";
import { GREYED } from "../ui/selection";
import { TEXT_SCALE } from "../ui/textFit";
import { dollarsToCents } from "../units";
import { dollarText } from "./home";
import { MENU_TEXT_FIELDS } from "./menuText";

export interface BadgeView {
  readonly art: string;
  readonly badgeLine: string;
  readonly earned: boolean;
  readonly goal: string;
  readonly id: AchievementId;
  readonly name: string;
  // The goal to show when the full one does not fit its row on the badge wall.
  readonly shortGoal: string;
}

// The PALETTE names a badge's text draws in on the cream panel, by whether it is earned: its
// name, and its goal and progress. A locked badge's open card draws its line in the goal's
// colour and its status (Locked) in the dark red of a shop price the bank does not cover. A
// locked badge's goal and progress are an inactive label, exempt from 4.5:1, and hold the 3:1 a
// disabled tile's label does.
export const BADGE_TEXT_COLOURS = {
  earned: { goal: "darkBrown", name: "forest" },
  locked: { goal: "neutralSlate", name: "neutralDarkSlate", status: GREYED.shortPrice },
} as const;

// Every badge in wall order, earned or locked by the save.
export function badgeWall(
  data: Pick<GameData, "achievements">,
  save: Pick<SaveDocument, "achievements">,
): BadgeView[] {
  return data.achievements.map((achievement) => ({
    art: badgeKey(achievement.id),
    badgeLine: achievement.badgeLine,
    earned: save.achievements.includes(achievement.id),
    goal: achievement.goal,
    id: achievement.id,
    name: achievement.name,
    shortGoal: achievement.shortGoal ?? achievement.goal,
  }));
}

// The badges ids name, earned, in wall order: a strip of badges just earned.
export function earnedBadges(
  data: Pick<GameData, "achievements">,
  ids: readonly AchievementId[],
): BadgeView[] {
  return badgeWall(data, { achievements: [] })
    .filter(({ id }) => ids.includes(id))
    .map((badge) => ({ ...badge, earned: true }));
}

export function earnedText(
  data: Pick<GameData, "menuText">,
  badges: readonly Pick<BadgeView, "earned">[],
): string {
  return fillLine(MENU_TEXT_FIELDS.stats, data.menuText.stats, "earnedCount", {
    earned: String(badges.filter(({ earned }) => earned).length),
    total: String(badges.length),
  });
}

// A count of a badge's progress as the game shows it: whole dollars for lifetime earnings,
// else the number, each with thousands separated.
function progressAmountText(kind: AchievementCondition["kind"], amount: number): string {
  return kind === "lifetimeEarnings"
    ? dollarText(dollarsToCents(amount))
    : amount.toLocaleString("en-US");
}

// The progress under a locked badge's goal when its condition counts across walks ("7/15",
// "$1,234/$20,000"); undefined for an earned badge and for one judged on a single walk or on
// what the save owns.
export function badgeProgress(
  data: Pick<GameData, "achievements" | "dogs" | "menuText" | "walkers" | "world">,
  save: Pick<SaveDocument, "stats">,
  badge: Pick<BadgeView, "earned" | "id">,
): string | undefined {
  const achievement = data.achievements.find(({ id }) => id === badge.id);
  const progress =
    badge.earned || achievement === undefined ? null : achievementProgress(data, save, achievement);
  const kind = achievement?.conditions[0]?.kind;
  return progress === null || kind === undefined
    ? undefined
    : fillLine(MENU_TEXT_FIELDS.stats, data.menuText.stats, "badgeProgress", {
        have: progressAmountText(kind, progress.have),
        need: progressAmountText(kind, progress.need),
      });
}

export interface WallCellLines {
  readonly goal: string[];
  readonly name: string[];
  readonly progress: string[];
  // Whether the name, a whole goal and any progress all fit the lines.
  readonly whole: boolean;
}

// A wall cell's text, broken into lines by wrap: the name, then the goal, then the progress
// when there is one. The goal is the full one when it fits the lines left, with the progress on
// a line of its own or else ending the goal's last line; failing both, the short one, the same
// way. Failing that too, the short goal is cut to the lines left.
export function wallCellLines(
  lines: number,
  wrap: (text: string) => string[],
  badge: Pick<BadgeView, "goal" | "name" | "shortGoal">,
  progress: string | undefined,
): WallCellLines {
  const name = wrap(badge.name);
  const left = lines - name.length;
  const own = progress === undefined ? [] : [progress];
  for (const text of [badge.goal, badge.shortGoal]) {
    const goal = wrap(text);
    if (goal.length + own.length <= left) {
      return { goal, name, progress: own, whole: true };
    }
    const inline = progress === undefined ? undefined : wrap(`${text} ${progress}`);
    if (inline !== undefined && inline.length <= left) {
      return { goal: inline, name, progress: [], whole: true };
    }
  }
  return {
    goal: wrap(badge.shortGoal).slice(0, Math.max(0, left - own.length)),
    name: name.slice(0, lines),
    progress: own,
    whole: false,
  };
}

// A wall cell's text at 2x (wallCellLines), each line's ink no wider than the cell's width as
// inkWidth measures it. whole: the name, a whole goal and any progress all fit.
export function wallCell(
  cell: { readonly lines: number; readonly width: number },
  inkWidth: (line: string) => number,
  badge: Pick<BadgeView, "goal" | "name" | "shortGoal">,
  progress: string | undefined,
): WallCellLines {
  const fitted = wallCellLines(
    cell.lines,
    (text) => wrapWords(inkWidth, cell.width, text),
    badge,
    progress,
  );
  const drawn = [...fitted.name, ...fitted.goal, ...fitted.progress];
  return { ...fitted, whole: fitted.whole && drawn.every((line) => inkWidth(line) <= cell.width) };
}

interface WallSpec {
  readonly gap: number;
  readonly width: number;
  readonly x: number;
  readonly y: number;
}

// Each badge's row, also its tap target: one per height in heights from the top, gap apart.
export function wallRects(spec: WallSpec, heights: readonly number[]): Rect[] {
  let y = spec.y;
  return heights.map((height) => {
    const rect = { height, width: spec.width, x: spec.x, y };
    y += height + spec.gap;
    return rect;
  });
}

// A badge strip's rows from its panel's top: the title's capitals at titleY, the first row's
// badgeSize squares from badgeTop and each later row's rowPitch under the row above, perRow
// to a row and at most maxRows rows, and a badge's name's first capitals nameGap under the
// badge, on up to nameLines lines namePitch apart. The slots share the panel's width less
// inset each side, inside its frame, frame thick.
export const BADGE_STRIP = {
  badgeSize: 32,
  badgeTop: 22,
  frame: 2,
  inset: 4,
  maxNamed: 3,
  maxRows: 2,
  nameGap: 4,
  nameLines: 2,
  namePitch: 16,
  perRow: 7,
  rowPitch: 38,
  titleY: 8,
} as const;

// The rows count badges take: one per perRow, at most maxRows.
export function badgeStripRows(count: number): number {
  const { maxRows, perRow } = BADGE_STRIP;
  return Math.min(maxRows, Math.ceil(count / perRow));
}

// How many of count badges each of rows rows holds: as even as can be, the fuller rows first.
export function badgeRowCounts(rows: number, count: number): number[] {
  const shared = Math.max(1, rows);
  return Array.from(
    { length: shared },
    (_, row) => Math.floor(count / shared) + (row < count % shared ? 1 : 0),
  );
}

// How tall a strip of rows rows of badges must be from its panel's top: down to the first
// row's badges' bottom, MIN_TAP_SIZE more for each later row's tap targets, and the frame.
export function badgeStripMinHeight(rows: number): number {
  const { badgeSize, badgeTop, frame } = BADGE_STRIP;
  return badgeTop + badgeSize + Math.max(0, rows - 1) * MIN_TAP_SIZE + frame;
}

interface StripCell {
  readonly left: number;
  readonly right: number;
  readonly row: number;
}

// Each of count badges' slot in rows rows across width (badgeRowCounts): every slot the
// fullest row's share of width, each row centred, edge to edge with its neighbours.
function stripCells(
  layout: { readonly width: number; readonly x: number },
  rows: number,
  count: number,
): StripCell[] {
  const perRow = badgeRowCounts(rows, count);
  const width = layout.width / Math.max(1, ...perRow);
  return perRow.flatMap((inRow, row) => {
    const start = layout.x + (layout.width - width * inRow) / 2;
    return Array.from({ length: inRow }, (_, i) => ({
      left: start + width * i,
      right: start + width * (i + 1),
      row,
    }));
  });
}

interface StripSlot {
  // The centre of the slot, where its badge sits.
  readonly centreX: number;
  // The top of its badge, from the strip's panel's top.
  readonly top: number;
  readonly width: number;
}

interface BadgeStrip {
  // Names fit under the badges only when few share the strip.
  readonly named: boolean;
  readonly slots: readonly StripSlot[];
}

// Newly earned badges side by side across width in rows rows (stripCells), named while at
// most maxNamed share the strip.
export function badgeStrip(
  layout: { readonly maxNamed: number; readonly width: number; readonly x: number },
  rows: number,
  count: number,
): BadgeStrip {
  const { badgeTop, rowPitch } = BADGE_STRIP;
  return {
    named: count <= layout.maxNamed,
    slots: stripCells(layout, rows, count).map(({ left, right, row }) => ({
      centreX: Math.round((left + right) / 2),
      top: badgeTop + row * rowPitch,
      width: Math.floor(right - left),
    })),
  };
}

// The strip of count badges in rows rows across a panel at rect.
export function panelBadgeStrip(rect: Rect, rows: number, count: number): BadgeStrip {
  const { inset, maxNamed } = BADGE_STRIP;
  const layout = { maxNamed, width: rect.width - inset * 2, x: rect.x + inset };
  return badgeStrip(layout, rows, count);
}

// Each of count badges' tap targets in rows rows across a panel at rect: its slot, edge to edge
// with its row's neighbours. A lone row's run from the badges' top down to the panel's frame.
// With more rows, each row's end at its badges' bottom, the first's starting MIN_TAP_SIZE
// above that and each later row's where the row above's end, and the last's run down to the
// frame.
export function badgeStripHits(rect: Rect, rows: number, count: number): Rect[] {
  const { badgeSize, badgeTop, frame, inset, rowPitch } = BADGE_STRIP;
  const cells = stripCells({ width: rect.width - inset * 2, x: rect.x + inset }, rows, count);
  const last = Math.max(0, rows - 1);
  const end = (row: number) =>
    row === last ? rect.y + rect.height - frame : rect.y + badgeTop + row * rowPitch + badgeSize;
  const start = (row: number) => {
    if (row > 0) {
      return end(row - 1);
    }
    return last === 0 ? rect.y + badgeTop : end(0) - MIN_TAP_SIZE;
  };
  return cells.map(({ left, right, row }) => {
    const x = Math.round(left);
    const y = start(row);
    return { height: end(row) - y, width: Math.round(right) - x, x, y };
  });
}

// The panel of badges earned away from a walk's end, as tall as badgesHeight, then a row of
// faces facesHeight tall when owners cheer.
export const CELEBRATION_PANEL = {
  badgesHeight: 118,
  facesHeight: 44,
  width: 344,
  x: 8,
} as const;

// The capitals' top of each of a name's lines lines, under a strip whose panel's top is top:
// every name's first line on one cap line, a wrapped name's second line under it.
export function badgeNameTops(lines: number, top: number): number[] {
  const { badgeSize, badgeTop, nameGap, namePitch } = BADGE_STRIP;
  const first = top + badgeTop + badgeSize + nameGap;
  return Array.from({ length: lines }, (_, n) => first + n * namePitch);
}

// A strip's names at 2x, wrapped at spaces onto up to nameLines lines.
export const BADGE_NAME_STYLE: TextFitStyle = { lines: BADGE_STRIP.nameLines, scale: TEXT_SCALE };

export interface BadgeRowNames {
  // Each name's lines, in the order the names came.
  readonly lines: string[][];
  readonly style: TextFitStyle;
}

// A strip's names in BADGE_NAME_STYLE, each broken at spaces into lines in a slot slotWidth
// wide less 2px each side, as inkWidth measures them.
export function badgeRowNames(
  inkWidth: (style: TextFitStyle, line: string) => number,
  slotWidth: number,
  names: readonly string[],
): BadgeRowNames {
  const room = slotWidth - 4;
  const style = BADGE_NAME_STYLE;
  return {
    lines: names.map((name) => wrapWords((line) => inkWidth(style, line), room, name)),
    style,
  };
}

export function celebrationTitle(data: Pick<GameData, "menuText">, count: number): string {
  const text = data.menuText.celebration;
  return count === 1
    ? text.titleOne
    : fillLine(MENU_TEXT_FIELDS.celebration, text, "titleMany", { count: String(count) });
}
