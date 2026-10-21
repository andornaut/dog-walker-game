import { describe, expect, it } from "vitest";

import { DEBUFFS } from "../data/debuffs";
import { DOGS } from "../data/dogs";
import type { ZoneId } from "../data/types";
import type { RunState } from "../state/runState";
import { activeModifier, heartsByDog, testState } from "../testing/runState";
import { TEST_TUNING } from "../testing/tuning";
import { TEST_WORLD } from "../testing/world";
import { fireOwnersAtZero, fullPackBonus, payZone, tipValue } from "./run";
import { read } from "./units";

const data = { debuffs: DEBUFFS, dogs: DOGS, tuning: TEST_TUNING, world: TEST_WORLD };
const bigTipper = activeModifier(
  { kind: "upgrade", upgrade: "bigTipper" },
  { by: "bigTipperTipBonus", operation: "add", stat: "tipValue" },
);
const stinky = { debuffs: [{ debuff: "stinky", secondsLeft: 20, untilZone: 0 }] } as const;

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
    [
      "Stinky money.tip times stinkyTipValue",
      testState(three, stinky),
      tip * read(TEST_TUNING, "multipliers", "stinkyTipValue"),
    ],
    [
      "Stinky with Big tipper money.tip times stinkyTipValue too",
      testState(three, { ...stinky, modifiers: [bigTipper] }),
      (tip + read(TEST_TUNING, "money", "bigTipperTipBonus")) *
        read(TEST_TUNING, "multipliers", "stinkyTipValue"),
    ],
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

describe("payZone", () => {
  const pay = read(TEST_TUNING, "money", "payPerDog");

  it.each<[string, RunState, readonly ("duchess" | "koda" | "zippy")[]]>([
    ["a lone dog", testState({ duchess: 5 }), ["duchess"]],
    [
      "two dogs walking of three",
      testState({ duchess: 5, koda: "fired", zippy: 3 }),
      ["duchess", "zippy"],
    ],
    ["three dogs", testState({ duchess: 5, koda: 5, zippy: 3 }), ["duchess", "koda", "zippy"]],
  ])("banks each walking dog's pay: %s", (_, run, walking) => {
    const { changes, state } = payZone(data, run);
    expect(state.money).toBe(run.money + pay * walking.length);
    expect(changes).toEqual(
      walking.map((dog) => ({
        amount: pay,
        causes: [{ amount: pay, kind: "pay" }],
        dog,
        kind: "money",
      })),
    );
  });

  it.each([1.5, 1.25])(
    "multiplies the pay by a zone multiplier of %d, rounded to the dollar, naming the zone",
    (multiplier) => {
      const [first, ...rest] = TEST_WORLD.zones;
      const world = {
        ...TEST_WORLD,
        zones: [{ ...first, fees: multiplier }, ...rest] as typeof TEST_WORLD.zones,
      };
      const run = testState({ duchess: 5, koda: 5, zippy: 5 }, { route: [first.id as ZoneId] });
      const { changes } = payZone({ ...data, world }, run);
      const paid = Math.round((pay * multiplier) / 100) * 100;
      expect(changes[0]).toEqual({
        amount: paid,
        causes: [
          { amount: pay, kind: "pay" },
          { amount: paid - pay, kind: "zone", zone: first.name },
        ],
        dog: "duchess",
        kind: "money",
      });
    },
  );
});

describe("fullPackBonus", () => {
  const perDog = read(TEST_TUNING, "money", "fullPackBonusPerDog");

  it.each<[string, RunState, number]>([
    [
      "pays the bonus per dog when every dog is still walking",
      testState({ duchess: 5, zippy: 3 }),
      2,
    ],
    ["pays nothing once an owner has fired you", testState({ duchess: 5, zippy: "fired" }), 0],
  ])("%s", (_, run, dogs) => {
    const { changes, state } = fullPackBonus(data, run);
    expect(state.money).toBe(run.money + perDog * dogs);
    expect(changes.map(({ amount }) => amount)).toEqual(dogs === 0 ? [] : [perDog * dogs]);
  });
});

describe("fireOwnersAtZero", () => {
  it("marks the dog fired and keeps the money banked", () => {
    const banked = payZone(data, testState({ duchess: 5, zippy: 5 })).state;
    const emptied = {
      ...banked,
      pack: testState({ duchess: 1, zippy: 0 }).pack,
      zoneIndex: 2,
    };
    const { fired, state } = fireOwnersAtZero(emptied);
    expect(fired).toEqual(["zippy"]);
    expect(state.money).toBe(banked.money);
    expect(state.pack).toEqual([
      { dog: "duchess", hearts: 1, status: "walking" },
      { dog: "zippy", status: "fired", zoneIndex: 2 },
    ]);
    expect(heartsByDog(state)).toEqual({ duchess: 1 });
  });

  it("pays the fired dog nothing at the end of the zone it was fired in", () => {
    const { state } = fireOwnersAtZero(testState({ duchess: 5, zippy: 0 }));
    const { changes } = payZone(data, state);
    expect(changes.map((change) => change.dog)).toEqual(["duchess"]);
  });
});
