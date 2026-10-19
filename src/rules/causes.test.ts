import { describe, expect, it } from "vitest";

import { DEBUFFS } from "../data/debuffs";
import { DOGS } from "../data/dogs";
import { ENCOUNTERS } from "../data/encounters";
import { FORCED_STOPS } from "../data/forcedStops";
import { NEED_CARDS, NEED_SPOTS, NEEDS } from "../data/needs";
import { RUN_TEXT } from "../data/runText";
import { SHOP_GEAR } from "../data/shop";
import type { DogId, Effect } from "../data/types";
import { UPGRADES } from "../data/upgrades";
import type { EffectSource, RunState } from "../state/runState";
import { activeModifier, testState } from "../testing/runState";
import { TEST_TUNING } from "../testing/tuning";
import { causeLabel, type Change, changeAmount } from "./causes";
import { resolveEffects } from "./effects";
import { fireOwnersAtZero, tipValue } from "./run";
import { giveTreat } from "./treats";
import { cents } from "./units";

const data = {
  debuffs: DEBUFFS,
  dogs: DOGS,
  encounters: ENCOUNTERS,
  forcedStops: FORCED_STOPS,
  needCards: NEED_CARDS,
  needSpots: NEED_SPOTS,
  needs: NEEDS,
  runText: RUN_TEXT,
  shopGear: SHOP_GEAR,
  tuning: TEST_TUNING,
  upgrades: UPGRADES,
};
const skunkIgnore = { encounter: "skunk", kind: "encounter", option: 2 } as const;

function only(changes: readonly Change[]): Change {
  const [change, ...rest] = changes;
  if (change === undefined || rest.length > 0) {
    throw new Error(`Expected one change, got ${changes.length}`);
  }
  return change;
}

// The one change the effect makes to the state.
const resolved = (
  effect: Effect,
  state: RunState,
  affected: readonly DogId[] = [],
  source: EffectSource = skunkIgnore,
) => only(resolveEffects(data, { affected, random: () => 0, source }, [effect], state).changes);

const firing = (money: number) =>
  only(
    fireOwnersAtZero(
      testState({ pierre: 0 }, { feesEarned: { pierre: cents(1300) }, money: cents(money) }),
    ).changes,
  );

const sweetTalker = activeModifier(
  { kind: "upgrade", upgrade: "sweetTalker" },
  { by: "sweetTalkerCostPerDog", operation: "add", stat: "costPerDog" },
);
const towel: Effect = {
  amount: "encounterLow",
  change: "lose",
  kind: "money",
  perDog: { kind: "affected" },
};
const loseOne: Effect = { amount: -1, kind: "hearts", target: { kind: "affected" } };
const gainOne: Effect = { amount: 1, kind: "hearts", target: { kind: "all" } };
const gainTwo: Effect = { amount: 2, kind: "hearts", target: { kind: "all" } };
const stinkyTip = (slots: Parameters<typeof testState>[0]) =>
  tipValue(data, testState(slots, { debuffs: [{ debuff: "stinky" }] }));

describe("causeLabel", () => {
  it.each<[string, () => Change | null, string]>([
    [
      "a dramatic owner's doubling, without the card option just picked",
      () => resolved(loseOne, testState({ nugget: 5 }), ["nugget"]),
      "−2 ♥, dramatic",
    ],
    [
      "the max when a gain is cut short there",
      () =>
        resolved(gainOne, testState({ nugget: 5 }), [], { kind: "upgrade", upgrade: "bellyRubs" }),
      "+1 ♥, dramatic, at max",
    ],
    [
      "the tip and a solo walk's tip factor",
      () => tipValue(data, testState({ koda: 5 })),
      "+$1.50 tip, solo",
    ],
    [
      "Stinky on a halved tip",
      () => stinkyTip({ duchess: 5, koda: 5, nugget: 5 }),
      "+$0.50 tip, Stinky",
    ],
    [
      "Sweet talker on a per-dog cost",
      () =>
        resolved(
          towel,
          testState({ duchess: 5, koda: 5 }, { modifiers: [sweetTalker], money: cents(5000) }),
          ["duchess", "koda"],
        ),
      "−$6, Sweet talker",
    ],
    ["a clawback", () => firing(5000), "−$13 fees taken back"],
    ["a clawback held at the $0 floor", () => firing(500), "−$5 fees taken back, at $0"],
    [
      "a treat as the base",
      () => giveTreat(data, "koda", testState({ koda: 3 }, { treats: 1 })).change,
      "+1 ♥ treat",
    ],
    [
      "an instant encounter as the base",
      () =>
        resolved(
          { amount: "photoOpTip", change: "gain", kind: "money" },
          testState({ koda: 5 }),
          [],
          { encounter: "photoOp", kind: "instant" },
        ),
      "+$10 Photo op",
    ],
  ])("names %s", (_, change, text) => {
    const made = change();
    expect(made === null ? null : causeLabel(data, made)).toBe(text);
  });
});

describe("change causes", () => {
  it.each<[string, () => Change]>([
    ["a tip with a pack-size factor and Stinky", () => stinkyTip({ koda: 5 })],
    ["hearts doubled and capped", () => resolved(gainTwo, testState({ nugget: 4 }))],
  ])("add up to the change: %s", (_, change) => {
    const made = change();
    expect(made.causes.reduce((total, { amount }) => total + amount, 0)).toBe(changeAmount(made));
  });
});
