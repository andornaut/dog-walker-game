import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { QUIPS } from "../data/quips";
import type { Cause, Change, MoneyChange } from "../rules/causes";
import { cents, type Hearts } from "../rules/units";
import { closingLines, earningsBreakdown, zonePips } from "./endView";

const money = (amount: number, base: Cause): MoneyChange => ({
  amount: cents(amount),
  causes: [base],
  dog: null,
  kind: "money",
});
const pay = (amount: number) => money(amount, { amount, kind: "pay" });
const tip = (amount: number) => money(amount, { amount, kind: "tip" });
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
  dog: "koda",
  kind: "hearts",
};

describe("earningsBreakdown", () => {
  const labels = gameData.menuText.end.earnings;

  it("totals pay, tips and card costs, and ignores heart changes", () => {
    const changes = [pay(1_000), tip(150), tip(100), card(-400), hearts, pay(1_000)];
    expect(earningsBreakdown(gameData, changes, cents(1_850))).toEqual([
      { amount: 2_000, kind: "fees", label: labels.fees },
      { amount: 250, kind: "tips", label: labels.tips },
      { amount: -400, kind: "cardCosts", label: labels.cardCosts },
    ]);
  });

  it("adds lucky finds and starting money only when the run had some", () => {
    const changes = [pay(1_000), card(500)];
    expect(
      earningsBreakdown(gameData, changes, cents(2_500)).map(({ amount, kind }) => [kind, amount]),
    ).toEqual([
      ["fees", 1_000],
      ["tips", 0],
      ["luckyFinds", 500],
      ["cardCosts", 0],
      ["start", 1_000],
    ]);
  });

  it("always adds up to the earnings", () => {
    const lines = earningsBreakdown(gameData, [pay(700), tip(55), card(-300)], cents(9_999));
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
      dogs: ["koda", "biscuit"] as const,
      firings: [{ dog: "biscuit" as const, zone: 2 }],
    };
    expect(closingLines({ quips: QUIPS }, () => 0, { ...walk, dogs: [...walk.dogs] })).toEqual([
      { dog: "koda", fired: false, text: QUIPS.koda.happier[0] },
      { dog: "biscuit", fired: true, text: QUIPS.biscuit.fired[0] },
    ]);
  });
});
