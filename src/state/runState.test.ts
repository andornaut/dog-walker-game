import { describe, expect, it } from "vitest";

import { DOGS } from "../data/dogs";
import { SHOP_GEAR } from "../data/shop";
import { heartsByDog } from "../testing/runState";
import { TEST_TUNING } from "../testing/tuning";
import { newRun } from "./runState";

const data = { dogs: DOGS, shopGear: SHOP_GEAR, tuning: TEST_TUNING };

describe("newRun", () => {
  it("starts each owner at their temperament's hearts, walking, with no money", () => {
    const state = newRun(data, { dogs: ["duchess", "nugget", "pierre"], gear: null });
    expect(heartsByDog(state)).toEqual({ duchess: 6, nugget: 5, pierre: 4 });
    expect(state.money).toBe(0);
    expect(state.phase).toEqual({ kind: "walking" });
    expect(state.zoneIndex).toBe(0);
  });

  it("starts with the fanny pack's money", () => {
    expect(newRun(data, { dogs: ["koda"], gear: "fannyPack" }).money).toBe(1500);
  });

  it("makes the pack immune to thieves with the whistle, and gives poop bags' skips", () => {
    expect(newRun(data, { dogs: ["koda"], gear: "whistle" }).immunities).toEqual(["thief"]);
    expect(newRun(data, { dogs: ["koda"], gear: "poopBags" }).skipsLeft).toBe(
      TEST_TUNING.counts.poopBagsSkipsPerRun,
    );
  });

  it("rejects a dog listed twice", () => {
    expect(() => newRun(data, { dogs: ["koda", "koda"], gear: null })).toThrow("only once");
  });

  it("survives a round trip through JSON unchanged", () => {
    const state = newRun(data, { dogs: ["duchess", "koda"], gear: "luckyCollar" });
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });
});
