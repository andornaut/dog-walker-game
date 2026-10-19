import { describe, expect, it } from "vitest";

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
const fee = (amount: number) => money(amount, { amount, kind: "fee" });
const tip = (amount: number) => money(amount, { amount, kind: "tip" });
const card = (amount: number) =>
  money(amount, {
    amount,
    kind: "effect",
    source: { encounter: "puddle", kind: "encounter", option: 0 },
  });
const hearts: Change = {
  after: 3 as Hearts,
  before: 4 as Hearts,
  causes: [],
  dog: "koda",
  kind: "hearts",
};

describe("earningsBreakdown", () => {
  it("totals fees, tips and card costs, and ignores heart changes", () => {
    const changes = [fee(1_000), tip(150), tip(100), card(-400), hearts, fee(1_000)];
    expect(earningsBreakdown(changes, cents(1_850))).toEqual([
      { amount: 2_000, kind: "fees", label: "Fees" },
      { amount: 250, kind: "tips", label: "Tips" },
      { amount: -400, kind: "cardCosts", label: "Card costs" },
    ]);
  });

  it("adds lucky finds, fees taken back and starting money only when the run had some", () => {
    const changes = [fee(1_000), card(500), money(-1_000, { amount: -1_000, kind: "clawback" })];
    expect(
      earningsBreakdown(changes, cents(1_500)).map(({ amount, kind }) => [kind, amount]),
    ).toEqual([
      ["fees", 1_000],
      ["tips", 0],
      ["luckyFinds", 500],
      ["cardCosts", 0],
      ["clawbacks", -1_000],
      ["start", 1_000],
    ]);
  });

  it("always adds up to the earnings", () => {
    const lines = earningsBreakdown([fee(700), tip(55), card(-300)], cents(9_999));
    expect(lines.reduce((total, line) => total + line.amount, 0)).toBe(9_999);
  });
});

describe("zonePips", () => {
  it.each<[string, Parameters<typeof zonePips>[1], ReturnType<typeof zonePips>]>([
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
  ])("%s", (_name, walk, expected) => {
    expect(zonePips(4, walk)).toEqual(expected);
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
