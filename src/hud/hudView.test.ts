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
import { changeLabels, heartRows } from "./hudView";

const { causes } = gameData.runText;
const { tuning } = gameData;
// Where the money changed hands.
const AT = { x: 120, y: 300 };

const bigTipper = activeModifier(
  { kind: "upgrade", upgrade: "bigTipper" },
  { by: "bigTipperTipBonus", operation: "add", stat: "tipValue" },
);

describe("changeLabels", () => {
  const skunkIgnore = { encounter: "skunk", kind: "encounter", option: 2 } as const;

  it("labels each heart change at its dog with its causes, and a tip by the cash", () => {
    const labels = changeLabels(gameData, AT, [
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
        text: `−2♥, ${gameData.shopGear.luckyCollar.name}`,
      },
      {
        amount: 1,
        gain: true,
        target: { dog: "kilo", kind: "dog" },
        text: `+1♥ ${causes.treat}`,
      },
      {
        amount: 200,
        gain: true,
        target: { kind: "cash" },
        text: "+$2",
      },
    ]);
  });

  it.each([
    ["a tip", [{ amount: 100, kind: "tip" }], { kind: "cash" }],
    [
      "a tip Stinky zeroed",
      [
        { amount: 100, kind: "tip" },
        { amount: -100, kind: "modifier", source: { debuff: "stinky", kind: "debuff" } },
      ],
      { kind: "cash" },
    ],
    ["a bump", [{ amount: -1000, kind: "bump" }], { from: AT, kind: "bank" }],
    [
      "a card option",
      [{ amount: 500, kind: "effect", source: skunkIgnore }],
      { from: AT, kind: "bank" },
    ],
  ] as const)("sends %s's label to %j", (_name, changeCauses, target) => {
    const amount = cents(changeCauses.reduce((sum, cause) => sum + cause.amount, 0));
    const change = { amount, causes: changeCauses, dog: null, kind: "money" } as const;
    expect(changeLabels(gameData, AT, [change])[0]?.target).toEqual(target);
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
    expect(changeLabels(gameData, AT, [forgiven])).toEqual([]);
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
    expect(changeLabels(gameData, AT, [tip])[0]?.zeroedBy).toBe(zeroedBy);
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
    expect(changeLabels(gameData, AT, [tip])[0]?.zeroedBy).toBeUndefined();
  });

  it("has no labels without changes, and marks a loss at the bank as no gain", () => {
    expect(changeLabels(gameData, AT, [])).toEqual([]);
    const bump = {
      amount: cents(-1000),
      causes: [{ amount: -1000, kind: "bump" }],
      dog: null,
      kind: "money",
    } as const;
    expect(changeLabels(gameData, AT, [bump])).toEqual([
      {
        amount: -1000,
        gain: false,
        target: { from: AT, kind: "bank" },
        text: "−$10",
      },
    ]);
  });
});

describe("a money change's label", () => {
  const money = (amount: Cents, sign: "+" | "−") => `${sign}${formatDollars(amount)}`;
  const tip = read(tuning, "money", "tip");
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
  it.each([
    ["a tip", () => [tipValue(gameData, kilo)], money(tip, "+")],
    [
      "a Big tipper tip",
      () => [tipValue(gameData, testState({ kilo: 5 }, { modifiers: [bigTipper] }))],
      money(cents(tip + read(tuning, "money", "bigTipperTipBonus")), "+"),
    ],
    ["a Stinky tip", () => [tipValue(gameData, stinky)], "+$0"],
    [
      "a lucky find",
      () =>
        resolved(
          { amount: "lostWalletKeep", change: "gain", kind: "money" },
          { encounter: "lostWallet", kind: "instant" },
        ),
      money(read(tuning, "money", "lostWalletKeep"), "+"),
    ],
    [
      "a card cost",
      () =>
        resolved(
          { amount: "encounterLow", change: "lose", kind: "money" },
          { encounter: "skunk", kind: "encounter", option: 2 },
        ),
      money(read(tuning, "money", "encounterLow"), "−"),
    ],
    [
      "a Spotlight bump",
      () => [bumpCash(gameData, spotlight)].flatMap((change) => (change === null ? [] : [change])),
      money(read(tuning, "money", "spotlightBump"), "−"),
    ],
  ] satisfies readonly [string, () => readonly Change[], string][])(
    "shows %s as its amount alone",
    (_name, changes, text) => {
      expect(changeLabels(gameData, AT, changes()).map((label) => label.text)).toEqual([text]);
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
      expect(changeLabels(gameData, AT, [tip])[0]?.text).toBe(`+$${gain}`);
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
