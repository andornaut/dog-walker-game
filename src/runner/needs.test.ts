import { describe, expect, it } from "vitest";

import { DEBUFFS } from "../data/debuffs";
import { DOGS } from "../data/dogs";
import { ENCOUNTERS } from "../data/encounters";
import { FORCED_STOPS } from "../data/forcedStops";
import { NEED_CARDS, NEED_SPOTS, NEEDS } from "../data/needs";
import { SHOP_GEAR } from "../data/shop";
import { UPGRADES } from "../data/upgrades";
import type { RunState } from "../state/runState";
import { heartsByDog, testState } from "../testing/runState";
import { TEST_TUNING } from "../testing/tuning";
import { TEST_WORLD } from "../testing/world";
import { isNeedUrgent, meetNeedAt, nextNeedMoment, stepNeeds } from "./needs";

// Urgent after 100s for a calm dog, 70s steady and 45s hyper; wrong 20s after that.
const data = {
  debuffs: DEBUFFS,
  dogs: DOGS,
  encounters: ENCOUNTERS,
  forcedStops: FORCED_STOPS,
  needCards: NEED_CARDS,
  needSpots: NEED_SPOTS,
  needs: NEEDS,
  shopGear: SHOP_GEAR,
  tuning: {
    ...TEST_TUNING,
    probability: { ...TEST_TUNING.probability, needPayoffCard: 0.25 },
    seconds: {
      ...TEST_TUNING.seconds,
      needGoneWrong: 20,
      needUrgentByEnergy: { calm: 100, hyper: 45, steady: 70 },
    },
  },
  upgrades: UPGRADES,
  world: TEST_WORLD,
};
// A draw above the payoff chance meets the need plainly; one below opens its card.
const plain = () => 0.9;
const payoff = () => 0.1;

describe("urgency", () => {
  it("fills while the walk moves, faster for higher energy, and turns urgent", () => {
    // Biscuit is hyper and Koda steady.
    let run: RunState = testState({ biscuit: 5, koda: 5 });
    const urgent: string[] = [];
    for (let second = 0; second < 60; second++) {
      const step = stepNeeds(data, plain, 1, true, [], run);
      urgent.push(...step.urgent);
      run = step.run;
    }
    expect(urgent).toEqual(["biscuit"]);
    expect(isNeedUrgent(data, run, "biscuit")).toBe(true);
    expect(isNeedUrgent(data, run, "koda")).toBe(false);
    expect(nextNeedMoment(data, run)).toBe(5);
  });

  it("stands still while the walk does not move", () => {
    const run = testState({ biscuit: 5 }, { needSeconds: { biscuit: 10 } });
    expect(stepNeeds(data, plain, 5, false, [], run).run).toBe(run);
  });

  it("costs the owner a heart when a need goes wrong, and starts it again", () => {
    // Koda is Nosy; his laid-back owner loses 1.
    const run = testState({ koda: 5 }, { needSeconds: { koda: 89.5 } });
    const step = stepNeeds(data, plain, 1, true, [], run);
    expect(step.moments).toMatchObject([{ dog: "koda", kind: "goneWrong", need: "nosy" }]);
    expect(heartsByDog(step.run)).toEqual({ koda: 4 });
    expect(step.run.needSeconds).toEqual({ koda: 0 });
    expect(step.cards).toEqual([]);
  });

  it("opens the accident card when a Regular dog's need goes wrong", () => {
    const run = testState({ biscuit: 5 }, { needSeconds: { biscuit: 64.5 } });
    const step = stepNeeds(data, plain, 1, true, [], run);
    expect(step.cards).toEqual([{ affected: ["biscuit"], card: "accident", kind: "need" }]);
    expect(heartsByDog(step.run)).toEqual({ biscuit: 5 });
    expect(step.run.needSeconds).toEqual({ biscuit: 0 });
  });
});

describe("meetNeedAt", () => {
  it("meets the need of every dog that has it: a heart each, and starts it again", () => {
    // Duchess and Snowball are Friendly, and both urgent; Snowball's dramatic owner
    // doubles the heart.
    const run = testState(
      { duchess: 3, koda: 3, snowball: 3 },
      { needSeconds: { duchess: 100, koda: 50, snowball: 100 } },
    );
    const met = meetNeedAt(data, plain, "stranger", run);
    expect(met.card).toBeNull();
    expect(heartsByDog(met.run)).toEqual({ duchess: 4, koda: 3, snowball: 5 });
    expect(met.run.needSeconds).toEqual({ duchess: 0, koda: 50, snowball: 0 });
    expect(met.moment).toMatchObject({
      dogs: ["duchess", "snowball"],
      kind: "met",
      need: "friendly",
    });
  });

  it("opens the need's payoff card instead, at the payoff chance", () => {
    const run = testState({ biscuit: 3 }, { needSeconds: { biscuit: 45 } });
    const met = meetNeedAt(data, payoff, "tree", run);
    expect(met.card).toEqual({ affected: ["biscuit"], card: "goodSpot", kind: "need" });
    expect(heartsByDog(met.run)).toEqual({ biscuit: 3 });
    expect(met.run.needSeconds).toEqual({ biscuit: 0 });
  });

  it("starts a need that is not urgent again, with no heart and no draw", () => {
    // Duchess is urgent at 100s, Snowball at 45s: only Snowball's owner gains.
    const never = () => {
      throw new Error("drew");
    };
    const calm = testState({ duchess: 3 }, { needSeconds: { duchess: 50 } });
    expect(meetNeedAt(data, never, "stranger", calm)).toEqual({
      card: null,
      moment: null,
      run: { ...calm, needSeconds: { duchess: 0 } },
    });
    const mixed = testState(
      { duchess: 3, snowball: 3 },
      { needSeconds: { duchess: 50, snowball: 45 } },
    );
    const met = meetNeedAt(data, plain, "stranger", mixed);
    expect(heartsByDog(met.run)).toEqual({ duchess: 3, snowball: 5 });
    expect(met.run.needSeconds).toEqual({ duchess: 0, snowball: 0 });
    expect(met.moment).toMatchObject({ dogs: ["snowball"], kind: "met" });
  });

  it("does nothing, and draws nothing, at a spot no dog needs", () => {
    const run = testState({ biscuit: 3 });
    const never = () => {
      throw new Error("drew");
    };
    expect(meetNeedAt(data, never, "waterBowl", run)).toEqual({ card: null, moment: null, run });
  });
});
