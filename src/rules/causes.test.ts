import { describe, expect, it } from "vitest";

import { DEBUFFS } from "../data/debuffs";
import { DOGS } from "../data/dogs";
import { ENCOUNTERS } from "../data/encounters";
import { RUN_TEXT } from "../data/runText";
import { SHOP_GEAR } from "../data/shop";
import type { DogId, Effect, ZoneId } from "../data/types";
import { UPGRADES } from "../data/upgrades";
import type { EffectSource, RunState } from "../state/runState";
import { LONE } from "../testing/packPlaces";
import { activeModifier, testState } from "../testing/runState";
import { TEST_TUNING } from "../testing/tuning";
import { TEST_WALKER_DATA } from "../testing/walkers";
import { TEST_WORLD } from "../testing/world";
import { causeLabel, type Change, changeAmount } from "./causes";
import { maxHearts } from "./dogs";
import { changeHearts, resolveEffects } from "./effects";
import { formatDollars } from "./effectText";
import { payZone, tipValue } from "./run";
import { cents, read } from "./units";

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

const sweetTalker = activeModifier(
  { kind: "upgrade", upgrade: "sweetTalker" },
  { by: "sweetTalkerFreeCards", operation: "add", stat: "freeCards" },
);
// The first zone at twice the pay, for a lone dog.
const [firstZone, ...laterZones] = TEST_WORLD.zones;
const doublePay = {
  ...TEST_WORLD,
  zones: [{ ...firstZone, fees: 2 }, ...laterZones] as typeof TEST_WORLD.zones,
};
const lonePay = read(TEST_TUNING, "money", "payPerDog");
const tipText = formatDollars(
  cents(read(TEST_TUNING, "money", "tip") + read(TEST_TUNING, "money", "bigTipperTipBonus")),
);

const towel: Effect = {
  amount: "encounterLow",
  change: "lose",
  kind: "money",
};
const loseOne: Effect = { amount: -1, kind: "hearts", target: { kind: "affected" } };
// A lone dog's owner's max.
const maxOf = (dog: DogId) => maxHearts(TEST_TUNING, [], LONE, DOGS[dog]);
const gainTwo: Effect = { amount: 2, kind: "hearts", target: { kind: "all" } };
const bigTipper = activeModifier(
  { kind: "upgrade", upgrade: "bigTipper" },
  { by: "bigTipperTipBonus", operation: "add", stat: "tipValue" },
);
const bigTipperTip = () => tipValue(data, testState({ koda: 5 }, { modifiers: [bigTipper] }));

describe("causeLabel", () => {
  it("names each cause", () => {
    for (const [, change, text] of [
      [
        "a card option just picked by its amount alone",
        () => resolved(loseOne, testState({ nugget: 5 }), ["nugget"]),
        "−1♥",
      ],
      [
        "the max when a gain is cut short there",
        () =>
          resolved(gainTwo, testState({ nugget: maxOf("nugget") - 1 }), [], {
            kind: "upgrade",
            upgrade: "bellyRubs",
          }),
        `+1♥, ${RUN_TEXT.causes.atMax}`,
      ],
      [
        "the tip and Big tipper's bonus",
        bigTipperTip,
        `+${tipText} ${RUN_TEXT.causes.tip}, ${UPGRADES.bigTipper.name}`,
      ],
      [
        "the zone that changed a pay",
        () => {
          const run = testState({ duchess: 5 }, { route: [firstZone.id as ZoneId] });
          const [pay] = payZone({ ...data, world: doublePay }, run).changes;
          if (pay === undefined) {
            throw new Error("Expected a pay");
          }
          return pay;
        },
        `+${formatDollars(cents(2 * lonePay))} ${RUN_TEXT.causes.pay}, ${firstZone.name}`,
      ],
      [
        "a cost by its amount alone",
        () =>
          resolved(
            towel,
            testState({ duchess: 5, koda: 5 }, { cardsThisZone: 1, modifiers: [sweetTalker] }),
            ["duchess", "koda"],
          ),
        `−${formatDollars(read(TEST_TUNING, "money", "encounterLow"))}`,
      ],
      [
        "a treat as the base",
        () =>
          changeHearts(
            data,
            [{ amount: read(TEST_TUNING, "hearts", "treat"), kind: "treat" }],
            "koda",
            testState({ koda: 3 }),
          ).change,
        `+${read(TEST_TUNING, "hearts", "treat")}♥ ${RUN_TEXT.causes.treat}`,
      ],
      [
        "an instant encounter as the base",
        () =>
          resolved(
            { amount: "lostWalletKeep", change: "gain", kind: "money" },
            testState({ koda: 5 }),
            [],
            { encounter: "lostWallet", kind: "instant" },
          ),
        `+${formatDollars(read(TEST_TUNING, "money", "lostWalletKeep"))} ${ENCOUNTERS.lostWallet.name}`,
      ],
    ] satisfies readonly [string, () => Change | null, string][]) {
      const made = change();
      expect(made === null ? null : causeLabel(data, made)).toBe(text);
    }
  });
});

describe("change causes", () => {
  it("add up to the change", () => {
    for (const [, change] of [
      ["a tip with Big tipper's bonus", bigTipperTip],
      [
        "hearts capped",
        () => resolved(gainTwo, testState({ nugget: maxOf("nugget") - 1 }), [], skunkIgnore),
      ],
    ] satisfies readonly [string, () => Change][]) {
      const made = change();
      expect(made.causes.reduce((total, { amount }) => total + amount, 0)).toBe(changeAmount(made));
    }
  });
});
