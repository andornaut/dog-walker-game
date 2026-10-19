import { badgeKey } from "../assets/spriteKeys";
import type { AchievementId, GameData } from "../data/types";
import type { Rect } from "../layout/rect";
import type { SaveDocument } from "../save/schema";

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

export function earnedText(badges: readonly Pick<BadgeView, "earned">[]): string {
  return `${badges.filter(({ earned }) => earned).length}/${badges.length} earned`;
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

export function celebrationTitle(count: number): string {
  return count === 1 ? "Badge earned!" : `${count} badges earned!`;
}
