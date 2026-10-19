import { describe, expect, it } from "vitest";

import { DEBUFFS } from "../data/debuffs";
import { DOGS } from "../data/dogs";
import { ENCOUNTERS } from "../data/encounters";
import { SHOP_GEAR } from "../data/shop";
import type { GearId, WalkerId } from "../data/types";
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

describe("newRun", () => {
  it("starts each owner at their temperament's hearts, walking, with no money", () => {
    const state = newRun(data, 3, { dogs: ["duchess", "nugget", "pierre"], gear: null });
    expect(heartsByDog(state)).toEqual({ duchess: 6, nugget: 5, pierre: 4 });
    expect(state.money).toBe(0);
    expect(state.phase).toEqual({ kind: "walking" });
    expect(state.zoneIndex).toBe(0);
  });

  it.each<{ expected: object; gear: GearId }>([
    { expected: { money: 1500 }, gear: "fannyPack" },
    { expected: { immunities: [{ encounter: "thief" }] }, gear: "whistle" },
    { expected: { skipsLeft: TEST_TUNING.counts.poopBagsSkipsPerRun }, gear: "poopBags" },
  ])("starts with what the $gear gives", ({ expected, gear }) => {
    expect(newRun(data, 3, { dogs: ["koda"], gear })).toMatchObject(expected);
  });

  it("applies the walker's pace and style, then the gear, for the whole run", () => {
    const state = newRun(data, 3, { dogs: ["koda"], gear: "fannyPack", walker: "ben" });
    expect(state.walker).toBe("ben");
    expect(state.modifiers.map(({ by, source }) => [by, source])).toEqual([
      ["slowWalkerSpeed", { kind: "walker", walker: "ben" }],
      ["slowWalkerFees", { kind: "walker", walker: "ben" }],
      ["hustlerTip", { kind: "walker", walker: "ben" }],
      ["fannyPackStart", { gear: "fannyPack", kind: "gear" }],
    ]);
    expect(state.modifiers.every(({ untilZone }) => untilZone === undefined)).toBe(true);
  });

  it.each<[WalkerId | undefined, number]>([
    ["ada", 8],
    ["ben", 6],
    ["casey", 8],
    ["trista", 6],
    [undefined, 8],
  ])("starts %s's owners with the charmer's extra hearts or none", (walker, hearts) => {
    const charming = {
      ...data,
      tuning: { ...TEST_TUNING, hearts: { ...TEST_TUNING.hearts, charmerStart: 2 } },
    };
    const loadout = {
      dogs: ["koda"],
      gear: null,
      ...(walker === undefined ? {} : { walker }),
    } as const;
    expect(heartsByDog(newRun(charming, 1, loadout))).toEqual({ koda: hearts });
  });

  it("takes no more dogs than the player owns slots", () => {
    const pair = { dogs: ["duchess", "koda"], gear: null } as const;
    expect(() => newRun(data, 1, pair)).toThrow("needs that many dog slots");
    expect(heartsByDog(newRun(data, 2, pair))).toEqual({ duchess: 6, koda: 6 });
    expect(newRun(data, 1, { dogs: ["koda"], gear: null }).pack).toHaveLength(1);
  });

  it("rejects a dog listed twice", () => {
    expect(() => newRun(data, 3, { dogs: ["koda", "koda"], gear: null })).toThrow("only once");
  });

  it("survives a round trip through JSON unchanged", () => {
    const state = newRun(data, 3, { dogs: ["duchess", "koda"], gear: "luckyCollar" });
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });
});
