import { describe, expect, it } from "vitest";

import { DEBUFFS } from "../data/debuffs";
import { DOGS } from "../data/dogs";
import { ENCOUNTERS } from "../data/encounters";
import { FORCED_STOPS } from "../data/forcedStops";
import { NEED_CARDS, NEED_SPOTS, NEEDS } from "../data/needs";
import { QUIRKS } from "../data/quirks";
import { RUN_TEXT } from "../data/runText";
import { SHOP_GEAR } from "../data/shop";
import type { DogId, Effect } from "../data/types";
import { UPGRADES } from "../data/upgrades";
import type { EffectSource, RunState } from "../state/runState";
import { activeModifier, testState } from "../testing/runState";
import { TEST_TUNING } from "../testing/tuning";
import { TEST_WALKER_DATA } from "../testing/walkers";
import { TEST_WORLD } from "../testing/world";
import { causeLabel, causeNames, type Change, changeAmount } from "./causes";
import { resolveEffects } from "./effects";
import { payZoneFees, tipValue } from "./run";
import { giveTreat } from "./treats";
import { cents, read, readTable, roundDollars } from "./units";

const data = {
  debuffs: DEBUFFS,
  dogs: DOGS,
  encounters: ENCOUNTERS,
  forcedStops: FORCED_STOPS,
  needCards: NEED_CARDS,
  needSpots: NEED_SPOTS,
  needs: NEEDS,
  quirks: QUIRKS,
  runText: RUN_TEXT,
  shopGear: SHOP_GEAR,
  ...TEST_WALKER_DATA,
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

const sweetTalker = activeModifier(
  { kind: "upgrade", upgrade: "sweetTalker" },
  { by: "sweetTalkerCostPerDog", operation: "add", stat: "costPerDog" },
);
// The test tuning's walkers change nothing, so Ben's pace gets a fee factor of its own here.
const benTuning = {
  ...TEST_TUNING,
  multipliers: { ...TEST_TUNING.multipliers, slowWalkerFees: 0.9 },
};
// Duchess's fee under Ben's pace, to the dollar.
const bensFee = roundDollars(
  readTable(benTuning, "money", "feeByTemperament", "dramatic") *
    read(benTuning, "multipliers", "slowWalkerFees"),
);
const bensFees = activeModifier(
  { kind: "walker", walker: "ben" },
  { by: "slowWalkerFees", operation: "multiply", stat: "fees" },
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
const bigTipper = activeModifier(
  { kind: "upgrade", upgrade: "bigTipper" },
  { by: "bigTipperTipBonus", operation: "add", stat: "tipValue" },
);
const bigTipperTip = () => tipValue(data, testState({ koda: 5 }, { modifiers: [bigTipper] }));

describe("causeLabel and causeNames", () => {
  it.each<[string, () => Change | null, string, string[]]>([
    [
      "a dramatic owner's doubling, without the card option just picked",
      () => resolved(loseOne, testState({ nugget: 5 }), ["nugget"]),
      "−2 ♥, dramatic",
      ["dramatic"],
    ],
    [
      "the max when a gain is cut short there",
      () =>
        resolved(gainOne, testState({ nugget: 5 }), [], { kind: "upgrade", upgrade: "bellyRubs" }),
      "+1 ♥, dramatic, at max",
      ["dramatic", "at max"],
    ],
    ["the tip and Big tipper's bonus", bigTipperTip, "+$2 tip, Big tipper", ["tip", "Big tipper"]],
    [
      "the walker who changed a fee",
      () => {
        const [fee] = payZoneFees(
          { ...data, tuning: benTuning, world: TEST_WORLD },
          testState({ duchess: 5 }, { modifiers: [bensFees] }),
        ).changes;
        if (fee === undefined) {
          throw new Error("Expected a fee");
        }
        return fee;
      },
      `+$${bensFee / 100} fee, Ben`,
      ["fee", "Ben"],
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
      ["Sweet talker"],
    ],
    [
      "a cost held at the $0 floor",
      () =>
        resolved(towel, testState({ duchess: 5, koda: 5 }, { money: cents(500) }), [
          "duchess",
          "koda",
        ]),
      "−$5, you're out of money",
      ["you're out of money"],
    ],
    [
      "a treat as the base",
      () => giveTreat(data, "koda", testState({ koda: 3 }, { treats: 1 })).change,
      "+1 ♥ treat",
      ["treat"],
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
      ["Photo op"],
    ],
  ])("names %s", (_, change, text, names) => {
    const made = change();
    expect(made === null ? null : causeLabel(data, made)).toBe(text);
    expect(made === null ? null : causeNames(data, made)).toEqual(names);
  });
});

describe("change causes", () => {
  it.each<[string, () => Change]>([
    ["a tip with Big tipper's bonus", bigTipperTip],
    ["hearts doubled and capped", () => resolved(gainTwo, testState({ nugget: 4 }))],
  ])("add up to the change: %s", (_, change) => {
    const made = change();
    expect(made.causes.reduce((total, { amount }) => total + amount, 0)).toBe(changeAmount(made));
  });
});
