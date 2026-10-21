import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import type { AchievementCondition } from "../data/types";
import { assertNever } from "../rules/assertNever";
import { newPlayerSave } from "../save/fixtures";
import type { SaveDocument } from "../save/schema";
import { bodyTextWidth } from "../testing/bodyFont";
import { fillNames, wrapWords } from "../text/lines";
import {
  badgeProgress,
  badgeStrip,
  badgeWall,
  celebrationTitle,
  earnedText,
  wallCellLines,
  wallRects,
} from "./badgesView";
import { STATS_LAYOUT } from "./statsLayout";

// The condition kinds a save counts across walks, and a save that has counted n of one.
type Counted = Extract<
  AchievementCondition,
  { kind: "tally" | "timesFired" | "walksWithoutFiring" }
>;
const COUNTED_KINDS: readonly string[] = ["tally", "timesFired", "walksWithoutFiring"];
const isCounted = (condition: AchievementCondition): condition is Counted =>
  COUNTED_KINDS.includes(condition.kind);

function counted(condition: Counted, n: number): SaveDocument {
  const stats = newPlayerSave.stats;
  switch (condition.kind) {
    case "tally":
      return { ...newPlayerSave, stats: { ...stats, tallies: { [condition.tally]: n } } };
    case "timesFired":
      return { ...newPlayerSave, stats: { ...stats, timesFired: n } };
    case "walksWithoutFiring":
      return { ...newPlayerSave, stats: { ...stats, walksWithoutFiring: n } };
    default:
      return assertNever(condition);
  }
}

const COUNTED_BADGES = gameData.achievements.flatMap((achievement) => {
  const [condition, ...rest] = achievement.conditions;
  return rest.length === 0 && isCounted(condition) ? [{ condition, id: achievement.id }] : [];
});

const progressText = (have: number, need: number) =>
  fillNames(gameData.menuText.stats.badgeProgress, { have: String(have), need: String(need) });

describe("badgeWall", () => {
  it("lists every badge in wall order, earned by the save or locked", () => {
    const wall = badgeWall(gameData, { achievements: { firstSteps: 1, squirrel: 2 } });
    expect(wall).toHaveLength(gameData.achievements.length);
    expect(wall[0]).toMatchObject({ art: "badge-first-steps", earned: true, name: "First Steps" });
    expect(wall.filter(({ earned }) => earned).map(({ id }) => id)).toEqual([
      "firstSteps",
      "squirrel",
    ]);
    expect(earnedText(gameData, wall)).toBe(`2/${gameData.achievements.length} earned`);
  });

  it("falls back to the full goal where there is no short one", () => {
    const wall = badgeWall(gameData, newPlayerSave);
    const favourite = wall.find(({ id }) => id === "neighbourhoodFavourite");
    expect(favourite?.shortGoal).not.toBe(favourite?.goal);
    expect(wall[0]?.shortGoal).toBe(wall[0]?.goal);
  });
});

describe("badgeProgress", () => {
  it("shows on exactly the locked badges whose one condition counts across walks", () => {
    const shown = badgeWall(gameData, newPlayerSave)
      .filter((badge) => badgeProgress(gameData, newPlayerSave, badge) !== undefined)
      .map(({ id }) => id);
    expect(COUNTED_BADGES.length).toBeGreaterThan(0);
    expect(shown).toEqual(COUNTED_BADGES.map(({ id }) => id));
  });

  it.each(COUNTED_BADGES.map(({ condition, id }) => [id, condition] as const))(
    "counts %s's progress, capped at its count, and hides it once earned",
    (id, condition) => {
      const locked = { earned: false, id };
      const need = condition.count;
      expect(badgeProgress(gameData, counted(condition, need - 1), locked)).toBe(
        progressText(need - 1, need),
      );
      expect(badgeProgress(gameData, counted(condition, need * 2), locked)).toBe(
        progressText(need, need),
      );
      expect(badgeProgress(gameData, counted(condition, 0), { earned: true, id })).toBeUndefined();
    },
  );
});

describe("wallCellLines", () => {
  const { lines, scale, width } = STATS_LAYOUT.wallText;
  const wrap = (text: string) => wrapWords((line) => bodyTextWidth(scale, line), width, text);
  // The widest progress a badge shows: its count over its count.
  const progressFor = (id: string) => {
    const condition = COUNTED_BADGES.find((badge) => badge.id === id)?.condition;
    return condition === undefined ? undefined : progressText(condition.count, condition.count);
  };

  it.each(badgeWall(gameData, newPlayerSave).map((badge) => [badge.name, badge] as const))(
    "fits %s's name, a whole goal and any progress in its wall cell, in the body font",
    (_, badge) => {
      const progress = progressFor(badge.id);
      const cell = wallCellLines(lines, wrap, badge, progress);
      const drawn = [...cell.name, ...cell.goal, ...cell.progress];
      expect(drawn.length).toBeLessThanOrEqual(lines);
      expect(drawn.every((line) => bodyTextWidth(scale, line) <= width)).toBe(true);
      expect([wrap(badge.goal), wrap(badge.shortGoal)]).toContainEqual(cell.goal);
      expect(cell.progress).toEqual(progress === undefined ? [] : [progress]);
    },
  );
});

describe("wallRects", () => {
  it("fills each column down before the next", () => {
    const spec = { columnGap: 8, columnWidth: 168, rowHeight: 52, rows: 8, x: 8, y: 212 };
    const rects = wallRects(spec, 15);
    expect(rects[0]).toEqual({ height: 52, width: 168, x: 8, y: 212 });
    expect(rects[7]).toEqual({ height: 52, width: 168, x: 8, y: 212 + 7 * 52 });
    expect(rects[8]).toEqual({ height: 52, width: 168, x: 184, y: 212 });
  });
});

describe("badgeStrip", () => {
  it("shares the width, naming the badges only while few share it", () => {
    const layout = { maxNamed: 3, width: 300, x: 30 };
    expect(badgeStrip(layout, 1)).toEqual({ named: true, slots: [{ centerX: 180, width: 300 }] });
    const four = badgeStrip(layout, 4);
    expect(four.named).toBe(false);
    expect(four.slots.map(({ centerX }) => centerX)).toEqual([68, 143, 218, 293]);
  });
});

describe("celebrationTitle", () => {
  it("counts more than one badge", () => {
    expect(celebrationTitle(gameData, 1)).toBe("Badge earned!");
    expect(celebrationTitle(gameData, 3)).toBe("3 badges earned!");
  });
});
