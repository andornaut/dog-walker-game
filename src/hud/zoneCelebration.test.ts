import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import type { WalkerId } from "../data/types";
import type { Change, MoneyChange } from "../rules/causes";
import { cents, type Hearts } from "../rules/units";
import { celebrationText, type ZoneCelebration, zoneCelebration } from "./zoneCelebration";

function money(kind: "bump" | "fee" | "tip", amount: number): MoneyChange {
  return {
    amount: cents(amount),
    causes: [{ amount, kind }],
    dog: kind === "fee" ? "koda" : null,
    kind: "money",
  };
}

const hearts: Change = {
  after: 3 as Hearts,
  before: 4 as Hearts,
  causes: [{ amount: -1, kind: "bump" }],
  dog: "koda",
  kind: "hearts",
};

const ZONE_CHANGES: readonly Change[] = [
  money("tip", 300),
  hearts,
  money("bump", -200),
  money("tip", 500),
  money("fee", 12000),
  money("fee", 6000),
];

describe("zoneCelebration", () => {
  // Each zone's walker joins only while not owned; a walker who joined earlier in the walk is
  // not owned yet, and still does not join again.
  it.each<{ expected: WalkerId | null; finished: number; owned: WalkerId[] }>([
    { expected: "ben", finished: 1, owned: ["casey"] },
    { expected: "ada", finished: 2, owned: ["casey"] },
    { expected: "trista", finished: 3, owned: ["casey"] },
    { expected: "ada", finished: 2, owned: ["casey", "ben"] },
    { expected: null, finished: 1, owned: ["casey", "ben"] },
    { expected: null, finished: 3, owned: ["ada", "ben", "casey", "trista"] },
  ])("finishing zone $finished owning $owned: $expected joins", ({ expected, finished, owned }) => {
    const finish = { changes: [], finished, walker: "casey", zone: "Elm Avenue" } as const;
    const joined = zoneCelebration(gameData, owned, finish);
    expect(joined.kind === "newWalker" ? joined.walker : null).toBe(expected);
  });

  it("counts the zone's fees and tips, and leaves out bumps and hearts", () => {
    const finish = {
      changes: ZONE_CHANGES,
      finished: 1,
      walker: "ben",
      zone: "Elm Avenue",
    } as const;
    expect(zoneCelebration(gameData, ["ben", "casey"], finish)).toEqual({
      fees: 18000,
      kind: "zoneDone",
      tips: 800,
      walker: "ben",
      zone: "Elm Avenue",
    });
  });
});

describe("celebrationText", () => {
  const text = gameData.runText;
  it.each<{ celebration: ZoneCelebration; expected: ReturnType<typeof celebrationText> }>([
    {
      celebration: {
        fees: cents(24000),
        kind: "zoneDone",
        tips: cents(3800),
        walker: "casey",
        zone: "Willow Crescent",
      },
      expected: {
        button: null,
        lines: [text.zoneDone.earnings.replace("{fees}", "$240").replace("{tips}", "$38")],
        title: text.zoneDone.title.replace("{zone}", "Willow Crescent"),
      },
    },
    {
      celebration: { kind: "newWalker", walker: "ben" },
      expected: {
        button: text.newWalker.button,
        lines: [
          text.card.walkerGreeting.replace("{walker}", "Ben"),
          text.newWalker.info.replace("{pace}", "Slow").replace("{style}", "Hustler"),
        ],
        title: text.newWalker.title.replace("{walker}", "Ben"),
      },
    },
  ])("writes $celebration.kind", ({ celebration, expected }) => {
    expect(celebrationText(gameData, celebration)).toEqual(expected);
  });
});
