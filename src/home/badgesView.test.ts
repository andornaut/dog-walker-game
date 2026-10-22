import { describe, expect, it } from "vitest";

import { badgeKey } from "../assets/spriteKeys";
import { gameData } from "../data";
import type { AchievementCondition, DogId, ZoneId } from "../data/types";
import { assertNever } from "../lib/assertNever";
import { fillNames, wrapWords } from "../lib/lines";
import { newPlayerSave } from "../save/fixtures";
import type { SaveDocument } from "../save/schema";
import { inkWidth } from "../testing/fontInk";
import { TEXT_SCALE } from "../ui/textFit";
import {
  badgeProgress,
  badgeStrip,
  badgeWall,
  earnedText,
  wallCell,
  wallCellLines,
  wallRects,
} from "./badgesView";
import { STATS_LAYOUT } from "./statsLayout";

// The condition kinds a save counts across walks, and a save that has counted n of one.
type Counted = Extract<
  AchievementCondition,
  {
    kind: "dogsFinishedWith" | "tally" | "timesFired" | "walksWithoutFiring" | "zonesEverFinished";
  }
>;
const COUNTED_KINDS: readonly string[] = [
  "dogsFinishedWith",
  "tally",
  "timesFired",
  "walksWithoutFiring",
  "zonesEverFinished",
];
const ALL_DOGS = Object.keys(gameData.dogs) as DogId[];
const ALL_ZONES = gameData.world.zones.map(({ id }) => id as ZoneId);
// How many a counted condition needs: "all" is every dog, or every zone, in the data.
const needOf = (condition: Counted) =>
  condition.count !== "all"
    ? condition.count
    : condition.kind === "zonesEverFinished"
      ? ALL_ZONES.length
      : ALL_DOGS.length;
const isCounted = (condition: AchievementCondition): condition is Counted =>
  COUNTED_KINDS.includes(condition.kind);

function counted(condition: Counted, n: number): SaveDocument {
  const stats = newPlayerSave.stats;
  switch (condition.kind) {
    case "dogsFinishedWith":
      return { ...newPlayerSave, stats: { ...stats, dogsFinishedWith: ALL_DOGS.slice(0, n) } };
    case "tally":
      return { ...newPlayerSave, stats: { ...stats, tallies: { [condition.tally]: n } } };
    case "timesFired":
      return { ...newPlayerSave, stats: { ...stats, timesFired: n } };
    case "walksWithoutFiring":
      return { ...newPlayerSave, stats: { ...stats, walksWithoutFiring: n } };
    case "zonesEverFinished":
      return { ...newPlayerSave, stats: { ...stats, zonesEverFinished: ALL_ZONES.slice(0, n) } };
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
    const [first] = gameData.achievements;
    const wall = badgeWall(gameData, { achievements: { [first.id]: 1, squirrel: 2 } });
    expect(wall).toHaveLength(gameData.achievements.length);
    expect(wall[0]).toMatchObject({ art: badgeKey(first.id), earned: true, name: first.name });
    expect(wall.filter(({ earned }) => earned).map(({ id }) => id)).toEqual([first.id, "squirrel"]);
    expect(earnedText(gameData, wall)).toBe(`2/${gameData.achievements.length} earned`);
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

  it("counts every counted badge's progress, capped at its count, and hides it once earned", () => {
    for (const { condition, id } of COUNTED_BADGES) {
      const locked = { earned: false, id };
      const need = needOf(condition);
      expect(badgeProgress(gameData, counted(condition, need - 1), locked), id).toBe(
        progressText(need - 1, need),
      );
      expect(badgeProgress(gameData, counted(condition, need * 2), locked), id).toBe(
        progressText(need, need),
      );
      expect(badgeProgress(gameData, counted(condition, 0), { earned: true, id })).toBeUndefined();
    }
  });
});

describe("wallCell", () => {
  const { wallText } = STATS_LAYOUT;
  const style = { letterSpacing: 0, scale: TEXT_SCALE };
  const bodyInk = (line: string) => inkWidth("font-body", style, line);
  const fitsTwoLines = (text: string) =>
    wrapWords(bodyInk, wallText.width, text).length <= wallText.lines - 1;
  // The widest progress a badge shows: its count over its count.
  const progressFor = (id: string) => {
    const condition = COUNTED_BADGES.find((badge) => badge.id === id)?.condition;
    return condition === undefined ? undefined : progressText(needOf(condition), needOf(condition));
  };

  it.each(badgeWall(gameData, newPlayerSave).map((badge) => [badge.name, badge] as const))(
    "fits %s's name, goal and any progress in its row at 2x",
    (_, badge) => {
      const progress = progressFor(badge.id);
      const cell = wallCell(wallText, bodyInk, badge, progress);
      const drawn = [...cell.name, ...cell.goal, ...cell.progress];
      expect(cell.whole).toBe(true);
      expect(drawn.length).toBeLessThanOrEqual(wallText.lines);
      expect(Math.max(...drawn.map(bodyInk))).toBeLessThanOrEqual(wallText.width);
      // A whole goal and any progress: the full goal wherever it fits in two lines.
      const goals = fitsTwoLines(badge.goal) ? [badge.goal] : [badge.goal, badge.shortGoal];
      const shown = goals.map((goal) => [goal, ...(progress === undefined ? [] : [progress])]);
      expect(shown.map((words) => words.join(" "))).toContain(
        [...cell.goal, ...cell.progress].join(" "),
      );
    },
  );
});

describe("wallCellLines", () => {
  // Lines of at most 8 characters.
  const wrap = (text: string) => wrapWords((line) => line.length, 8, text);
  const badge = { name: "Name", shortGoal: "Short" };
  it.each<[string, string, string[]]>([
    ["puts the progress on a line of its own when it fits", "Goal", ["Name", "Goal", "1/2"]],
    ["else ends the goal's last line with it", "Long goal", ["Name", "Long", "goal 1/2"]],
    ["else shows the short goal", "A much longer goal", ["Name", "Short", "1/2"]],
  ])("%s", (_, goal, lines) => {
    const cell = wallCellLines(3, wrap, { ...badge, goal }, "1/2");
    expect([...cell.name, ...cell.goal, ...cell.progress]).toEqual(lines);
  });
});

describe("wallRects", () => {
  // Each row as tall as its height, gap under the one before; the tap targets are the rows.
  const spec = { gap: 8, width: 316, x: 16, y: 138 };
  it.each<[string, number[], number[]]>([
    ["one row", [36], [138]],
    ["rows of mixed heights", [36, 56, 40], [138, 182, 246]],
  ])("lays out %s gap apart from the top", (_, heights, tops) => {
    const rects = wallRects(spec, heights);
    expect(rects).toEqual(
      heights.map((height, i) => ({ height, width: spec.width, x: spec.x, y: tops[i] })),
    );
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
