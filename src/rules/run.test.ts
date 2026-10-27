import { describe, expect, it } from "vitest";

import { DEBUFFS } from "../data/debuffs";
import { DOGS } from "../data/dogs";
import type { ZoneId } from "../data/types";
import { WORLD } from "../data/world";
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
  const three = { duchess: 5, kilo: 5, reggie: 5 };

  it("pays tips by their modifiers", () => {
    for (const [, state, amount] of [
      ["a solo walk money.tip", testState({ kilo: 5 }), tip],
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
      ["nothing with no dogs left", testState({ kilo: "fired" }), 0],
    ] satisfies readonly [string, RunState, number][]) {
      expect(tipValue(data, state).amount).toBe(amount);
    }
  });

  it("gives the tip and each modifier as causes", () => {
    const bonus = read(TEST_TUNING, "money", "bigTipperTipBonus");
    expect(tipValue(data, testState({ kilo: 5 }, { modifiers: [bigTipper] }))).toEqual({
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

  it("banks each walking dog's pay", () => {
    for (const [, run, walking] of [
      ["a lone dog", testState({ duchess: 5 }), ["duchess"]],
      [
        "two dogs walking of three",
        testState({ duchess: 5, kilo: "fired", marshall: 3 }),
        ["duchess", "marshall"],
      ],
      [
        "three dogs",
        testState({ duchess: 5, kilo: 5, marshall: 3 }),
        ["duchess", "kilo", "marshall"],
      ],
    ] satisfies readonly [string, RunState, readonly ("duchess" | "kilo" | "marshall")[]][]) {
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
    }
  });

  it.each(WORLD.zones.map((zone) => [zone.name, zone.id as ZoneId] as const))(
    "pays each dog the same in %s as in every zone",
    (_name, zone) => {
      const run = testState({ duchess: 5, kilo: 5, marshall: 5 }, { route: [zone] });
      const { changes } = payZone(data, run);
      expect(changes.map(({ amount, causes }) => ({ amount, causes }))).toEqual(
        Array.from({ length: 3 }, () => ({ amount: pay, causes: [{ amount: pay, kind: "pay" }] })),
      );
    },
  );
});

describe("fullPackBonus", () => {
  const perDog = read(TEST_TUNING, "money", "fullPackBonusPerDog");

  it("ends the run by its rules", () => {
    for (const [, run, dogs] of [
      [
        "pays the bonus per dog when every dog is still walking",
        testState({ duchess: 5, marshall: 3 }),
        2,
      ],
      ["pays nothing once an owner has fired you", testState({ duchess: 5, marshall: "fired" }), 0],
    ] satisfies readonly [string, RunState, number][]) {
      const { changes, state } = fullPackBonus(data, run);
      expect(state.money).toBe(run.money + perDog * dogs);
      expect(changes.map(({ amount }) => amount)).toEqual(dogs === 0 ? [] : [perDog * dogs]);
    }
  });
});

describe("fireOwnersAtZero", () => {
  it("marks the dog fired and keeps the money banked", () => {
    const banked = payZone(data, testState({ duchess: 5, marshall: 5 })).state;
    const emptied = {
      ...banked,
      pack: testState({ duchess: 1, marshall: 0 }).pack,
      zoneIndex: 2,
    };
    const { fired, state } = fireOwnersAtZero(emptied);
    expect(fired).toEqual(["marshall"]);
    expect(state.money).toBe(banked.money);
    expect(state.pack).toEqual([
      { dog: "duchess", hearts: 1, status: "walking" },
      { dog: "marshall", status: "fired", zoneIndex: 2 },
    ]);
    expect(heartsByDog(state)).toEqual({ duchess: 1 });
  });

  it("pays the fired dog nothing at the end of the zone it was fired in", () => {
    const { state } = fireOwnersAtZero(testState({ duchess: 5, marshall: 0 }));
    const { changes } = payZone(data, state);
    expect(changes.map((change) => change.dog)).toEqual(["duchess"]);
  });
});
