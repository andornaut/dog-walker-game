import { describe, expect, it } from "vitest";

import { DEBUFFS } from "../data/debuffs";
import { DOGS } from "../data/dogs";
import { ENCOUNTERS } from "../data/encounters";
import { TUNING } from "../data/tuning";
import type { DogId, Effect } from "../data/types";
import type { ActiveModifier, EffectSource, RunState } from "../state/runState";
import { LONE } from "../testing/packPlaces";
import { activeModifier, heartsByDog, testState } from "../testing/runState";
import { TEST_TUNING } from "../testing/tuning";
import { maxHearts } from "./dogs";
import { applyEffects, type EffectContext, moneyCost, resolveEffects, targetDogs } from "./effects";
import { cents, read } from "./units";

const data = { debuffs: DEBUFFS, dogs: DOGS, encounters: ENCOUNTERS, tuning: TEST_TUNING };
const SKUNK_IGNORE: EffectSource = { encounter: "skunk", kind: "encounter", option: 2 };
const context = (affected: readonly DogId[], random = () => 0): EffectContext => ({
  affected,
  random,
  source: SKUNK_IGNORE,
});
const sweetTalker = activeModifier(
  { kind: "upgrade", upgrade: "sweetTalker" },
  { by: "sweetTalkerFreeCards", operation: "add", stat: "freeCards" },
);

describe("applyEffects: hearts", () => {
  const loseTwo: Effect = { amount: -2, kind: "hearts", target: { kind: "affected" } };
  const gainOne: Effect = { amount: 1, kind: "hearts", target: { kind: "all" } };
  const luckyCollar = activeModifier(
    { gear: "luckyCollar", kind: "gear" },
    { by: "luckyCollarMax", operation: "add", stat: "maxHearts" },
  );
  type Slots = Parameters<typeof testState>[0];

  it("applies hearts within 0 and the max, the same to every owner", () => {
    for (const [, affected, effect, slots, expected, modifiers = []] of [
      ["never below 0", ["duchess"], loseTwo, { duchess: 1 }, { duchess: 0 }],
      [
        "never above the dog's max, which depends on its size",
        [],
        gainOne,
        { duchess: 6, koda: 9, pierre: 8 },
        { duchess: 6, koda: 10, pierre: 8 },
      ],
      [
        "the same amount to every owner",
        ["koda", "nugget"],
        loseTwo,
        { koda: 5, nugget: 5 },
        { koda: 3, nugget: 3 },
      ],
      [
        "the max raised by a maxHearts modifier",
        [],
        gainOne,
        { duchess: 6 },
        { duchess: 7 },
        [luckyCollar],
      ],
    ] satisfies readonly [string, DogId[], Effect, Slots, Slots, ActiveModifier[]?][]) {
      const state = testState(slots, { modifiers });
      expect(heartsByDog(applyEffects(data, context(affected), [effect], state))).toEqual(expected);
    }
  });
});

