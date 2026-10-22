import { badgeKey } from "../assets/spriteKeys";
import type { AchievementId, GameData } from "../data/types";
import { fillLine, wrapWords } from "../lib/lines";
import type { Rect } from "../lib/rect";
import { achievementProgress } from "../rules/achievements";
import type { SaveDocument } from "../save/schema";
import type { TextFitStyle } from "../ui/textFit";
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
// name, and its goal and progress. A locked badge's open card draws its status and line in the
// goal's colour. A locked badge's goal and progress are an inactive label, exempt from 4.5:1,
// and hold the 3:1 a disabled tile's label does.
export const BADGE_TEXT_COLORS = {
  earned: { goal: "darkBrown", name: "forest" },
  locked: { goal: "neutralSlate", name: "neutralDarkSlate" },
} as const;

// Every badge in wall order, earned or locked by the save.
export function badgeWall(
  data: Pick<GameData, "achievements">,
  save: Pick<SaveDocument, "achievements">,
): BadgeView[] {
  return data.achievements.map((achievement) => ({
    art: badgeKey(achievement.id),
    badgeLine: achievement.badgeLine,
    earned: save.achievements[achievement.id] !== undefined,
    goal: achievement.goal,
    id: achievement.id,
    name: achievement.name,
    shortGoal: achievement.shortGoal ?? achievement.goal,
  }));
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

// The progress under a locked badge's goal when its condition counts across walks ("7/15");
// undefined for an earned badge and for one judged on a single walk or on what the save owns.
export function badgeProgress(
  data: Pick<GameData, "achievements" | "dogs" | "menuText" | "walkers" | "world">,
  save: Pick<SaveDocument, "stats">,
  badge: Pick<BadgeView, "earned" | "id">,
): string | undefined {
  const achievement = data.achievements.find(({ id }) => id === badge.id);
  const progress =
    badge.earned || achievement === undefined ? null : achievementProgress(data, save, achievement);
  return progress === null
    ? undefined
    : fillLine(MENU_TEXT_FIELDS.stats, data.menuText.stats, "badgeProgress", {
        have: String(progress.have),
        need: String(progress.need),
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

// How many lines a wall cell draws.
export function wallCellLineCount(cell: WallCellLines): number {
  return cell.name.length + cell.goal.length + cell.progress.length;
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

interface StripSlot {
  // The centre of the slot, where its badge sits.
  readonly centerX: number;
  readonly width: number;
}

interface BadgeStrip {
  // Names fit under the badges only when few share the strip.
  readonly named: boolean;
  readonly slots: readonly StripSlot[];
}

// Newly earned badges side by side across width, named while at most maxNamed share it.
export function badgeStrip(
  layout: { readonly maxNamed: number; readonly width: number; readonly x: number },
  count: number,
): BadgeStrip {
  const width = layout.width / Math.max(1, count);
  return {
    named: count <= layout.maxNamed,
    slots: Array.from({ length: count }, (_, i) => ({
      centerX: Math.round(layout.x + width * (i + 0.5)),
      width: Math.floor(width),
    })),
  };
}

// A badge strip's rows from its panel's top: the title's capitals at titleY, each badge's
// badgeSize square from badgeTop, and its name's first capitals nameGap under the badge, on up
// to nameLines lines namePitch apart.
export const BADGE_STRIP = {
  badgeSize: 32,
  badgeTop: 22,
  maxNamed: 3,
  nameGap: 4,
  nameLines: 2,
  namePitch: 16,
  titleY: 8,
} as const;

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

// A strip's names at 2x, wrapped at spaces onto up to nameLines lines, then with their glyphs a
// screen pixel closer; never smaller.
export const BADGE_NAME_STYLES: readonly TextFitStyle[] = [
  { letterSpacing: 0, lines: BADGE_STRIP.nameLines, scale: 2 },
  { letterSpacing: -0.5, lines: BADGE_STRIP.nameLines, scale: 2 },
];

export interface BadgeRowNames {
  // Each name's lines, in the order the names came.
  readonly lines: string[][];
  readonly style: TextFitStyle;
}

// A strip's names in one style for the whole row, each broken at spaces into lines in a slot
// slotWidth wide less 2px each side: the first of BADGE_NAME_STYLES that sets every name on at
// most its lines, each no wider than the room as inkWidth measures it, else the last.
export function badgeRowNames(
  inkWidth: (style: TextFitStyle, line: string) => number,
  slotWidth: number,
  names: readonly string[],
): BadgeRowNames {
  const room = slotWidth - 4;
  const setIn = (style: TextFitStyle) =>
    names.map((name) => wrapWords((line) => inkWidth(style, line), room, name));
  const fits = (style: TextFitStyle, lines: readonly string[]) =>
    lines.length <= (style.lines ?? 1) && lines.every((line) => inkWidth(style, line) <= room);
  const style =
    BADGE_NAME_STYLES.find((tried) => setIn(tried).every((lines) => fits(tried, lines))) ??
    (BADGE_NAME_STYLES.at(-1) as TextFitStyle);
  return { lines: setIn(style), style };
}

export function celebrationTitle(data: Pick<GameData, "menuText">, count: number): string {
  const text = data.menuText.celebration;
  return count === 1
    ? text.titleOne
    : fillLine(MENU_TEXT_FIELDS.celebration, text, "titleMany", { count: String(count) });
}
