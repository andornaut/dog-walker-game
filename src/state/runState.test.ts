import { describe, expect, it } from "vitest";

import { DEBUFFS } from "../data/debuffs";
import { DOGS } from "../data/dogs";
import { SHOP_GEAR } from "../data/shop";
import type { GearId } from "../data/types";
import { heartsByDog } from "../testing/runState";
import { TEST_TUNING } from "../testing/tuning";
import { TEST_WORLD } from "../testing/world";
import { newRun } from "./runState";

const gearSource = (gear: GearId) => ({ source: { gear, kind: "gear" } });

const data = {
  debuffs: DEBUFFS,
  dogs: DOGS,
  shopGear: SHOP_GEAR,
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
    { expected: { modifiers: [gearSource("fannyPack")], money: 1500 }, gear: "fannyPack" },
    { expected: { immunities: [{ encounter: "thief" }] }, gear: "whistle" },
    { expected: { skipsLeft: TEST_TUNING.counts.poopBagsSkipsPerRun }, gear: "poopBags" },
  ])("starts with what the $gear gives", ({ expected, gear }) => {
    expect(newRun(data, 3, { dogs: ["koda"], gear })).toMatchObject(expected);
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