describe("resolveEffects: changes and their causes", () => {
  it("reports the base and the cap, summing to the change", () => {
    const gainTwo: Effect = { amount: 2, kind: "hearts", target: { kind: "all" } };
    const max = maxHearts(TEST_TUNING, [], LONE, DOGS.nugget);
    const { changes } = resolveEffects(
      data,
      context([]),
      [gainTwo],
      testState({ nugget: max - 1 }),
    );
    expect(changes).toEqual([
      {
        after: max,
        before: max - 1,
        causes: [
          { amount: 2, kind: "effect", source: SKUNK_IGNORE },
          { amount: -1, bound: "max", kind: "limit" },
        ],
        dog: "nugget",
        kind: "hearts",
      },
    ]);
  });

  it("reports no change for an owner whose meter does not move", () => {
    const gainOne: Effect = { amount: 1, kind: "hearts", target: { kind: "all" } };
    const full = testState({ duchess: maxHearts(TEST_TUNING, [], LONE, DOGS.duchess) });
    const { changes } = resolveEffects(data, context([]), [gainOne], full);
    expect(changes).toEqual([]);
  });

  describe("Second chance", () => {
    const tuning = TUNING;
    const allowance = read(tuning, "hearts", "kindWordsForgiven");
    const source = { kind: "walker", walker: "casey" } as const;
    const kindWords = activeModifier(source, {
      by: "kindWordsForgiven",
      operation: "add",
      stat: "forgivenHearts",
    });
    // Koda's owner walking Koda alone, at full hearts.
    const full = maxHearts(tuning, [], LONE, DOGS.koda);
    const lose = (amount: 1 | 2): Effect => ({
      amount: amount === 1 ? -1 : -2,
      kind: "hearts",
      target: { kind: "all" },
    });

    it("forgives up to its allowance of a loss, reporting it when nothing is lost", () => {
      for (const loss of [1, 2] as const) {
        const forgiven = Math.min(loss, allowance);
        const state = testState({ koda: full }, { modifiers: [kindWords] });
        const applied = resolveEffects({ ...data, tuning }, context([]), [lose(loss)], state);
        expect(applied.changes).toEqual([
          {
            after: full - loss + forgiven,
            before: full,
            causes: [
              { amount: -loss, kind: "effect", source: SKUNK_IGNORE },
              { amount: forgiven, kind: "modifier", source },
            ],
            dog: "koda",
            kind: "hearts",
          },
        ]);
        expect(applied.state.heartsForgiven).toBe(forgiven);
      }
    });

    it("forgives no more once its allowance is used this zone", () => {
      const used = testState({ koda: full }, { heartsForgiven: allowance, modifiers: [kindWords] });
      const { changes } = resolveEffects({ ...data, tuning }, context([]), [lose(1)], used);
      expect(changes.map((change) => change.causes.length)).toEqual([1]);
    });
  });

  it("waives a free card's cost, naming Sweet talker, and makes no money change", () => {
    const towel: Effect = {
      amount: "encounterLow",
      change: "lose",
      kind: "money",
    };
    const state = testState({ duchess: 5, koda: 5 }, { modifiers: [sweetTalker] });
    const { changes } = resolveEffects(data, context(["duchess", "koda"]), [towel], state);
    expect(changes).toEqual([]);
    expect(moneyCost(data, state, [towel])).toBe(0);
  });
});

describe("targetDogs", () => {
  const pack = testState({ duchess: 3, nugget: 3, pierre: "fired" });
  const randomOne = { kind: "randomOne" } as const;
  type Options = { affected?: DogId[]; random?: number; state?: RunState };

  it("picks the targeted dogs, leaving out fired owners", () => {
    const cases: [string, Parameters<typeof targetDogs>[3], DogId[], Options?][] = [
      ["all, leaving out a fired owner's dog", { kind: "all" }, ["duchess", "nugget"]],
      [
        "affected, leaving out a fired owner's dog",
        { kind: "affected" },
        [],
        { affected: ["pierre"] },
      ],
      ["one random dog, low draw", randomOne, ["duchess"]],
      ["one random dog, high draw", randomOne, ["nugget"], { random: 0.99 }],
      ["no random dog when all are fired", randomOne, [], { state: testState({ koda: "fired" }) }],
    ];
    for (const [name, target, expected, options] of cases) {
      const { affected = [], random = 0, state = pack } = options ?? {};
      const picked = targetDogs(
        data,
        context(affected, () => random),
        state,
        target,
      );
      expect(picked, name).toEqual(expected);
    }
  });
});

