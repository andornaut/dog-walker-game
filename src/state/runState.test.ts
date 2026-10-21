import { describe, expect, it } from "vitest";

import { DEBUFFS } from "../data/debuffs";
import { DOGS } from "../data/dogs";
import { ENCOUNTERS } from "../data/encounters";
import { SHOP_GEAR } from "../data/shop";
import type { DogId, GearId } from "../data/types";
import { startHearts } from "../rules/dogs";
import { read } from "../rules/units";
import { heartsByDog } from "../testing/runState";
import { TEST_TUNING } from "../testing/tuning";
import { TEST_WALKER_DATA } from "../testing/walkers";
import { TEST_WORLD } from "../testing/world";
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
  Object.fromEntries(dogs.map((dog) => [dog, startHearts(data.tuning, [], DOGS[dog])]));

describe("newRun", () => {
  it("starts each owner at full hearts, walking, with the starting purse", () => {
    const dogs = ["duchess", "nugget", "pierre"] as const;
    const state = newRun(data, 3, { dogs, gear: null, walker: "casey" });
    expect(heartsByDog(state)).toEqual(startsOf(dogs));
    expect(state.money).toBe(read(TEST_TUNING, "money", "startPurse"));
    expect(state.phase).toEqual({ kind: "walking" });
    expect(state.zoneIndex).toBe(0);
  });

  it.each<{ expected: object; gear: GearId }>([
    {
      expected: {
        money:
          read(TEST_TUNING, "money", "startPurse") + read(TEST_TUNING, "money", "fannyPackStart"),
      },
      gear: "fannyPack",
    },
    { expected: { skipPass: true }, gear: "poopBags" },
  ])("starts with what the $gear gives", ({ expected, gear }) => {
    expect(newRun(data, 3, { dogs: ["koda"], gear, walker: "casey" })).toMatchObject(expected);
  });

  it("applies the walker's perk, then the gear, for the whole run", () => {
    const state = newRun(data, 3, { dogs: ["koda"], gear: "fannyPack", walker: "ben" });
    expect(state.walker).toBe("ben");
    const ben = { kind: "walker", walker: "ben" };
    const perk = data.walkerPerks[data.walkers.ben.perk];
    const perkModifiers = perk.effects.flatMap((effect) =>
      effect.kind === "modifier" ? [[effect.stat, effect.by, ben]] : [],
    );
    expect(state.modifiers.map(({ by, source, stat }) => [stat, by, source])).toEqual([
      ...perkModifiers,
      ["startMoney", "fannyPackStart", { gear: "fannyPack", kind: "gear" }],
    ]);
    expect(state.modifiers.every(({ untilZone }) => untilZone === undefined)).toBe(true);
  });

  it("takes no more dogs than the player owns slots", () => {
    const pair = { dogs: ["duchess", "koda"], gear: null, walker: "casey" } as const;
    expect(() => newRun(data, 1, pair)).toThrow("needs that many dog slots");
    expect(heartsByDog(newRun(data, 2, pair))).toEqual(startsOf(pair.dogs));
    expect(newRun(data, 1, { dogs: ["koda"], gear: null, walker: "casey" }).pack).toHaveLength(1);
  });

  it("rejects a dog listed twice", () => {
    expect(() => newRun(data, 3, { dogs: ["koda", "koda"], gear: null, walker: "casey" })).toThrow(
      "only once",
    );
  });

  it("survives a round trip through JSON unchanged", () => {
    const state = newRun(data, 3, {
      dogs: ["duchess", "koda"],
      gear: "luckyCollar",
      walker: "casey",
    });
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });
});
