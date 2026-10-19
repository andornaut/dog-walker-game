import { describe, expect, it } from "vitest";

import { DEBUFFS } from "../data/debuffs";
import { DOGS } from "../data/dogs";
import { heartsByDog, testState } from "../testing/runState";
import { TEST_TUNING } from "../testing/tuning";
import { fireOwnersAtZero, payZoneFees, tipValue } from "./run";
import { cents } from "./units";

const data = { debuffs: DEBUFFS, dogs: DOGS, tuning: TEST_TUNING };

describe("tipValue", () => {
  it("pays more per tip the smaller the pack", () => {
    expect(tipValue(data, testState({ koda: 5 }))).toBe(150);
    expect(tipValue(data, testState({ duchess: 5, koda: 5 }))).toBe(125);
    expect(tipValue(data, testState({ duchess: 5, koda: 5, nugget: 5 }))).toBe(100);
  });

  it("counts only the dogs still walking", () => {
    expect(tipValue(data, testState({ duchess: "fired", koda: 5, nugget: "fired" }))).toBe(150);
  });

  it("applies Big tipper and Stinky on top of the pack-size factor", () => {
    const pack = { duchess: 5, koda: 5, nugget: 5 };
    const bigTipper = { by: "bigTipperTip", operation: "multiply", stat: "tipValue" } as const;
    expect(tipValue(data, testState(pack, { modifiers: [bigTipper] }))).toBe(150);
    expect(tipValue(data, testState(pack, { debuffs: ["stinky"] }))).toBe(50);
  });

  it("pays nothing with no dogs left", () => {
    expect(tipValue(data, testState({ koda: "fired" }))).toBe(0);
  });
});

describe("payZoneFees", () => {
  it("pays every dog still walking its owner's fee, and records it against the dog", () => {
    const state = payZoneFees(data, testState({ duchess: 5, koda: "fired", pierre: 3 }));
    expect(state.money).toBe(2300);
    expect(state.feesEarned).toEqual({ duchess: 1000, pierre: 1300 });
  });

  it("applies a fees modifier such as Shortcut", () => {
    const shortcut = { by: "shortcutFees", operation: "multiply", stat: "fees" } as const;
    const state = payZoneFees(data, testState({ duchess: 5 }, { modifiers: [shortcut] }));
    expect(state.money).toBe(cents(1000 * TEST_TUNING.multipliers.shortcutFees));
  });
});

describe("fireOwnersAtZero", () => {
  it("takes back every fee the fired dog earned, keeps the rest, and marks the dog fired", () => {
    const twoZones = payZoneFees(data, payZoneFees(data, testState({ duchess: 5, pierre: 5 })));
    const withTips = { ...twoZones, money: cents(twoZones.money + 300), zoneIndex: 2 };
    const emptied = {
      ...withTips,
      pack: testState({ duchess: 5, pierre: 0 }).pack,
    };
    const { fired, state } = fireOwnersAtZero(emptied);
    expect(fired).toEqual(["pierre"]);
    expect(state.money).toBe(2000 + 300);
    expect(state.feesEarned).toEqual({ duchess: 2000 });
    expect(state.pack).toEqual([
      { dog: "duchess", hearts: 5, status: "walking" },
      { dog: "pierre", status: "fired", zoneIndex: 2 },
    ]);
    expect(heartsByDog(state)).toEqual({ duchess: 5 });
  });

  it("never takes money below $0 when the fees were already spent", () => {
    const state = testState(
      { pierre: 0 },
      { feesEarned: { pierre: cents(1300) }, money: cents(500) },
    );
    expect(fireOwnersAtZero(state).state.money).toBe(0);
  });
});