describe("moneyCost and applyEffects: money", () => {
  const towel: Effect = {
    amount: "encounterLow",
    change: "lose",
    kind: "money",
  };
  const letGo: Effect = { amount: "thiefLetGo", change: "lose", kind: "money" };
  const gain: Effect = {
    amount: "missedTips",
    change: "gain",
    kind: "money",
  };

  // Sweet talker, with cardsThisZone cards resolved this zone.
  const talked = (slots: Parameters<typeof testState>[0], cardsThisZone = 0) =>
    testState(slots, { cardsThisZone, modifiers: [sweetTalker] });
  const low = read(TEST_TUNING, "money", "encounterLow");
  const letGoCost = read(TEST_TUNING, "money", "thiefLetGo");

  it("charges a cost once, nothing on the zone's first card with Sweet talker", () => {
    for (const [, effect, state, cost] of [
      ["a cost once, whatever the pack", towel, testState({ duchess: 5, koda: 5, nugget: 5 }), low],
      ["another cost once too", letGo, testState({ duchess: 5, koda: 5 }), letGoCost],
      [
        "nothing on the zone's first card with Sweet talker",
        towel,
        talked({ duchess: 5, koda: 5 }),
        0,
      ],
      ["a flat cost free too on that card", letGo, talked({ duchess: 5 }), 0],
      ["in full on the zone's next card", towel, talked({ duchess: 5, koda: 5 }, 1), low],
      ["nothing for a gain", gain, testState({ duchess: 5, koda: 5 }), 0],
    ] satisfies readonly [string, Effect, RunState, number][]) {
      expect(moneyCost(data, state, [effect])).toBe(cost);
    }
  });

  it("adds gains and subtracts costs", () => {
    const start = testState({ duchess: 5, koda: 5 }, { money: cents(5000) });
    const gained = read(TEST_TUNING, "money", "missedTips");
    expect(applyEffects(data, context([]), [gain], start).money).toBe(5000 + gained);
    expect(applyEffects(data, context([]), [letGo], start).money).toBe(5000 - letGoCost);
  });
});

describe("applyEffects: other kinds", () => {
  it("refreshes a debuff the pack already has instead of stacking it", () => {
    const stinky: Effect = { debuff: "stinky", kind: "debuff" };
    const state = applyEffects(data, context([]), [stinky, stinky], testState({ koda: 5 }));
    expect(state.debuffs).toEqual([
      {
        debuff: "stinky",
        secondsLeft: read(TEST_TUNING, "seconds", "stinkySeconds"),
        untilZone: 0,
      },
    ]);
    expect(state.debuffsGot).toEqual({ stinky: 2 });
  });

  it("halves a debuff's time with Calm voice", () => {
    const calmVoice = activeModifier(
      { kind: "walker", walker: "ada" },
      { by: "calmVoiceDebuffFactor", operation: "multiply", stat: "debuffSeconds" },
    );
    const stinky: Effect = { debuff: "stinky", kind: "debuff" };
    // The test tuning makes every walker's perk neutral, so this one is put back at a half.
    const { multipliers } = TEST_TUNING;
    const tuning = { ...TEST_TUNING, multipliers: { ...multipliers, calmVoiceDebuffFactor: 0.5 } };
    const state = applyEffects(
      { ...data, tuning },
      context([]),
      [stinky],
      testState({ koda: 5 }, { modifiers: [calmVoice] }),
    );
    expect(state.debuffs[0]?.secondsLeft).toBe(read(TEST_TUNING, "seconds", "stinkySeconds") / 2);
  });

  it("records an immunity once", () => {
    const raincoats: Effect = { duration: "run", encounter: "puddle", kind: "immune" };
    const state = applyEffects(data, context([]), [raincoats, raincoats], testState({ koda: 5 }));
    expect(state.immunities).toEqual([{ encounter: "puddle" }]);
  });

  it("keeps a modifier, with its source, for the rules that read its stat", () => {
    const bigTipper: Effect = {
      by: "bigTipperTipBonus",
      duration: "run",
      kind: "modifier",
      operation: "add",
      stat: "tipValue",
    };
    const state = applyEffects(data, context([]), [bigTipper], testState({ koda: 5 }));
    expect(state.modifiers).toEqual([{ ...bigTipper, source: SKUNK_IGNORE }]);
  });

  it("offers a free Skip", () => {
    const skip: Effect = { kind: "skipOption" };
    const state = applyEffects(data, context([]), [skip], testState({ duchess: 5, koda: 5 }));
    expect(state.skipPass).toBe(true);
  });
});
