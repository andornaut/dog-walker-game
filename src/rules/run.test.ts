import { describe, expect, it } from "vitest";

import { DEBUFFS } from "../data/debuffs";
import { DOGS } from "../data/dogs";
import type { ZoneId } from "../data/types";
import { activeModifier, heartsByDog, testState } from "../testing/runState";
import { TEST_TUNING } from "../testing/tuning";
import { TEST_WORLD } from "../testing/world";
import { fireOwnersAtZero, payZoneFees, tipValue } from "./run";
import { cents } from "./units";

const data = { debuffs: DEBUFFS, dogs: DOGS, tuning: TEST_TUNING, world: TEST_WORLD };
const bigTipper = activeModifier(
  { kind: "upgrade", upgrade: "bigTipper" },
  { by: "bigTipperTip", operation: "multiply", stat: "tipValue" },
);
const shortcut = activeModifier(
  { kind: "upgrade", upgrade: "shortcut" },
  { by: "shortcutFees", operation: "multiply", stat: "fees" },
);

describe("tipValue", () => {
  it("pays more per tip the smaller the pack", () => {
    expect(tipValue(data, testState({ koda: 5 })).amount).toBe(150);
    expect(tipValue(data, testState({ duchess: 5, koda: 5 })).amount).toBe(125);
    expect(tipValue(data, testState({ duchess: 5, koda: 5, nugget: 5 })).amount).toBe(100);
  });

  it("counts only the dogs still walking", () => {
    const pack = testState({ duchess: "fired", koda: 5, nugget: "fired" });
    expect(tipValue(data, pack).amount).toBe(150);
  });

  it("applies Big tipper and Stinky on top of the pack-size factor", () => {
    const pack = { duchess: 5, koda: 5, nugget: 5 };
    expect(tipValue(data, testState(pack, { modifiers: [bigTipper] })).amount).toBe(150);
    expect(tipValue(data, testState(pack, { debuffs: [{ debuff: "stinky" }] })).amount).toBe(50);
  });

  it("gives the tip, the pack-size factor and each modifier as causes", () => {
    const tip = tipValue(data, testState({ koda: 5 }, { debuffs: [{ debuff: "stinky" }] }));
    expect(tip).toEqual({
      amount: 75,
      causes: [
        { amount: 100, kind: "tip" },
        { amount: 50, kind: "packSize", packSize: 1 },
        { amount: -75, kind: "modifier", source: { debuff: "stinky", kind: "debuff" } },
      ],
      dog: null,
      kind: "money",
    });
  });

  it("leaves out the pack-size factor for a pack it does not change", () => {
    const tip = tipValue(data, testState({ duchess: 5, koda: 5, nugget: 5 }));
    expect(tip.causes).toEqual([{ amount: 100, kind: "tip" }]);
  });

  it("pays nothing with no dogs left", () => {
    expect(tipValue(data, testState({ koda: "fired" })).amount).toBe(0);
  });
});

describe("payZoneFees", () => {
  it("pays every dog still walking its owner's fee, and records it against the dog", () => {
    const { changes, state } = payZoneFees(
      data,
      testState({ duchess: 5, koda: "fired", pierre: 3 }),
    );
    expect(state.money).toBe(2300);
    expect(state.feesEarned).toEqual({ duchess: 1000, pierre: 1300 });
    expect(changes).toEqual([
      { amount: 1000, causes: [{ amount: 1000, kind: "fee" }], dog: "duchess", kind: "money" },
      { amount: 1300, causes: [{ amount: 1300, kind: "fee" }], dog: "pierre", kind: "money" },
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
    expect(state.feesEarned).toEqual({ duchess: 1500 });
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
    expect(state.money).toBe(750);
    expect(changes[0]?.causes).toEqual([
      { amount: 1000, kind: "fee" },
      { amount: -250, kind: "modifier", source: { kind: "upgrade", upgrade: "shortcut" } },
    ]);
  });
});

describe("fireOwnersAtZero", () => {
  it("takes back every fee the fired dog earned, keeps the rest, and marks the dog fired", () => {
    const twoZones = payZoneFees(
      data,
      payZoneFees(data, testState({ duchess: 5, pierre: 5 })).state,
    ).state;
    const withTips = { ...twoZones, money: cents(twoZones.money + 300), zoneIndex: 2 };
    const emptied = {
      ...withTips,
      pack: testState({ duchess: 1, pierre: 0 }).pack,
    };
    const { changes, fired, state } = fireOwnersAtZero(emptied);
    expect(fired).toEqual(["pierre"]);
    expect(state.money).toBe(2000 + 300);
    expect(state.feesEarned).toEqual({ duchess: 2000 });
    expect(state.pack).toEqual([
      { dog: "duchess", hearts: 1, status: "walking" },
      { dog: "pierre", status: "fired", zoneIndex: 2 },
    ]);
    expect(heartsByDog(state)).toEqual({ duchess: 1 });
    expect(changes).toEqual([
      {
        amount: -2600,
        causes: [{ amount: -2600, kind: "clawback" }],
        dog: "pierre",
        kind: "money",
      },
    ]);
  });

  it("never takes money below $0 when the fees were already spent", () => {
    const state = testState(
      { pierre: 0 },
      { feesEarned: { pierre: cents(1300) }, money: cents(500) },
    );
    const firing = fireOwnersAtZero(state);
    expect(firing.state.money).toBe(0);
    expect(firing.changes[0]?.causes).toEqual([
      { amount: -1300, kind: "clawback" },
      { amount: 800, bound: "min", kind: "limit" },
    ]);
  });
});
