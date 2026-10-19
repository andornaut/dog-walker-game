import { describe, expect, it } from "vitest";

import { DEBUFFS } from "../data/debuffs";
import { DOGS } from "../data/dogs";
import type { DogId, Effect } from "../data/types";
import type { EffectSource } from "../state/runState";
import { activeModifier, heartsByDog, testState } from "../testing/runState";
import { TEST_TUNING } from "../testing/tuning";
import {
  applyEffects,
  canAfford,
  type EffectContext,
  moneyCost,
  resolveEffects,
  targetDogs,
} from "./effects";
import { cents } from "./units";

const data = { debuffs: DEBUFFS, dogs: DOGS, tuning: TEST_TUNING };
const SKUNK_IGNORE: EffectSource = { encounter: "skunk", kind: "encounter", option: 2 };
const context = (affected: readonly DogId[], random = () => 0): EffectContext => ({
  affected,
  random,
  source: SKUNK_IGNORE,
});
const sweetTalker = activeModifier(
  { kind: "upgrade", upgrade: "sweetTalker" },
  { by: "sweetTalkerCostPerDog", operation: "add", stat: "costPerDog" },
);

describe("applyEffects: hearts", () => {
  const loseTwo: Effect = { amount: -2, kind: "hearts", target: { kind: "affected" } };
  const gainOne: Effect = { amount: 1, kind: "hearts", target: { kind: "all" } };
  const apply = (
    affected: readonly DogId[],
    effect: Effect,
    slots: Parameters<typeof testState>[0],
  ) => heartsByDog(applyEffects(data, context(affected), [effect], testState(slots)));

  it("never takes an owner below 0", () => {
    expect(apply(["duchess"], loseTwo, { duchess: 1 })).toEqual({ duchess: 0 });
  });

  it("never takes an owner above their dog's max, which depends on its size", () => {
    expect(apply([], gainOne, { duchess: 6, koda: 9, pierre: 8 })).toEqual({
      duchess: 6,
      koda: 10,
      pierre: 8,
    });
  });

  it("counts every gain and loss double for a dramatic owner, still within 0 and the max", () => {
    expect(apply(["nugget"], loseTwo, { nugget: 5 })).toEqual({ nugget: 1 });
    expect(apply(["nugget"], loseTwo, { nugget: 3 })).toEqual({ nugget: 0 });
    expect(apply([], gainOne, { nugget: 3 })).toEqual({ nugget: 5 });
    expect(apply([], gainOne, { nugget: 5 })).toEqual({ nugget: 6 });
  });

  it("uses a trait's own amount for dogs with that trait", () => {
    const puddle: Effect = {
      amount: -1,
      kind: "hearts",
      target: { kind: "affected" },
      traitAmounts: { fancy: -2 },
    };
    expect(apply(["duchess", "koda"], puddle, { duchess: 5, koda: 5 })).toEqual({
      duchess: 3,
      koda: 4,
    });
  });

  it("caps hearts at the max raised by a maxHearts modifier", () => {
    const luckyCollar = activeModifier(
      { gear: "luckyCollar", kind: "gear" },
      { by: "luckyCollarMax", operation: "add", stat: "maxHearts" },
    );
    const start = testState({ duchess: 6 }, { modifiers: [luckyCollar] });
    expect(heartsByDog(applyEffects(data, context([]), [gainOne], start))).toEqual({ duchess: 7 });
  });
});

