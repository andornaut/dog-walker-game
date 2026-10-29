import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import type { Effect } from "../data/types";
import { dollarAmountText } from "../home/home";
import { type Cents, cents, clampHearts } from "../lib/units";
import type { Change } from "../rules/causes";
import { resolveEffects } from "../rules/effects";
import { formatDollars } from "../rules/effectText";
import { bumpCash, tipValue } from "../rules/run";
import { read } from "../rules/units";
import { activeModifier, testState } from "../testing/runState";
import { perkIconKey } from "./effectIcons";
import { type ChangeLabel, changeLabels, heartRows, reachedLabels, totalLabel } from "./hudView";

const { tuning } = gameData;
// Where the money changed hands.
const AT = { x: 120, y: 300 };
const skunkIgnore = { encounter: "skunk", kind: "encounter", option: 2 } as const;

const bigTipper = activeModifier(
  { kind: "upgrade", upgrade: "bigTipper" },
  { by: "bigTipperTipBonus", operation: "add", stat: "tipValue" },
);

describe("changeLabels", () => {
  it("labels each heart change at its dog and a tip by the cash, each by its amount alone", () => {
    const labels = changeLabels(AT, [
      {
        after: clampHearts(10, 3),
        before: clampHearts(10, 5),
        causes: [
          { amount: -1, kind: "effect", source: skunkIgnore },
          { amount: -1, kind: "modifier", source: { gear: "luckyCollar", kind: "gear" } },
        ],
        dog: "reggie",
        kind: "hearts",
      },
      {
        after: clampHearts(10, 6),
        before: clampHearts(10, 5),
        causes: [{ amount: 1, kind: "treat" }],
        dog: "kilo",
        kind: "hearts",
      },
      {
        amount: cents(200),
        causes: [
          { amount: 100, kind: "tip" },
          { amount: 100, kind: "modifier", source: { kind: "upgrade", upgrade: "bigTipper" } },
        ],
        dog: null,
        kind: "money",
      },
    ]);
    expect(labels).toEqual([
      {
        amount: -2,
        gain: false,
        target: { dog: "reggie", kind: "dog" },
        text: "−2♥",
      },
      {
        amount: 1,
        gain: true,
        target: { dog: "kilo", kind: "dog" },
        text: "+1♥",
      },
      {
        amount: 200,
        gain: true,
        target: { kind: "cash", tip: true },
        text: "+$2",
      },
    ]);
  });

  it("labels no heart change that nets nothing, such as a loss forgiven whole", () => {
    const forgiven = {
      after: clampHearts(10, 5),
      before: clampHearts(10, 5),
      causes: [
        { amount: -1, kind: "bump" },
        {
          amount: 1,
          forgives: true,
          kind: "modifier",
          source: { kind: "walker", walker: "casey" },
        },
      ],
      dog: "kilo",
      kind: "hearts",
    } as const;
    expect(changeLabels(AT, [forgiven])).toEqual([]);
  });

  // The heart pop over the dog and the label on its card both show the label's text; a loss
  // forgiven whole has neither.
  it.each([
    [1, [{ amount: 1, kind: "treat" }], ["+1♥"]],
    [-1, [{ amount: -1, kind: "bump" }], ["−1♥"]],
    [-10, [{ amount: -10, kind: "bump" }], ["−10♥"]],
    [
      0,
      [
        { amount: -1, kind: "bump" },
        {
          amount: 1,
          forgives: true,
          kind: "modifier",
          source: { kind: "walker", walker: "casey" },
        },
      ],
      [],
    ],
  ] as const)("shows a heart change of %i as %j", (amount, causes, texts) => {
    const change = {
      after: clampHearts(20, 15 + amount),
      before: clampHearts(20, 15),
      causes,
      dog: "kilo",
      kind: "hearts",
    } as const;
    expect(changeLabels(AT, [change]).map((label) => label.text)).toEqual(texts);
  });

  it.each([
    { by: { debuff: "stinky", kind: "debuff" }, zeroedBy: "stinky" },
    { by: { kind: "upgrade", upgrade: "bigTipper" }, zeroedBy: undefined },
  ] as const)("names $zeroedBy as what zeroed a tip cancelled by $by.kind", ({ by, zeroedBy }) => {
    const tip = {
      amount: cents(0),
      causes: [
        { amount: 100, kind: "tip" },
        { amount: -100, kind: "modifier", source: by },
      ],
      dog: null,
      kind: "money",
    } as const;
    expect(changeLabels(AT, [tip])[0]?.zeroedBy).toBe(zeroedBy);
  });

  it("names no debuff on a change a debuff only shrank", () => {
    const tip = {
      amount: cents(100),
      causes: [
        { amount: 200, kind: "tip" },
        { amount: -100, kind: "modifier", source: { debuff: "stinky", kind: "debuff" } },
      ],
      dog: null,
      kind: "money",
    } as const;
    expect(changeLabels(AT, [tip])[0]?.zeroedBy).toBeUndefined();
  });

  it("has no labels without changes, and marks a loss at the bank as no gain", () => {
    expect(changeLabels(AT, [])).toEqual([]);
    const bump = {
      amount: cents(-1000),
      causes: [{ amount: -1000, kind: "bump" }],
      dog: null,
      kind: "money",
    } as const;
    expect(changeLabels(AT, [bump])).toEqual([
      {
        amount: -1000,
        gain: false,
        target: { from: AT, kind: "bank" },
        text: "−$10",
      },
    ]);
  });
});

