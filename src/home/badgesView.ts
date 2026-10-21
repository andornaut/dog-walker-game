import { badgeKey } from "../assets/spriteKeys";
import type { AchievementId, GameData } from "../data/types";
import { fillLine, wrapWords } from "../lib/lines";
import type { Rect } from "../lib/rect";
import { achievementProgress } from "../rules/achievements";
import type { SaveDocument } from "../save/schema";
import type { FontMetrics } from "../ui/fontMetrics";
import { TEXT_FIT_STYLES, type TextFitStyle, textFitStylesOnLines } from "../ui/textFit";
import { MENU_TEXT_FIELDS } from "./menuText";

export interface BadgeView {
  readonly art: string;
  readonly badgeLine: string;
  readonly earned: boolean;
  readonly goal: string;
  readonly id: AchievementId;
  readonly name: string;
  // The goal to show when the full one does not fit beside the name.
  readonly shortGoal: string;
}

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
  data: Pick<GameData, "achievements" | "dogs" | "menuText">,
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

interface WallCellLines {
  readonly goal: string[];
  readonly name: string[];
  readonly progress: string[];
  // Whether the name, a whole goal and any progress all fit the lines.
  readonly whole: boolean;
}

// A wall cell's text, broken into lines by wrap: the name, then the goal, then the progress
// when there is one. The goal is the full one when it fits the lines left, else the short one.
// When neither fits with the progress on a line of its own, the progress ends the goal's last
// line instead; failing that, the short goal is cut to the lines left.
export function wallCellLines(
  lines: number,
  wrap: (text: string) => string[],
  badge: Pick<BadgeView, "goal" | "name" | "shortGoal">,
  progress: string | undefined,
): WallCellLines {
  const name = wrap(badge.name);
  const left = lines - name.length;
  const own = progress === undefined ? [] : [progress];
  const goals = [badge.goal, badge.shortGoal];
  const whole = goals.map(wrap).find((goal) => goal.length + own.length <= left);
  if (whole !== undefined) {
    return { goal: whole, name, progress: own, whole: true };
  }
  const inline =
    progress === undefined
      ? undefined
      : goals.map((goal) => wrap(`${goal} ${progress}`)).find((goal) => goal.length <= left);
  if (inline !== undefined) {
    return { goal: inline, name, progress: [], whole: true };
  }
  return {
    goal: wrap(badge.shortGoal).slice(0, Math.max(0, left - own.length)),
    name: name.slice(0, lines),
    progress: own,
    whole: false,
  };
}

// A wall cell's text set in the first of TEXT_FIT_STYLES that holds it whole (wallCellLines),
// each line's ink no wider than the cell's width as inkWidth measures it; else in the last
// style, cut to its lines. The cell holds lines lines at scale, and more at a smaller scale.
export function wallCell(
  cell: { readonly lines: number; readonly scale: number; readonly width: number },
  inkWidth: (style: TextFitStyle, line: string) => number,
  badge: Pick<BadgeView, "goal" | "name" | "shortGoal">,
  progress: string | undefined,
): WallCellLines & { readonly style: TextFitStyle } {
  const set = (style: TextFitStyle) => {
    const width = (line: string) => inkWidth(style, line);
    const lines = Math.floor((cell.lines * cell.scale) / style.scale);
    const fitted = wallCellLines(
      lines,
      (text) => wrapWords(width, cell.width, text),
      badge,
      progress,
    );
    const drawn = [...fitted.name, ...fitted.goal, ...fitted.progress];
    return {
      ...fitted,
      style,
      whole: fitted.whole && drawn.every((line) => width(line) <= cell.width),
    };
  };
  const sets = TEXT_FIT_STYLES.map(set);
  return sets.find(({ whole }) => whole) ?? (sets.at(-1) as ReturnType<typeof set>);
}

interface WallSpec {
  readonly columnGap: number;
  readonly columnWidth: number;
  readonly rowHeight: number;
  readonly rows: number;
  readonly x: number;
  readonly y: number;
}

// Each badge's tap target, filled down each column before the next.
export function wallRects(spec: WallSpec, count: number): Rect[] {
  return Array.from({ length: count }, (_, i) => ({
    height: spec.rowHeight,
    width: spec.columnWidth,
    x: spec.x + Math.floor(i / spec.rows) * (spec.columnWidth + spec.columnGap),
    y: spec.y + (i % spec.rows) * spec.rowHeight,
  }));
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
// badgeSize square from badgeTop, and its name's first capitals nameGap under the badge, each
// further line a line of the body font at the name's scale lower.
export const BADGE_STRIP = { badgeSize: 32, badgeTop: 34, maxNamed: 3, nameGap: 6, titleY: 10 };

// The panel of badges earned away from a walk's end, as tall as badgesHeight, then a row of
// faces facesHeight tall when owners cheer; its names take up to nameLines lines.
export const CELEBRATION_PANEL = {
  badgesHeight: 118,
  facesHeight: 44,
  nameLines: 2,
  width: 344,
  x: 8,
} as const;

// The capitals' top of each of a name's lines lines at scale, under a strip whose panel's top
// is top.
export function badgeNameTops(
  body: FontMetrics,
  scale: number,
  lines: number,
  top: number,
): number[] {
  const { badgeSize, badgeTop, nameGap } = BADGE_STRIP;
  const first = top + badgeTop + badgeSize + nameGap;
  return Array.from({ length: lines }, (_, n) => first + n * body.lineHeight * scale);
}

// A badge's name under it in a strip: on up to nameLines lines at 2x, with its glyphs closer,
// or at 1x, by TEXT_FIT_STYLES, within its slot less 2px each side.
export function badgeNameFit(
  nameLines: number,
  slot: StripSlot,
): { room: number; styles: TextFitStyle[] } {
  return {
    room: slot.width - 4,
    styles: textFitStylesOnLines(nameLines),
  };
}

export function celebrationTitle(data: Pick<GameData, "menuText">, count: number): string {
  const text = data.menuText.celebration;
  return count === 1
    ? text.titleOne
    : fillLine(MENU_TEXT_FIELDS.celebration, text, "titleMany", { count: String(count) });
}