describe("resolveEffects: changes and their causes", () => {
  it("reports the base, the dramatic doubling and the cap, summing to the change", () => {
    const gainTwo: Effect = { amount: 2, kind: "hearts", target: { kind: "all" } };
    const { changes } = resolveEffects(data, context([]), [gainTwo], testState({ nugget: 4 }));
    expect(changes).toEqual([
      {
        after: 6,
        before: 4,
        causes: [
          { amount: 2, kind: "effect", source: SKUNK_IGNORE },
          { amount: 2, kind: "temperament", temperament: "dramatic" },
          { amount: -2, bound: "max", kind: "limit" },
        ],
        dog: "nugget",
        kind: "hearts",
      },
    ]);
  });

  it("reports no change for an owner whose meter does not move", () => {
    const gainOne: Effect = { amount: 1, kind: "hearts", target: { kind: "all" } };
    const { changes } = resolveEffects(data, context([]), [gainOne], testState({ duchess: 6 }));
    expect(changes).toEqual([]);
  });

  it("reports a per-dog cost with Sweet talker's share and the $0 floor", () => {
    const towel: Effect = {
      amount: "encounterLow",
      change: "lose",
      kind: "money",
      perDog: { kind: "affected" },
    };
    const state = testState(
      { duchess: 5, koda: 5 },
      { modifiers: [sweetTalker], money: cents(400) },
    );
    const { changes } = resolveEffects(data, context(["duchess", "koda"]), [towel], state);
    expect(changes).toEqual([
      {
        amount: -400,
        causes: [
          { amount: -1000, kind: "effect", source: SKUNK_IGNORE },
          { amount: 400, kind: "modifier", source: { kind: "upgrade", upgrade: "sweetTalker" } },
          { amount: 200, bound: "min", kind: "limit" },
        ],
        dog: null,
        kind: "money",
      },
    ]);
  });
});

describe("targetDogs", () => {
  const pack = testState({ duchess: 3, nugget: 3, pierre: "fired" });

  it("leaves out a dog whose owner has fired you", () => {
    expect(targetDogs(data, context([]), pack, { kind: "all" })).toEqual(["duchess", "nugget"]);
    expect(targetDogs(data, context(["pierre"]), pack, { kind: "affected" })).toEqual([]);
  });

  it("picks dogs by trait or by owner temperament", () => {
    expect(targetDogs(data, context([]), pack, { kind: "trait", trait: "fancy" })).toEqual([
      "duchess",
    ]);
    expect(
      targetDogs(data, context([]), pack, { kind: "temperament", temperament: "dramatic" }),
    ).toEqual(["nugget"]);
  });

  it("draws one random dog from the pack", () => {
    expect(
      targetDogs(
        data,
        context([], () => 0),
        pack,
        { kind: "randomOne" },
      ),
    ).toEqual(["duchess"]);
    expect(
      targetDogs(
        data,
        context([], () => 0.99),
        pack,
        { kind: "randomOne" },
      ),
    ).toEqual(["nugget"]);
  });

  it("picks the owner with the fewest hearts, the first in pack order on a tie", () => {
    const unhappiest = { kind: "unhappiest" } as const;
    const lowestLast = testState({ duchess: 4, koda: 5, nugget: 2 });
    expect(targetDogs(data, context([]), lowestLast, unhappiest)).toEqual(["nugget"]);
    const tied = testState({ duchess: 5, koda: 2, nugget: 2 });
    expect(targetDogs(data, context([]), tied, unhappiest)).toEqual(["koda"]);
    expect(targetDogs(data, context([]), testState({ koda: "fired" }), unhappiest)).toEqual([]);
  });
});