describe("totalLabel", () => {
  const paid = (amount: number, kind: "bonus" | "pay") =>
    ({ amount: cents(amount), causes: [{ amount, kind }], dog: null, kind: "money" }) as const;

  it.each([
    [
      "the fees and the Walk bonus",
      [paid(2000, "pay"), paid(2000, "pay"), paid(5000, "bonus")],
      "+$90",
    ],
    ["one fee", [paid(2000, "pay")], "+$20"],
  ] as const)("labels %s by the cash as one total", (_name, changes, text) => {
    expect(totalLabel(changes)).toEqual({
      amount: changes.reduce((sum, { amount }) => sum + amount, 0),
      gain: true,
      target: { kind: "cash", tip: false },
      text,
    });
  });

  it("labels nothing paid as nothing", () => {
    expect(totalLabel([])).toBeNull();
  });
});

describe("a money change's label", () => {
  const money = (amount: Cents, sign: "+" | "−") => `${sign}${formatDollars(amount)}`;
  const kilo = testState({ kilo: 5 });
  const resolved = (effect: Effect, source: Parameters<typeof resolveEffects>[1]["source"]) =>
    resolveEffects(gameData, { affected: ["kilo"], source }, [effect], kilo).changes;
  const spotlight = testState(
    { kilo: 5 },
    { debuffs: [{ debuff: "spotlight", secondsLeft: 20, untilZone: 0 }], money: cents(10_000) },
  );
  const stinky = testState(
    { kilo: 5 },
    { debuffs: [{ debuff: "stinky", secondsLeft: 20, untilZone: 0 }] },
  );
  const cash = (tip: boolean): ChangeLabel["target"] => ({ kind: "cash", tip });
  const bank: ChangeLabel["target"] = { from: AT, kind: "bank" };
  // A tip's and a Big tipper tip's text are the money counter's, below. Every gain's label pops
  // by the cash, and every loss's where the money changed hands.
  it.each([
    ["a tip", () => [tipValue(gameData, kilo)], null, cash(true)],
    ["a Stinky tip", () => [tipValue(gameData, stinky)], "+$0", cash(true)],
    [
      "a lucky find",
      () =>
        resolved(
          { amount: "lostWalletKeep", change: "gain", kind: "money" },
          { encounter: "lostWallet", kind: "instant" },
        ),
      money(read(tuning, "money", "lostWalletKeep"), "+"),
      cash(false),
    ],
    [
      "a card gain",
      () => resolved({ amount: "encounterLow", change: "gain", kind: "money" }, skunkIgnore),
      money(read(tuning, "money", "encounterLow"), "+"),
      cash(false),
    ],
    [
      "a card cost",
      () => resolved({ amount: "encounterLow", change: "lose", kind: "money" }, skunkIgnore),
      money(read(tuning, "money", "encounterLow"), "−"),
      bank,
    ],
    [
      "a Spotlight bump",
      () => [bumpCash(gameData, spotlight)].flatMap((change) => (change === null ? [] : [change])),
      money(read(tuning, "money", "spotlightBump"), "−"),
      bank,
    ],
  ] satisfies readonly [string, () => readonly Change[], string | null, ChangeLabel["target"]][])(
    "shows %s as its amount alone, at its target",
    (_name, changes, text, target) => {
      const labels = changeLabels(AT, changes());
      expect(labels.map((label) => label.target)).toEqual([target]);
      if (text !== null) {
        expect(labels.map((label) => label.text)).toEqual([text]);
      }
    },
  );
});

describe("the money counter", () => {
  it("moves the counter by the dollars a tip's label shows, a Big tipper tip's too", () => {
    for (const run of [
      testState({ kilo: 5 }),
      testState({ kilo: 5 }, { modifiers: [bigTipper] }),
    ]) {
      const tip = tipValue(gameData, run);
      const shown = (money: Cents) => Number(dollarAmountText(money).replaceAll(",", ""));
      const gain = shown(cents(run.money + tip.amount)) - shown(run.money);
      expect(changeLabels(AT, [tip])[0]?.text).toBe(`+$${gain}`);
    }
  });
});

describe("heartRows", () => {
  it("fills the first hearts, wraps past perRow, and has no rows for a meter of 0", () => {
    const [o, x] = [true, false];
    expect(heartRows(8, 2, 4)).toEqual([[o, o, x, x]]);
    expect(heartRows(8, 9, 11)).toEqual([
      [o, o, o, o, o, o, o, o],
      [o, x, x],
    ]);
    expect(heartRows(8, 0, 0)).toEqual([]);
  });
});

describe("reachedLabels", () => {
  const reach = perkIconKey("longReach");
  const tip: Change = {
    amount: cents(200),
    causes: [{ amount: 200, kind: "tip" }],
    dog: null,
    kind: "money",
  };
  const treat: Change = {
    after: clampHearts(10, 3),
    before: clampHearts(10, 2),
    causes: [{ amount: 1, kind: "treat" }],
    dog: "kilo",
    kind: "hearts",
  };
  it.each([
    ["a tip's money", tip],
    ["a treat's heart", treat],
  ])("carries the reaching buff's icon on %s label", (_name, change) => {
    const labels = changeLabels(AT, [change]);
    expect(reachedLabels(reach, labels)).toEqual(
      labels.map((label) => ({ ...label, reachIcon: reach })),
    );
  });

  it.each([
    ["a tip's money", tip],
    ["a treat's heart", treat],
  ])("keeps %s label as it is when not reached", (_name, change) => {
    const labels = changeLabels(AT, [change]);
    expect(reachedLabels(undefined, labels)).toEqual(labels);
  });
});
