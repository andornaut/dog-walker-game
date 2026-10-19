import { describe, expect, it } from "vitest";

import { DEBUFFS } from "../data/debuffs";
import { DOGS } from "../data/dogs";
import { ENCOUNTERS } from "../data/encounters";
import type { DogId, Effect } from "../data/types";
import type { ActiveModifier, EffectSource, RunState } from "../state/runState";
import { activeModifier, heartsByDog, testState } from "../testing/runState";
import { TEST_TUNING } from "../testing/tuning";
import { applyEffects, type EffectContext, moneyCost, resolveEffects, targetDogs } from "./effects";
import { cents } from "./units";

const data = { debuffs: DEBUFFS, dogs: DOGS, encounters: ENCOUNTERS, tuning: TEST_TUNING };
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
  const puddle: Effect = {
    amount: -1,
    kind: "hearts",
    target: { kind: "affected" },
    traitAmounts: { fancy: -2 },
  };
  const luckyCollar = activeModifier(
    { gear: "luckyCollar", kind: "gear" },
    { by: "luckyCollarMax", operation: "add", stat: "maxHearts" },
  );
  type Slots = Parameters<typeof testState>[0];

  it.each<[string, DogId[], Effect, Slots, Slots, ActiveModifier[]?]>([
    ["never below 0", ["duchess"], loseTwo, { duchess: 1 }, { duchess: 0 }],
    [
      "never above the dog's max, which depends on its size",
      [],
      gainOne,
      { duchess: 6, koda: 9, pierre: 8 },
      { duchess: 6, koda: 10, pierre: 8 },
    ],
    ["a dramatic owner's loss doubled", ["nugget"], loseTwo, { nugget: 5 }, { nugget: 1 }],
    ["a dramatic owner's loss held at 0", ["nugget"], loseTwo, { nugget: 3 }, { nugget: 0 }],
    ["a dramatic owner's gain doubled", [], gainOne, { nugget: 3 }, { nugget: 5 }],
    ["a dramatic owner's gain held at the max", [], gainOne, { nugget: 5 }, { nugget: 6 }],
    [
      "a trait's own amount",
      ["duchess", "koda"],
      puddle,
      { duchess: 5, koda: 5 },
      { duchess: 3, koda: 4 },
    ],
    [
      "the max raised by a maxHearts modifier",
      [],
      gainOne,
      { duchess: 6 },
      { duchess: 7 },
      [luckyCollar],
    ],
  ])("applies %s", (_, affected, effect, slots, expected, modifiers = []) => {
    const state = testState(slots, { modifiers });
    expect(heartsByDog(applyEffects(data, context(affected), [effect], state))).toEqual(expected);
  });

  it("uses a quirk's own amount for dogs with that quirk, over their trait's", () => {
    // Duchess, Fancy, made nervous here.
    const nervous = {
      ...data,
      dogs: { ...DOGS, duchess: { ...DOGS.duchess, quirk: "nervous" } },
    } as const;
    const sniff: Effect = {
      amount: 1,
      kind: "hearts",
      quirkAmounts: { nervous: -1 },
      target: { kind: "affected" },
      traitAmounts: { fancy: 2 },
    };
    const state = testState({ duchess: 5, koda: 5 });
    expect(
      heartsByDog(applyEffects(nervous, context(["duchess", "koda"]), [sniff], state)),
    ).toEqual({ duchess: 4, koda: 6 });
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
  const lowestLast = testState({ duchess: 4, koda: 5, nugget: 2 });
  const tied = testState({ duchess: 5, koda: 2, nugget: 2 });
  const unhappiest = { kind: "unhappiest" } as const;
  const randomOne = { kind: "randomOne" } as const;
  type Options = { affected?: DogId[]; random?: number; state?: RunState };

  it.each<[string, Parameters<typeof targetDogs>[3], DogId[], Options?]>([
    ["all, leaving out a fired owner's dog", { kind: "all" }, ["duchess", "nugget"]],
    [
      "affected, leaving out a fired owner's dog",
      { kind: "affected" },
      [],
      { affected: ["pierre"] },
    ],
    ["by trait", { kind: "trait", trait: "fancy" }, ["duchess"]],
    ["by owner temperament", { kind: "temperament", temperament: "dramatic" }, ["nugget"]],
    ["one random dog, low draw", randomOne, ["duchess"]],
    ["one random dog, high draw", randomOne, ["nugget"], { random: 0.99 }],
    ["the unhappiest owner", unhappiest, ["nugget"], { state: lowestLast }],
    ["the unhappiest owner, first in pack order on a tie", unhappiest, ["koda"], { state: tied }],
    [
      "no unhappiest owner when all are fired",
      unhappiest,
      [],
      { state: testState({ koda: "fired" }) },
    ],
  ])("picks %s", (_, target, expected, { affected = [], random = 0, state = pack } = {}) => {
    const picked = targetDogs(
      data,
      context(affected, () => random),
      state,
      target,
    );
    expect(picked).toEqual(expected);
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
  const gain: Effect = {
    amount: "missedTips",
    change: "gain",
    kind: "money",
    perDog: { kind: "all" },
  };

  const talked = (slots: Parameters<typeof testState>[0], times = 1) =>
    testState(slots, { modifiers: Array.from({ length: times }, () => sweetTalker) });
  const both: DogId[] = ["duchess", "koda"];

  it.each<[string, DogId[], Effect, RunState, number]>([
    [
      "a per-dog cost once per affected dog",
      both,
      towel,
      testState({ duchess: 5, koda: 5, nugget: 5 }),
      1000,
    ],
    ["a flat cost once, whatever the pack", both, chase, testState({ duchess: 5, koda: 5 }), 1000],
    [
      "a per-dog cost less a costPerDog modifier",
      both,
      towel,
      talked({ duchess: 5, koda: 5 }),
      600,
    ],
    ["a per-dog cost never below $0 a dog", ["duchess"], towel, talked({ duchess: 5 }, 3), 0],
    [
      "a flat cost unchanged by a costPerDog modifier",
      ["duchess"],
      chase,
      talked({ duchess: 5 }),
      1000,
    ],
    ["nothing for a gain", [], gain, testState({ duchess: 5, koda: 5 }), 0],
  ])("charges %s", (_, affected, effect, state, cost) => {
    expect(moneyCost(data, context(affected), state, [effect])).toBe(cost);
  });

  it("adds gains and subtracts costs, never going below $0", () => {
    const start = testState({ duchess: 5, koda: 5 }, { money: cents(700) });
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
