import { describe, expect, it } from "vitest";

import { DEBUFFS } from "../data/debuffs";
import { DOGS } from "../data/dogs";
import type { ZoneId } from "../data/types";
import type { RunState } from "../state/runState";
import { activeModifier, heartsByDog, testState } from "../testing/runState";
import { TEST_TUNING } from "../testing/tuning";
import { TEST_WORLD } from "../testing/world";
import { fireOwnersAtZero, payZoneFees, tipValue } from "./run";
import { cents, read, readTable } from "./units";

const data = { debuffs: DEBUFFS, dogs: DOGS, tuning: TEST_TUNING, world: TEST_WORLD };
const bigTipper = activeModifier(
  { kind: "upgrade", upgrade: "bigTipper" },
  { by: "bigTipperTipBonus", operation: "add", stat: "tipValue" },
);
const stinky = { debuffs: [{ debuff: "stinky" }] } as const;
const shortcut = activeModifier(
  { kind: "upgrade", upgrade: "shortcut" },
  { by: "shortcutFees", operation: "multiply", stat: "fees" },
);

describe("tipValue", () => {
  const tip = read(TEST_TUNING, "money", "tip");
  const three = { duchess: 5, koda: 5, nugget: 5 };

  it.each<[string, RunState, number]>([
    ["a solo walk money.tip", testState({ koda: 5 }), tip],
    ["a pack of three money.tip too", testState(three), tip],
    [
      "Big tipper money.tip and its bonus",
      testState(three, { modifiers: [bigTipper] }),
      tip + read(TEST_TUNING, "money", "bigTipperTipBonus"),
    ],
    ["Stinky money.tip: it thins the tips instead", testState(three, stinky), tip],
    ["nothing with no dogs left", testState({ koda: "fired" }), 0],
  ])("pays %s", (_, state, amount) => {
    expect(tipValue(data, state).amount).toBe(amount);
  });

  it("gives the tip and each modifier as causes", () => {
    const bonus = read(TEST_TUNING, "money", "bigTipperTipBonus");
    expect(tipValue(data, testState({ koda: 5 }, { modifiers: [bigTipper] }))).toEqual({
      amount: tip + bonus,
      causes: [
        { amount: tip, kind: "tip" },
        { amount: bonus, kind: "modifier", source: { kind: "upgrade", upgrade: "bigTipper" } },
      ],
      dog: null,
      kind: "money",
    });
  });
});

describe("payZoneFees", () => {
  it("pays every dog still walking its owner's fee, one change per dog", () => {
    const { changes, state } = payZoneFees(
      data,
      testState({ duchess: 5, koda: "fired", zippy: 3 }),
    );
    expect(state.money).toBe(2300);
    expect(changes).toEqual([
      { amount: 1000, causes: [{ amount: 1000, kind: "fee" }], dog: "duchess", kind: "money" },
      { amount: 1300, causes: [{ amount: 1300, kind: "fee" }], dog: "zippy", kind: "money" },
    ]);
  });

  it("multiplies the fee by the zone's fee multiplier, and names the zone as a cause", () => {
    const [first, ...rest] = TEST_WORLD.zones;
    const world = {
      ...TEST_WORLD,
      zones: [{ ...first, fees: 1.5 }, ...rest] as typeof TEST_WORLD.zones,
    };
    const run = testState({ duchess: 5 }, { route: [first.id as ZoneId] });
    const { changes, state } = payZoneFees({ ...data, world }, run);
    expect(state.money).toBe(1500);
    expect(changes).toEqual([
      {
        amount: 1500,
        causes: [
          { amount: 1000, kind: "fee" },
          { amount: 500, kind: "zone", zone: first.name },
        ],
        dog: "duchess",
        kind: "money",
      },
    ]);
  });

  it("applies a fees modifier such as Shortcut, and names it as a cause", () => {
    const { changes, state } = payZoneFees(
      data,
      testState({ duchess: 5 }, { modifiers: [shortcut] }),
    );
    expect(state.money).toBe(800);
    expect(changes[0]?.causes).toEqual([
      { amount: 1000, kind: "fee" },
      { amount: -200, kind: "modifier", source: { kind: "upgrade", upgrade: "shortcut" } },
    ]);
  });

  it("rounds a fee a multiplier makes fractional to the nearest dollar, causes and all", () => {
    const fee =
      readTable(TEST_TUNING, "money", "feeByTemperament", "fussy") *
      read(TEST_TUNING, "multipliers", "shortcutFees");
    expect(fee % 100).not.toBe(0);
    const { changes, state } = payZoneFees(
      data,
      testState({ zippy: 5 }, { modifiers: [shortcut] }),
    );
    expect(state.money).toBe(Math.round(fee / 100) * 100);
    expect(changes[0]?.causes.reduce((total, { amount }) => total + amount, 0)).toBe(state.money);
  });
});

describe("fireOwnersAtZero", () => {
  it("marks the dog fired and keeps every earlier zone's fee and every tip", () => {
    const twoZones = payZoneFees(
      data,
      payZoneFees(data, testState({ duchess: 5, zippy: 5 })).state,
    ).state;
    const withTips = { ...twoZones, money: cents(twoZones.money + 300), zoneIndex: 2 };
    const emptied = {
      ...withTips,
      pack: testState({ duchess: 1, zippy: 0 }).pack,
    };
    const { fired, state } = fireOwnersAtZero(emptied);
    expect(fired).toEqual(["zippy"]);
    expect(state.money).toBe(withTips.money);
    expect(state.pack).toEqual([
      { dog: "duchess", hearts: 1, status: "walking" },
      { dog: "zippy", status: "fired", zoneIndex: 2 },
    ]);
    expect(heartsByDog(state)).toEqual({ duchess: 1 });
  });

  it("leaves the fired dog unpaid at the end of the zone it was fired in", () => {
    const { state } = fireOwnersAtZero(testState({ duchess: 5, zippy: 0 }));
    const { changes } = payZoneFees(data, state);
    expect(changes.map((change) => change.dog)).toEqual(["duchess"]);
  });
});
