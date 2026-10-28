import { describe, expect, it } from "vitest";

import { DEBUFFS } from "../data/debuffs";
import { DOGS } from "../data/dogs";
import { ENCOUNTERS } from "../data/encounters";
import { TUNING } from "../data/tuning";
import type { DogId, Effect } from "../data/types";
import { cents } from "../lib/units";
import type { ActiveModifier, EffectSource, RunState } from "../state/runState";
import { LONE } from "../testing/packPlaces";
import { activeModifier, heartsByDog, testState } from "../testing/runState";
import { TEST_TUNING } from "../testing/tuning";
import { maxHearts, ownerMaxHearts } from "./dogs";
import {
  applyEffects,
  type EffectContext,
  moneyCost,
  resolveEffects,
  shareHearts,
  targetDogs,
} from "./effects";
import { read } from "./units";

const data = { debuffs: DEBUFFS, dogs: DOGS, encounters: ENCOUNTERS, tuning: TEST_TUNING };
const SKUNK_IGNORE: EffectSource = { encounter: "skunk", kind: "encounter", option: 2 };
const context = (affected: readonly DogId[]): EffectContext => ({
  affected,
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
        { duchess: 6, kilo: 9, pierre: 8 },
        { duchess: 6, kilo: 10, pierre: 8 },
      ],
      [
        "the same amount to every owner",
        ["kilo", "reggie"],
        loseTwo,
        { kilo: 5, reggie: 5 },
        { kilo: 3, reggie: 3 },
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

describe("shareHearts", () => {
  it.each<[string, DogId[], number, [DogId, number][]]>([
    ["a lone dog gets the whole total", ["reggie"], 3, [["reggie", 3]]],
    [
      "a pair's front dog gets the one left over",
      ["reggie", "kilo"],
      3,
      [
        ["kilo", 2],
        ["reggie", 1],
      ],
    ],
    [
      "a trio gets one each",
      ["reggie", "pierre", "kilo"],
      3,
      [
        ["kilo", 1],
        ["pierre", 1],
        ["reggie", 1],
      ],
    ],
    [
      "the front dogs first, when more are left over",
      ["reggie", "pierre", "kilo"],
      5,
      [
        ["kilo", 2],
        ["pierre", 2],
        ["reggie", 1],
      ],
    ],
    [
      "nothing for a dog whose share is nothing",
      ["reggie", "pierre", "kilo"],
      2,
      [
        ["kilo", 1],
        ["pierre", 1],
      ],
    ],
    ["nothing among no dogs", [], 3, []],
  ])("shares %s", (_name, dogs, total, expected) => {
    expect(shareHearts(data, dogs, total)).toEqual(
      expected.map(([dog, hearts]) => ({ dog, hearts })),
    );
  });
});

describe("applyEffects: hearts shared by the pack", () => {
  const shared: Effect = { amount: "neighbourHearts", kind: "sharedHearts" };
  type Slots = Parameters<typeof testState>[0];
  const kiloPair = testState({ kilo: 1, reggie: 1 });
  const kiloMax = ownerMaxHearts(data, kiloPair, "kilo");

  // The pinned tuning shares 3 hearts. The shareHearts table covers each pack size's shares.
  it.each<[string, Slots, Slots]>([
    [
      "2 to the front dog's owner and 1 to the other",
      { kilo: 1, reggie: 1 },
      { kilo: 3, reggie: 2 },
    ],
    [
      "among the dogs still walking, leaving out a fired owner's",
      { duchess: 1, kilo: "fired", reggie: 1 },
      { duchess: 3, reggie: 2 },
    ],
    [
      "within each owner's max, losing the hearts past it",
      { kilo: kiloMax - 1, reggie: 1 },
      { kilo: kiloMax, reggie: 2 },
    ],
  ])("gives %s", (_name, slots, expected) => {
    expect(heartsByDog(applyEffects(data, context([]), [shared], testState(slots)))).toEqual(
      expected,
    );
  });

  it("reports each owner's share and the cap, summing to the change", () => {
    const { changes } = resolveEffects(
      data,
      context([]),
      [shared],
      testState({ kilo: kiloMax - 1, reggie: 1 }),
    );
    expect(changes).toEqual([
      {
        after: kiloMax,
        before: kiloMax - 1,
        causes: [
          { amount: 2, kind: "effect", source: SKUNK_IGNORE },
          { amount: -1, bound: "max", kind: "limit" },
        ],
        dog: "kilo",
        kind: "hearts",
      },
      {
        after: 2,
        before: 1,
        causes: [{ amount: 1, kind: "effect", source: SKUNK_IGNORE }],
        dog: "reggie",
        kind: "hearts",
      },
    ]);
  });
});

describe("resolveEffects: changes and their causes", () => {
  it("reports the base and the cap, summing to the change", () => {
    const gainTwo: Effect = { amount: 2, kind: "hearts", target: { kind: "all" } };
    const max = maxHearts(TEST_TUNING, [], LONE, DOGS.reggie);
    const { changes } = resolveEffects(
      data,
      context([]),
      [gainTwo],
      testState({ reggie: max - 1 }),
    );
    expect(changes).toEqual([
      {
        after: max,
        before: max - 1,
        causes: [
          { amount: 2, kind: "effect", source: SKUNK_IGNORE },
          { amount: -1, bound: "max", kind: "limit" },
        ],
        dog: "reggie",
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
    const allowance = read(tuning, "hearts", "secondChanceForgiven");
    const source = { kind: "walker", walker: "casey" } as const;
    const secondChance = activeModifier(source, {
      by: "secondChanceForgiven",
      operation: "add",
      stat: "forgivenHearts",
    });
    // Kilo's owner walking Kilo alone, at full hearts.
    const full = maxHearts(tuning, [], LONE, DOGS.kilo);
    const lose = (amount: 1 | 2): Effect => ({
      amount: amount === 1 ? -1 : -2,
      kind: "hearts",
      target: { kind: "all" },
    });

    it("forgives up to its allowance of a loss, reporting it when nothing is lost", () => {
      for (const loss of [1, 2] as const) {
        const forgiven = Math.min(loss, allowance);
        const state = testState({ kilo: full }, { modifiers: [secondChance] });
        const applied = resolveEffects({ ...data, tuning }, context([]), [lose(loss)], state);
        expect(applied.changes).toEqual([
          {
            after: full - loss + forgiven,
            before: full,
            causes: [
              { amount: -loss, kind: "effect", source: SKUNK_IGNORE },
              { amount: forgiven, forgives: true, kind: "modifier", source },
            ],
            dog: "kilo",
            kind: "hearts",
          },
        ]);
        expect(applied.state.heartsForgiven).toBe(forgiven);
      }
    });

    it("forgives no more once its allowance is used this zone", () => {
      const used = testState(
        { kilo: full },
        { heartsForgiven: allowance, modifiers: [secondChance] },
      );
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
    const state = testState({ duchess: 5, kilo: 5 }, { modifiers: [sweetTalker] });
    const { changes } = resolveEffects(data, context(["duchess", "kilo"]), [towel], state);
    expect(changes).toEqual([]);
    expect(moneyCost(data, state, [towel])).toBe(0);
  });
});

describe("targetDogs", () => {
  const pack = testState({ duchess: 3, pierre: "fired", reggie: 3 });

  it.each<[string, Parameters<typeof targetDogs>[3], DogId[], DogId[]]>([
    ["all, leaving out a fired owner's dog", { kind: "all" }, [], ["duchess", "reggie"]],
    ["affected, leaving out a fired owner's dog", { kind: "affected" }, ["pierre"], []],
  ])("picks %s", (_name, target, affected, expected) => {
    expect(targetDogs(data, { affected }, pack, target)).toEqual(expected);
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
      ["a cost once, whatever the pack", towel, testState({ duchess: 5, kilo: 5, reggie: 5 }), low],
      ["another cost once too", letGo, testState({ duchess: 5, kilo: 5 }), letGoCost],
      [
        "nothing on the zone's first card with Sweet talker",
        towel,
        talked({ duchess: 5, kilo: 5 }),
        0,
      ],
      ["a flat cost free too on that card", letGo, talked({ duchess: 5 }), 0],
      ["in full on the zone's next card", towel, talked({ duchess: 5, kilo: 5 }, 1), low],
      ["nothing for a gain", gain, testState({ duchess: 5, kilo: 5 }), 0],
    ] satisfies readonly [string, Effect, RunState, number][]) {
      expect(moneyCost(data, state, [effect])).toBe(cost);
    }
  });

  it("adds gains and subtracts costs", () => {
    const start = testState({ duchess: 5, kilo: 5 }, { money: cents(5000) });
    const gained = read(TEST_TUNING, "money", "missedTips");
    expect(applyEffects(data, context([]), [gain], start).money).toBe(5000 + gained);
    expect(applyEffects(data, context([]), [letGo], start).money).toBe(5000 - letGoCost);
  });
});

describe("applyEffects: other kinds", () => {
  it("refreshes a debuff the pack already has instead of stacking it", () => {
    const stinky: Effect = { debuff: "stinky", kind: "debuff" };
    const state = applyEffects(data, context([]), [stinky, stinky], testState({ kilo: 5 }));
    expect(state.debuffs).toEqual([
      {
        debuff: "stinky",
        secondsLeft: read(TEST_TUNING, "seconds", "stinkySeconds"),
        untilZone: 0,
      },
    ]);
    expect(state.debuffsGot).toEqual({ stinky: 2 });
  });

  it("halves a debuff's time with Quick recovery", () => {
    const quickRecovery = activeModifier(
      { kind: "walker", walker: "ada" },
      { by: "quickRecoveryDebuffFactor", operation: "multiply", stat: "debuffSeconds" },
    );
    const stinky: Effect = { debuff: "stinky", kind: "debuff" };
    // The test tuning makes every walker's perk neutral, so this one is put back at a half.
    const { multipliers } = TEST_TUNING;
    const tuning = {
      ...TEST_TUNING,
      multipliers: { ...multipliers, quickRecoveryDebuffFactor: 0.5 },
    };
    const state = applyEffects(
      { ...data, tuning },
      context([]),
      [stinky],
      testState({ kilo: 5 }, { modifiers: [quickRecovery] }),
    );
    expect(state.debuffs[0]?.secondsLeft).toBe(read(TEST_TUNING, "seconds", "stinkySeconds") / 2);
  });

  it("records an immunity once", () => {
    const raincoats: Effect = { duration: "run", encounter: "puddle", kind: "immune" };
    const state = applyEffects(data, context([]), [raincoats, raincoats], testState({ kilo: 5 }));
    expect(state.immunities).toEqual([{ encounter: "puddle", source: SKUNK_IGNORE }]);
  });

  it("keeps a modifier, with its source, for the rules that read its stat", () => {
    const bigTipper: Effect = {
      by: "bigTipperTipBonus",
      duration: "run",
      kind: "modifier",
      operation: "add",
      stat: "tipValue",
    };
    const state = applyEffects(data, context([]), [bigTipper], testState({ kilo: 5 }));
    expect(state.modifiers).toEqual([{ ...bigTipper, source: SKUNK_IGNORE }]);
  });

  it("offers a free Skip, naming what gave it", () => {
    const skip: Effect = { kind: "skipOption" };
    const state = applyEffects(data, context([]), [skip], testState({ duchess: 5, kilo: 5 }));
    expect(state.skipPass).toEqual(SKUNK_IGNORE);
  });
});
