import { badgeKey } from "../assets/spriteKeys";
import type { AchievementId, GameData } from "../data/types";
import type { Rect } from "../layout/rect";
import { type TextFitStyle, textFitStylesOnLines } from "../layout/textFit";
import type { SaveDocument } from "../save/schema";
import { fillLine } from "../text/lines";
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

export interface WallSpec {
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

export interface StripSlot {
  // The centre of the slot, where its badge sits.
  readonly centerX: number;
  readonly width: number;
}

export interface BadgeStrip {
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
