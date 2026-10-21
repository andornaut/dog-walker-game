import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { dollarAmountText } from "../home/home";
import { tipValue } from "../rules/run";
import { type Cents, cents, clampHearts } from "../rules/units";
import type { RunState } from "../state/runState";
import { activeModifier, testState } from "../testing/runState";
import { changeLabels, heartRows, pipLook, zonePips } from "./hudView";

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
          { amount: -1, kind: "temperament", temperament: "dramatic" },
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
        cause: "dramatic",
        gain: false,
        target: { dog: "nugget", kind: "dog" },
        text: "−2 ♥, dramatic",
      },
      {
        amount: 1,
        cause: "treat",
        gain: true,
        target: { dog: "koda", kind: "dog" },
        text: "+1 ♥ treat",
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
  it.each<[string, RunState]>([
    ["a tip", testState({ koda: 5 })],
    ["a Big tipper tip", testState({ koda: 5 }, { modifiers: [bigTipper] })],
  ])("moves the counter by the dollars %s's label shows", (_, run) => {
    const tip = tipValue(gameData, run);
    const shown = (money: Cents) => Number(dollarAmountText(money).replaceAll(",", ""));
    const gain = shown(cents(run.money + tip.amount)) - shown(run.money);
    expect(changeLabels(gameData, [tip])[0]?.text.split(" ")[0]).toBe(`+$${gain}`);
  });
});

describe("heartRows", () => {
  const [o, x] = [true, false];

  it.each([
    ["fills the first hearts and leaves the rest of the meter empty", 2, 4, [[o, o, x, x]]],
    [
      "wraps onto a second row past perRow, so 11 hearts take two rows",
      9,
      11,
      [
        [o, o, o, o, o, o, o, o],
        [o, x, x],
      ],
    ],
    ["has no rows for a meter of 0", 0, 0, []],
  ])("%s", (_name, hearts, max, expected) => {
    expect(heartRows(8, hearts, max)).toEqual(expected);
  });
});

describe("zonePips", () => {
  const done = { fill: 1, state: "done", zone: "street" } as const;
  const street = (fill: number) => ({ fill, state: "current", zone: "street" }) as const;
  const todo = { fill: 0, state: "todo", zone: null } as const;

  it.each<[string, Parameters<typeof zonePips>, ReturnType<typeof zonePips>]>([
    [
      "shows the route walked, the current zone part filled, and unknown forks ahead",
      [4, ["street", "pawsPromenade"], 1, 0.25],
      [done, { fill: 0.25, state: "current", zone: "pawsPromenade" }, todo, todo],
    ],
    [
      "shows the position after a zone as unknown until its fork is taken",
      [4, ["street"], 1, 0],
      [done, todo, todo, todo],
    ],
    ["keeps the fill at most 1", [1, ["street"], 0, 1.4], [street(1)]],
    ["keeps the fill at least 0", [1, ["street"], 0, -1], [street(0)]],
  ])("%s", (_name, args, expected) => {
    expect(zonePips(...args)).toEqual(expected);
  });
});

describe("pipLook", () => {
  it("tags each pip by its zone, and fills the current one in the zone's road colour", () => {
    const pips = zonePips(3, ["street", "park"], 1, 0.5).map((pip) => pipLook(gameData, pip));
    expect(pips).toEqual([
      { tag: "woof-way-done", wellColor: "#3a4466" },
      { tag: "bark-park", wellColor: "#e4a672" },
      { tag: "todo", wellColor: null },
    ]);
  });
});
