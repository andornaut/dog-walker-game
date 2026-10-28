import { describe, expect, it } from "vitest";

import { DEBUFFS } from "../data/debuffs";
import { DOGS } from "../data/dogs";
import { ENCOUNTERS } from "../data/encounters";
import { RUN_TEXT } from "../data/runText";
import { SHOP_GEAR } from "../data/shop";
import type { DogId, Effect } from "../data/types";
import { UPGRADES } from "../data/upgrades";
import type { EffectSource, RunState } from "../state/runState";
import { LONE } from "../testing/packPlaces";
import { activeModifier, testState } from "../testing/runState";
import { TEST_TUNING } from "../testing/tuning";
import { TEST_WALKER_DATA } from "../testing/walkers";
import { type Change, changeAmount } from "./causes";
import { maxHearts } from "./dogs";
import { resolveEffects } from "./effects";
import { tipValue } from "./run";

const data = {
  debuffs: DEBUFFS,
  dogs: DOGS,
  encounters: ENCOUNTERS,
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
) => only(resolveEffects(data, { affected, source }, [effect], state).changes);

// A lone dog's owner's max.
const maxOf = (dog: DogId) => maxHearts(TEST_TUNING, [], LONE, DOGS[dog]);
const gainTwo: Effect = { amount: 2, kind: "hearts", target: { kind: "all" } };
const bigTipper = activeModifier(
  { kind: "upgrade", upgrade: "bigTipper" },
  { by: "bigTipperTipBonus", operation: "add", stat: "tipValue" },
);
const bigTipperTip = () => tipValue(data, testState({ kilo: 5 }, { modifiers: [bigTipper] }));

describe("change causes", () => {
  it("add up to the change", () => {
    for (const [, change] of [
      ["a tip with Big tipper's bonus", bigTipperTip],
      [
        "hearts capped",
        () => resolved(gainTwo, testState({ reggie: maxOf("reggie") - 1 }), [], skunkIgnore),
      ],
    ] satisfies readonly [string, () => Change][]) {
      const made = change();
      expect(made.causes.reduce((total, { amount }) => total + amount, 0)).toBe(changeAmount(made));
    }
  });
});
