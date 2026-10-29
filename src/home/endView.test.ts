import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { QUIPS } from "../data/quips";
import { cents, type Hearts } from "../lib/units";
import type { Cause, Change, MoneyChange } from "../rules/causes";
import { closingLines, earningsBreakdown, type EndTarget, endTargetAt, zonePips } from "./endView";

const money = (amount: number, base: Cause): MoneyChange => ({
  amount: cents(amount),
  causes: [base],
  dog: null,
  kind: "money",
});
const pay = (amount: number) => money(amount, { amount, kind: "pay" });
const tip = (amount: number) => money(amount, { amount, kind: "tip" });
const treat = (amount: number) => money(amount, { amount, kind: "treat" });
const card = (amount: number) =>
  money(amount, {
    amount,
    kind: "effect",
    source: { encounter: "thief", kind: "encounter", option: 0 },
  });
const hearts: Change = {
  after: 3 as Hearts,
  before: 4 as Hearts,
  causes: [],
  dog: "kilo",
  kind: "hearts",
};

describe("earningsBreakdown", () => {
  const labels = gameData.menuText.end.earnings;

  it("totals pay, tips and card costs, and ignores heart changes", () => {
    const changes = [pay(1_000), tip(150), tip(100), card(-400), hearts, pay(1_000)];
    expect(earningsBreakdown(gameData, changes, { earned: cents(1_850), lost: cents(0) })).toEqual([
      { amount: 2_000, kind: "fees", label: labels.fees },
      { amount: 250, kind: "tips", label: labels.tips },
      { amount: -400, kind: "cardCosts", label: labels.cardCosts },
    ]);
  });

  it("counts a treat's cash in the Tips row", () => {
    const changes = [pay(1_000), tip(100), treat(500)];
    expect(
      earningsBreakdown(gameData, changes, { earned: cents(1_600), lost: cents(0) }).map(
        ({ amount, kind }) => [kind, amount],
      ),
    ).toEqual([
      ["fees", 1_000],
      ["tips", 600],
      ["cardCosts", 0],
    ]);
  });

  it("adds lucky finds and starting money only when the run had some", () => {
    const changes = [pay(1_000), card(500)];
    expect(
      earningsBreakdown(gameData, changes, { earned: cents(2_500), lost: cents(0) }).map(
        ({ amount, kind }) => [kind, amount],
      ),
    ).toEqual([
      ["fees", 1_000],
      ["tips", 0],
      ["luckyFinds", 500],
      ["cardCosts", 0],
      ["start", 1_000],
    ]);
  });

  it("shows the cash lost when every owner fired you as a cost, left out of the earnings", () => {
    const changes = [pay(1_000), tip(300), card(-100)];
    expect(
      earningsBreakdown(gameData, changes, { earned: cents(1_000), lost: cents(200) }),
    ).toEqual([
      { amount: 1_000, kind: "fees", label: labels.fees },
      { amount: 300, kind: "tips", label: labels.tips },
      { amount: -100, kind: "cardCosts", label: labels.cardCosts },
      { amount: -200, kind: "cashLost", label: labels.cashLost },
    ]);
  });

  it.each([
    ["with no cash lost", 0],
    ["with cash lost", 400],
  ])("always adds up to the earnings %s", (_name, lost) => {
    const lines = earningsBreakdown(gameData, [pay(700), tip(55), card(-300)], {
      earned: cents(9_999),
      lost: cents(lost),
    });
    expect(lines.reduce((total, line) => total + line.amount, 0)).toBe(9_999);
  });
});

describe("zonePips", () => {
  it("marks finished zones done and the zone an early end stopped in current", () => {
    const cases: readonly [string, Parameters<typeof zonePips>[1], ReturnType<typeof zonePips>][] =
      [
        [
          "marks every zone done for a finished walk",
          { outcome: "finished", zonesFinished: 4 },
          ["done", "done", "done", "done"],
        ],
        [
          "marks the zone an early end stopped in as current",
          { outcome: "wentHome", zonesFinished: 2 },
          ["done", "done", "current", "todo"],
        ],
        [
          "marks the first zone current when every owner fired you in it",
          { outcome: "noDogs", zonesFinished: 0 },
          ["current", "todo", "todo", "todo"],
        ],
      ];
    for (const [, walk, expected] of cases) {
      expect(zonePips(4, walk)).toEqual(expected);
    }
  });
});

describe("closingLines", () => {
  it("has each owner say a happier line, or their fired line if they fired you", () => {
    const walk = {
      dogs: ["kilo", "biscuit"] as const,
      firings: ["biscuit" as const],
    };
    expect(closingLines({ quips: QUIPS }, () => 0, { ...walk, dogs: [...walk.dogs] })).toEqual([
      { dog: "kilo", fired: false, text: QUIPS.kilo.happier[0] },
      { dog: "biscuit", fired: true, text: QUIPS.biscuit.fired[0] },
    ]);
  });
});

describe("endTargetAt", () => {
  const badgeHits = [
    { height: 60, width: 100, x: 10, y: 400 },
    { height: 60, width: 100, x: 110, y: 400 },
  ];
  const button = { height: 44, width: 200, x: 50, y: 500 };
  it.each<[string, boolean, number, number, EndTarget | undefined]>([
    ["the first badge", false, 20, 420, { badge: 0 }],
    ["the second badge", false, 150, 459, { badge: 1 }],
    ["Head home", false, 60, 510, "home"],
    ["the panel's title, above the badges", false, 60, 399, undefined],
    ["a badge, with a card open", true, 20, 420, "dismiss"],
    ["Head home, with a card open", true, 60, 510, "dismiss"],
    ["bare screen, with a card open", true, 5, 5, "dismiss"],
  ])("a press on %s (card open: %s) lands on its target", (_, cardOpen, x, y, target) => {
    expect(endTargetAt({ badgeHits, button, cardOpen }, x, y)).toEqual(target);
  });
});