describe("moneyCost and applyEffects: money", () => {
  const towel: Effect = {
    amount: "encounterLow",
    change: "lose",
    kind: "money",
    perDog: { kind: "affected" },
  };
  const chase: Effect = { amount: "squirrelChase", change: "lose", kind: "money" };

  it("charges a per-dog cost once per affected dog", () => {
    const state = testState({ duchess: 5, koda: 5, nugget: 5 });
    expect(moneyCost(data, context(["duchess", "koda"]), state, [towel])).toBe(1000);
  });

  it("charges a flat cost once, whatever the pack", () => {
    const state = testState({ duchess: 5, koda: 5 });
    expect(moneyCost(data, context(["duchess", "koda"]), state, [chase])).toBe(1000);
  });

  it("takes a costPerDog modifier off each dog's share, never below $0 a dog", () => {
    const once = testState({ duchess: 5, koda: 5 }, { modifiers: [sweetTalker] });
    expect(moneyCost(data, context(["duchess", "koda"]), once, [towel])).toBe(600);
    const thrice = testState(
      { duchess: 5 },
      { modifiers: [sweetTalker, sweetTalker, sweetTalker] },
    );
    expect(moneyCost(data, context(["duchess"]), thrice, [towel])).toBe(0);
  });

  it("leaves a flat cost unchanged by a costPerDog modifier", () => {
    const state = testState({ duchess: 5 }, { modifiers: [sweetTalker] });
    expect(moneyCost(data, context(["duchess"]), state, [chase])).toBe(1000);
  });

  it("allows an option only when the player has its cost", () => {
    const state = testState({ duchess: 5, koda: 5 }, { money: cents(999) });
    expect(canAfford(data, context(["duchess", "koda"]), state, [towel])).toBe(false);
    expect(
      canAfford(data, context(["duchess", "koda"]), { ...state, money: cents(1000) }, [towel]),
    ).toBe(true);
  });

  it("adds gains and subtracts costs, never going below $0", () => {
    const gain: Effect = {
      amount: "missedTips",
      change: "gain",
      kind: "money",
      perDog: { kind: "all" },
    };
    const start = testState({ duchess: 5, koda: 5 }, { money: cents(700) });
    expect(moneyCost(data, context([]), start, [gain])).toBe(0);
    expect(applyEffects(data, context([]), [gain], start).money).toBe(1700);
    expect(applyEffects(data, context([]), [chase], start).money).toBe(0);
  });
});

describe("applyEffects: other kinds", () => {
  it("refreshes a debuff the pack already has instead of stacking it", () => {
    const stinky: Effect = { debuff: "stinky", kind: "debuff" };
    const state = applyEffects(data, context([]), [stinky, stinky], testState({ koda: 5 }));
    expect(state.debuffs).toEqual([{ debuff: "stinky", untilZone: 0 }]);
  });

  it("records an immunity once", () => {
    const raincoats: Effect = { duration: "run", encounter: "puddle", kind: "immune" };
    const state = applyEffects(data, context([]), [raincoats, raincoats], testState({ koda: 5 }));
    expect(state.immunities).toEqual([{ encounter: "puddle" }]);
  });

  it("keeps a modifier, with its source, for the rules that read its stat", () => {
    const bigTipper: Effect = {
      by: "bigTipperTip",
      duration: "run",
      kind: "modifier",
      operation: "multiply",
      stat: "tipValue",
    };
    const state = applyEffects(data, context([]), [bigTipper], testState({ koda: 5 }));
    expect(state.modifiers).toEqual([{ ...bigTipper, source: SKUNK_IGNORE }]);
  });

  it("adds skips, and treats per dog up to the carry limit", () => {
    const skip: Effect = { kind: "skipOption", usesPerRun: "poopBagsSkipsPerRun" };
    const biscuits: Effect = {
      amount: "biscuitNeighbourTreatsPerDog",
      kind: "treats",
      perDog: { kind: "all" },
    };
    const start = testState({ duchess: 5, koda: 5 });
    const once = applyEffects(data, context([]), [skip, biscuits], start);
    expect(once.skipsLeft).toBe(TEST_TUNING.counts.poopBagsSkipsPerRun);
    expect(once.treats).toBe(2);
    expect(applyEffects(data, context([]), [biscuits], once).treats).toBe(3);
  });

  it("adds treats once, whatever the pack, when they are not per dog", () => {
    const treat: Effect = { amount: "biscuitNeighbourTreatsPerDog", kind: "treats" };
    const state = applyEffects(data, context([]), [treat], testState({ duchess: 5, koda: 5 }));
    expect(state.treats).toBe(1);
  });
});
