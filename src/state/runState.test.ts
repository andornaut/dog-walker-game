import { describe, expect, it } from "vitest";

import { DEBUFFS } from "../data/debuffs";
import { DOGS } from "../data/dogs";
import { ENCOUNTERS } from "../data/encounters";
import { SHOP_GEAR } from "../data/shop";
import type { DogId, GearId } from "../data/types";
import { packPlace, sizeHearts, startHearts } from "../rules/dogs";
import { read } from "../rules/units";
import { heartsByDog } from "../testing/runState";
import { TEST_TUNING } from "../testing/tuning";
import { TEST_WALKER_DATA } from "../testing/walkers";
import { TEST_WORLD } from "../testing/world";
import { packOrder } from "./pack";
import { newRun } from "./runState";

const data = {
  debuffs: DEBUFFS,
  dogs: DOGS,
  encounters: ENCOUNTERS,
  shopGear: SHOP_GEAR,
  ...TEST_WALKER_DATA,
  tuning: TEST_TUNING,
  world: TEST_WORLD,
};

// Each dog's owner at their starting hearts: full.
const startsOf = (dogs: readonly DogId[]) =>
  Object.fromEntries(
    dogs.map((dog) => [
      dog,
      startHearts(data.tuning, [], packPlace(packOrder(DOGS, dogs), dog), DOGS[dog]),
    ]),
  );

describe("newRun", () => {
  it("starts each owner at full hearts, walking, with the starting purse", () => {
    const dogs = ["duchess", "reggie", "pierre"] as const;
    const state = newRun(data, 3, { dogs, gear: null, walker: "casey" });
    expect(heartsByDog(state)).toEqual(startsOf(dogs));
    expect(state.money).toBe(read(TEST_TUNING, "money", "startPurse"));
    expect(state.startMoney).toBe(state.money);
    expect(state.phase).toEqual({ kind: "walking" });
    expect(state.zoneIndex).toBe(0);
  });

  // Each pack, as picked, with its lead: the largest dog, ties in roster order.
  it.each([
    [["kilo"], "kilo"],
    [["pierre", "kilo"], "kilo"],
    [["duchess", "pierre"], "pierre"],
    [["duchess", "kilo", "pierre"], "kilo"],
  ] as const)(
    "adds the pack-size bonus to the lead's owner's max only, walking %j",
    (dogs, lead) => {
      const state = newRun(data, 3, { dogs, gear: null, walker: "casey" });
      const { packSizeBonus } = TEST_TUNING.hearts;
      expect(heartsByDog(state)).toEqual(
        Object.fromEntries(
          dogs.map((dog) => [
            dog,
            sizeHearts(TEST_TUNING, DOGS[dog]) + (dog === lead ? packSizeBonus[dogs.length] : 0),
          ]),
        ),
      );
    },
  );

  it("starts with what the gear gives", () => {
    const fannyPackPurse =
      read(TEST_TUNING, "money", "startPurse") + read(TEST_TUNING, "money", "fannyPackStart");
    for (const { expected, gear } of [
      {
        expected: {
          money: fannyPackPurse,
          startMoney: fannyPackPurse,
        },
        gear: "fannyPack",
      },
      { expected: { skipPass: { gear: "hallPass", kind: "gear" } }, gear: "hallPass" },
    ] satisfies readonly { expected: object; gear: GearId }[]) {
      expect(newRun(data, 3, { dogs: ["kilo"], gear, walker: "casey" })).toMatchObject(expected);
    }
  });

  it("applies the walker's perk, then the gear, for the whole run", () => {
    const state = newRun(data, 3, { dogs: ["kilo"], gear: "fannyPack", walker: "mrB" });
    expect(state.walker).toBe("mrB");
    const mrB = { kind: "walker", walker: "mrB" };
    const perk = data.walkerPerks[data.walkers.mrB.perk];
    const perkModifiers = perk.effects.flatMap((effect) =>
      effect.kind === "modifier" ? [[effect.stat, effect.by, mrB]] : [],
    );
    expect(state.modifiers.map(({ by, source, stat }) => [stat, by, source])).toEqual([
      ...perkModifiers,
      ["startMoney", "fannyPackStart", { gear: "fannyPack", kind: "gear" }],
    ]);
    expect(state.modifiers.every(({ untilZone }) => untilZone === undefined)).toBe(true);
  });

  it("takes no more dogs than the player owns slots", () => {
    const pair = { dogs: ["duchess", "kilo"], gear: null, walker: "casey" } as const;
    expect(() => newRun(data, 1, pair)).toThrow("needs that many dog slots");
    expect(heartsByDog(newRun(data, 2, pair))).toEqual(startsOf(pair.dogs));
    expect(newRun(data, 1, { dogs: ["kilo"], gear: null, walker: "casey" }).pack).toHaveLength(1);
  });

  it("rejects a dog listed twice", () => {
    expect(() => newRun(data, 3, { dogs: ["kilo", "kilo"], gear: null, walker: "casey" })).toThrow(
      "only once",
    );
  });

  it("survives a round trip through JSON unchanged", () => {
    const state = newRun(data, 3, {
      dogs: ["duchess", "kilo"],
      gear: "luckyCollar",
      walker: "casey",
    });
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });
});
