import { describe, expect, it } from "vitest";

import { badgeKey } from "../assets/spriteKeys";
import { gameData } from "../data";
import type { AchievementCondition, DogId, WalkerId, ZoneId } from "../data/types";
import { assertNever } from "../lib/assertNever";
import { fillNames, wrapWords } from "../lib/lines";
import { cents, dollarsToCents } from "../rules/units";
import type { SaveDocument } from "../save/schema";
import { inkWidth } from "../testing/fontInk";
import { newPlayerSave } from "../testing/saves";
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
import { dollarText } from "./home";
import { STATS_LAYOUT } from "./statsLayout";

// The condition kinds a save counts across walks, and a save that has counted n of one.
const COUNTED_KINDS = [
  "bumps",
  "dogsFinishedWith",
  "firedByOwners",
  "lifetimeEarnings",
  "tally",
  "timesFired",
  "walkersFinishedWith",
  "walksPlayed",
  "walksWithoutFiring",
  "zonesEverFinished",
] as const satisfies readonly AchievementCondition["kind"][];
type Counted = Extract<AchievementCondition, { kind: (typeof COUNTED_KINDS)[number] }>;
const ALL_DOGS = Object.keys(gameData.dogs) as DogId[];
const ALL_WALKERS = Object.keys(gameData.walkers) as WalkerId[];
const ALL_ZONES = gameData.world.zones.map(({ id }) => id as ZoneId);
// How many a counted condition needs: dollars, or its count, where "all" is every dog (or its
// owner), walker or zone in the data.
function needOf(condition: Counted): number {
  const of = (all: readonly string[], count: number | "all") =>
    count === "all" ? all.length : count;
  switch (condition.kind) {
    case "lifetimeEarnings":
      return condition.dollars;
    case "bumps":
    case "tally":
    case "timesFired":
    case "walksPlayed":
    case "walksWithoutFiring":
      return condition.count;
    case "dogsFinishedWith":
    case "firedByOwners":
      return of(ALL_DOGS, condition.count);
    case "walkersFinishedWith":
      return of(ALL_WALKERS, condition.count);
    case "zonesEverFinished":
      return of(ALL_ZONES, condition.count);
    default:
      return assertNever(condition);
  }
}
// Starting cash across walks, which lifetime earnings leave out.
const STARTING_CASH = cents(4_000);
const isCounted = (condition: AchievementCondition): condition is Counted =>
  (COUNTED_KINDS as readonly string[]).includes(condition.kind);

function counted(condition: Counted, n: number): SaveDocument {
  const stats = newPlayerSave.stats;
  switch (condition.kind) {
    case "bumps":
      return { ...newPlayerSave, stats: { ...stats, bumpsByKind: { [condition.kinds[0]]: n } } };
    case "dogsFinishedWith":
      return { ...newPlayerSave, stats: { ...stats, dogsFinishedWith: ALL_DOGS.slice(0, n) } };
    case "firedByOwners": {
      const fired = { timesFired: 1, walks: 1, zonesFinished: 0 };
      const dogs = Object.fromEntries(ALL_DOGS.slice(0, n).map((dog) => [dog, fired]));
      return { ...newPlayerSave, stats: { ...stats, dogs } };
    }
    case "lifetimeEarnings":
      return {
        ...newPlayerSave,
        stats: {
          ...stats,
          lifetimeCents: cents(dollarsToCents(n) + STARTING_CASH),
          lifetimeStartCents: STARTING_CASH,
        },
      };
    case "walkersFinishedWith":
      return {
        ...newPlayerSave,
        stats: { ...stats, walkersFinishedWith: ALL_WALKERS.slice(0, n) },
      };
    case "walksPlayed":
      return {
        ...newPlayerSave,
        stats: { ...stats, runs: { finished: 0, noDogs: 0, wentHome: n } },
      };
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

// Progress as a badge of kind shows it: whole dollars for lifetime earnings, else the count, both
// with thousands separated.
const amountText = (kind: Counted["kind"], amount: number) =>
  kind === "lifetimeEarnings" ? dollarText(dollarsToCents(amount)) : amount.toLocaleString("en-US");
const progressText = (kind: Counted["kind"], have: number, need: number) =>
  fillNames(gameData.menuText.stats.badgeProgress, {
    have: amountText(kind, have),
    need: amountText(kind, need),
  });

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
        progressText(condition.kind, need - 1, need),
      );
      expect(badgeProgress(gameData, counted(condition, need * 2), locked), id).toBe(
        progressText(condition.kind, need, need),
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
    if (condition === undefined) {
      return undefined;
    }
    const need = needOf(condition);
    return progressText(condition.kind, need, need);
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
    expect(badgeStrip(layout, 1)).toEqual({ named: true, slots: [{ centreX: 180, width: 300 }] });
    const four = badgeStrip(layout, 4);
    expect(four.named).toBe(false);
    expect(four.slots.map(({ centreX }) => centreX)).toEqual([68, 143, 218, 293]);
  });
});
