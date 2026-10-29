import { describe, expect, it } from "vitest";

import { DEBUFFS } from "../data/debuffs";
import { DOGS } from "../data/dogs";
import type { ZoneId } from "../data/types";
import { WORLD } from "../data/world";
import { cents } from "../lib/units";
import type { EndReason, RunState } from "../state/runState";
import { activeModifier, heartsByDog, testState } from "../testing/runState";
import { TEST_TUNING } from "../testing/tuning";
import { TEST_WORLD } from "../testing/world";
import {
  endReasonOf,
  fireOwnersAtZero,
  fullPackBonus,
  payZone,
  tipValue,
  walkEarnings,
} from "./run";
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
        testState({ buddy: 3, duchess: 5, kilo: "fired" }),
        ["buddy", "duchess"],
      ],
      ["three dogs", testState({ buddy: 3, duchess: 5, kilo: 5 }), ["buddy", "duchess", "kilo"]],
    ] satisfies readonly [string, RunState, readonly ("buddy" | "duchess" | "kilo")[]][]) {
      const { changes, state } = payZone(data, { ...run, money: cents(500) });
      expect(state.money).toBe(500 + pay * walking.length);
      expect(state.zoneEndMoney).toBe(state.money);
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
      const run = testState({ buddy: 5, duchess: 5, kilo: 5 }, { route: [zone] });
      const { changes } = payZone(data, run);
      expect(changes.map(({ amount, causes }) => ({ amount, causes }))).toEqual(
        Array.from({ length: 3 }, () => ({ amount: pay, causes: [{ amount: pay, kind: "pay" }] })),
      );
    },
  );
});

describe("fullPackBonus", () => {
  const bonus = read(TEST_TUNING, "money", "walkBonus");

  it("ends the run by its rules", () => {
    for (const [, run, paid] of [
      [
        "pays the bonus once when every dog is still walking",
        testState({ buddy: 3, duchess: 5 }),
        1,
      ],
      ["pays nothing once an owner has fired you", testState({ buddy: "fired", duchess: 5 }), 0],
    ] satisfies readonly [string, RunState, number][]) {
      const { changes, state } = fullPackBonus(data, run);
      expect(state.money).toBe(run.money + bonus * paid);
      expect(changes.map(({ amount }) => amount)).toEqual(paid === 0 ? [] : [bonus]);
    }
  });
});

describe("fireOwnersAtZero", () => {
  it("marks the dog fired and keeps the money banked", () => {
    const banked = payZone(data, testState({ buddy: 5, duchess: 5 })).state;
    const emptied = {
      ...banked,
      pack: testState({ buddy: 0, duchess: 1 }).pack,
      zoneIndex: 2,
    };
    const { fired, state } = fireOwnersAtZero(emptied);
    expect(fired).toEqual(["buddy"]);
    expect(state.money).toBe(banked.money);
    expect(state.zoneEndMoney).toBe(banked.zoneEndMoney);
    expect(state.phase).toEqual({ kind: "walking" });
    expect(state.pack).toEqual([
      { dog: "buddy", status: "fired", zoneIndex: 2 },
      { dog: "duchess", hearts: 1, status: "walking" },
    ]);
    expect(heartsByDog(state)).toEqual({ duchess: 1 });
  });

  it("pays the fired dog nothing at the end of the zone it was fired in", () => {
    const { state } = fireOwnersAtZero(testState({ buddy: 0, duchess: 5 }));
    const { changes } = payZone(data, state);
    expect(changes.map((change) => change.dog)).toEqual(["duchess"]);
  });
});

describe("endReasonOf", () => {
  it.each<[string, RunState["phase"], EndReason]>([
    ["a walk not yet ended, as heading home", { kind: "walking" }, "wentHome"],
    ["a finished walk", { kind: "ended", reason: "finished" }, "finished"],
    ["a walk every owner fired you out of", { kind: "ended", reason: "noDogs" }, "noDogs"],
    ["a walk that headed home", { kind: "ended", reason: "wentHome" }, "wentHome"],
  ])("ends %s", (_name, phase, reason) => {
    expect(endReasonOf({ phase })).toBe(reason);
  });
});

describe("walkEarnings", () => {
  // Paid at a zone's end, then a tip earned in the next zone.
  const paid = payZone(data, testState({ buddy: 5, duchess: 5 })).state;
  const tip = tipValue(data, paid).amount;
  const tipped: RunState = { ...paid, money: cents(paid.money + tip) };
  // A card cost that spends the tip and some of the zone's end money too.
  const spent: RunState = { ...tipped, money: cents(paid.money - tip) };
  const early = ["noDogs", "wentHome"] as const;

  it.each([
    ["at a fork, with nothing earned since the zone's end", paid, paid.money],
    ["mid-zone, losing what the zone earned since its end", tipped, paid.money],
    ["after card costs spent below the zone's end money, keeping what is left", spent, spent.money],
  ] satisfies [string, RunState, number][])(
    "an early end keeps the last zone's end money at most: %s",
    (_name, run, banked) => {
      for (const reason of early) {
        expect(walkEarnings(reason, run)).toEqual({ banked, lost: run.money - banked });
      }
    },
  );

  it("an early end in the first zone keeps only the starting money", () => {
    const run: RunState = { ...tipped, zoneEndMoney: tipped.startMoney };
    for (const reason of early) {
      expect(walkEarnings(reason, run).banked).toBe(tipped.startMoney);
    }
  });

  it.each([
    ["mid-zone", tipped],
    ["after card costs", spent],
  ] satisfies [string, RunState][])("a finished walk banks all its money: %s", (_name, run) => {
    expect(walkEarnings("finished", run)).toEqual({ banked: run.money, lost: 0 });
  });
});
