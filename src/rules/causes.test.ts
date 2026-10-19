import { describe, expect, it } from "vitest";

import { DEBUFFS } from "../data/debuffs";
import { DOGS } from "../data/dogs";
import { ENCOUNTERS } from "../data/encounters";
import { FORCED_STOPS } from "../data/forcedStops";
import { SHOP_GEAR } from "../data/shop";
import type { Effect } from "../data/types";
import { UPGRADES } from "../data/upgrades";
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

const label = (changes: readonly Change[]) => causeLabel(data, only(changes));

describe("causeLabel", () => {
  it("names a dramatic owner's doubling, without naming the card option just picked", () => {
    const loseOne: Effect = { amount: -1, kind: "hearts", target: { kind: "affected" } };
    const { changes } = resolveEffects(
      data,
      { affected: ["nugget"], random: () => 0, source: skunkIgnore },
      [loseOne],
      testState({ nugget: 5 }),
    );
    expect(label(changes)).toBe("−2 ♥, dramatic");
  });

  it("names the max when a gain is cut short there", () => {
    const gainOne: Effect = { amount: 1, kind: "hearts", target: { kind: "all" } };
    const { changes } = resolveEffects(
      data,
      { affected: [], random: () => 0, source: { kind: "upgrade", upgrade: "bellyRubs" } },
      [gainOne],
      testState({ nugget: 5 }),
    );
    expect(label(changes)).toBe("+1 ♥, dramatic, at max");
  });

  it("names the tip and a solo walk's tip factor", () => {
    expect(causeLabel(data, tipValue(data, testState({ koda: 5 })))).toBe("+$1.50 tip, solo");
  });

  it("names Stinky on a halved tip", () => {
    const tip = tipValue(
      data,
      testState({ duchess: 5, koda: 5, nugget: 5 }, { debuffs: ["stinky"] }),
    );
    expect(causeLabel(data, tip)).toBe("+$0.50 tip, Stinky");
  });

  it("names Sweet talker on a per-dog cost", () => {
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
    const state = testState(
      { duchess: 5, koda: 5 },
      { modifiers: [sweetTalker], money: cents(5000) },
    );
    const { changes } = resolveEffects(
      data,
      { affected: ["duchess", "koda"], random: () => 0, source: skunkIgnore },
      [towel],
      state,
    );
    expect(label(changes)).toBe("−$6, Sweet talker");
  });

  it("names a clawback, and the $0 floor when the fees were already spent", () => {
    const fired = (money: number) =>
      fireOwnersAtZero(
        testState({ pierre: 0 }, { feesEarned: { pierre: cents(1300) }, money: cents(money) }),
      ).changes;
    expect(label(fired(5000))).toBe("−$13 fees taken back");
    expect(label(fired(500))).toBe("−$5 fees taken back, at $0");
  });

  it("names a treat and an instant encounter as the base", () => {
    const treat = giveTreat(data, "koda", testState({ koda: 3 }, { treats: 1 })).change;
    expect(treat === null ? null : causeLabel(data, treat)).toBe("+1 ♥ treat");
    const photoOp: Effect = { amount: "photoOpTip", change: "gain", kind: "money" };
    const { changes } = resolveEffects(
      data,
      { affected: [], random: () => 0, source: { encounter: "photoOp", kind: "instant" } },
      [photoOp],
      testState({ koda: 5 }),
    );
    expect(label(changes)).toBe("+$10 Photo op");
  });
});

describe("change causes", () => {
  it("add up to the change", () => {
    const tip = tipValue(data, testState({ koda: 5 }, { debuffs: ["stinky"] }));
    const sum = (change: Change) => change.causes.reduce((total, { amount }) => total + amount, 0);
    expect(sum(tip)).toBe(changeAmount(tip));
    const gainTwo: Effect = { amount: 2, kind: "hearts", target: { kind: "all" } };
    const hearts = only(
      resolveEffects(
        data,
        { affected: [], random: () => 0, source: skunkIgnore },
        [gainTwo],
        testState({ nugget: 4 }),
      ).changes,
    );
    expect(sum(hearts)).toBe(changeAmount(hearts));
  });
});
