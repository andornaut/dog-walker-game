import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { dollarAmountText } from "../home/home";
import { tipValue } from "../rules/run";
import { type Cents, cents, clampHearts } from "../rules/units";
import { activeModifier, testState } from "../testing/runState";
import { changeLabels, heartRows, zonePips } from "./hudView";

const bigTipper = activeModifier(
  { kind: "upgrade", upgrade: "bigTipper" },
  { by: "bigTipperTipBonus", operation: "add", stat: "tipValue" },
);

describe("changeLabels", () => {
  const skunkIgnore = { encounter: "skunk", kind: "encounter", option: 2 } as const;

  it("labels each heart change at its dog and money at the bank, with their causes", () => {
    const labels = changeLabels(gameData, [
      {
        after: clampHearts(10, 3),
        before: clampHearts(10, 5),
        causes: [
          { amount: -1, kind: "effect", source: skunkIgnore },
          { amount: -1, kind: "modifier", source: { gear: "luckyCollar", kind: "gear" } },
        ],
        dog: "nugget",
        kind: "hearts",
      },
      {
        after: clampHearts(10, 6),
        before: clampHearts(10, 5),
        causes: [{ amount: 1, kind: "treat" }],
        dog: "koda",
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
        cause: gameData.shopGear.luckyCollar.name,
        gain: false,
        target: { dog: "nugget", kind: "dog" },
        text: `−2♥, ${gameData.shopGear.luckyCollar.name}`,
      },
      {
        amount: 1,
        cause: "treat",
        gain: true,
        target: { dog: "koda", kind: "dog" },
        text: "+1♥ treat",
      },
      {
        amount: 200,
        cause: "tip, Big tipper",
        gain: true,
        target: { kind: "bank" },
        text: "+$2 tip, Big tipper",
      },
    ]);
  });

  it("labels no heart change that nets nothing, such as a loss forgiven whole", () => {
    const forgiven = {
      after: clampHearts(10, 5),
      before: clampHearts(10, 5),
      causes: [
        { amount: -1, kind: "bump" },
        { amount: 1, kind: "modifier", source: { kind: "walker", walker: "casey" } },
      ],
      dog: "koda",
      kind: "hearts",
    } as const;
    expect(changeLabels(gameData, [forgiven])).toEqual([]);
  });

  it("has no labels without changes, and marks a loss at the bank as no gain", () => {
    expect(changeLabels(gameData, [])).toEqual([]);
    const bump = {
      amount: cents(-1000),
      causes: [{ amount: -1000, kind: "bump" }],
      dog: null,
      kind: "money",
    } as const;
    expect(changeLabels(gameData, [bump])).toEqual([
      {
        amount: -1000,
        cause: "bump",
        gain: false,
        target: { kind: "bank" },
        text: "−$10 bump",
      },
    ]);
  });
});

describe("the money counter", () => {
  it("moves the counter by the dollars a tip's label shows, a Big tipper tip's too", () => {
    for (const run of [
      testState({ koda: 5 }),
      testState({ koda: 5 }, { modifiers: [bigTipper] }),
    ]) {
      const tip = tipValue(gameData, run);
      const shown = (money: Cents) => Number(dollarAmountText(money).replaceAll(",", ""));
      const gain = shown(cents(run.money + tip.amount)) - shown(run.money);
      expect(changeLabels(gameData, [tip])[0]?.text.split(" ")[0]).toBe(`+$${gain}`);
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

describe("zonePips", () => {
  it("shows the route walked, the current zone part filled to 0..1, and unknown forks ahead", () => {
    const done = { fill: 1, state: "done", zone: "street" } as const;
    const todo = { fill: 0, state: "todo", zone: null } as const;
    expect(zonePips(4, ["street", "pawsPromenade"], 1, 0.25)).toEqual([
      done,
      { fill: 0.25, state: "current", zone: "pawsPromenade" },
      todo,
      todo,
    ]);
    expect(zonePips(4, ["street"], 1, 0)).toEqual([done, todo, todo, todo]);
    expect(zonePips(1, ["street"], 0, 1.4)[0]?.fill).toBe(1);
    expect(zonePips(1, ["street"], 0, -1)[0]?.fill).toBe(0);
  });
});
