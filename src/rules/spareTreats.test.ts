import { describe, expect, it } from "vitest";

import { DEBUFFS } from "../data/debuffs";
import { DOGS } from "../data/dogs";
import { ENCOUNTERS } from "../data/encounters";
import { HOME_TEXT } from "../data/homeText";
import { QUIPS } from "../data/quips";
import { RUN_TEXT } from "../data/runText";
import { SHOP_GEAR } from "../data/shop";
import type { DogId, EncounterId, GearId } from "../data/types";
import { UPGRADES } from "../data/upgrades";
import { keysOf } from "../lib/records";
import { clampHearts } from "../lib/units";
import { packOrder } from "../state/pack";
import { type ModifierSource, newRun, type RunState } from "../state/runState";
import { activeModifier, heartsByDog, testState } from "../testing/runState";
import { TEST_TUNING } from "../testing/tuning";
import { TEST_WALKER_DATA } from "../testing/walkers";
import { TEST_WORLD } from "../testing/world";
import type { HeartChange } from "./causes";
import { cardFor, chooseOption, openCard } from "./choices";
import { ownerMaxHearts } from "./dogs";
import { grabGear } from "./gearDrops";
import { modifiersOf } from "./modifiers";
import { spareTreatRoom, spendSpareTreat, storeSpareTreat } from "./spareTreats";
import { read } from "./units";

const data = {
  debuffs: DEBUFFS,
  dogs: DOGS,
  encounters: ENCOUNTERS,
  homeText: HOME_TEXT,
  quips: QUIPS,
  runText: RUN_TEXT,
  shopGear: SHOP_GEAR,
  ...TEST_WALKER_DATA,
  tuning: TEST_TUNING,
  upgrades: UPGRADES,
  world: TEST_WORLD,
};

const FANNY_PACK: ModifierSource = { gear: "fannyPack", kind: "gear" };
const fannyModifiers = modifiersOf(SHOP_GEAR.fannyPack.effects).map((modifier) =>
  activeModifier(FANNY_PACK, modifier),
);
const room = spareTreatRoom(data, { modifiers: fannyModifiers });
const treat = read(TEST_TUNING, "hearts", "treat");
const TRIO = packOrder(DOGS, ["kilo", "biscuit", "duchess"] as const);

// A run walking dogs at hearts, in pack order, with the Fanny pack's modifiers and held spare
// treats, unless gear is false.
function fannyRun(
  dogs: readonly DogId[],
  hearts: readonly number[],
  held: number,
  gear = true,
): RunState {
  const slots = Object.fromEntries(dogs.map((dog, index) => [dog, hearts[index] ?? 0]));
  return testState(slots, {
    modifiers: gear ? fannyModifiers : [],
    spareTreats: { held, spent: 0, stored: 0 },
  });
}

// Each walking owner's max.
const maxes = (run: RunState, dogs: readonly DogId[]) =>
  dogs.map((dog) => ownerMaxHearts(data, run, dog));

describe("storeSpareTreat", () => {
  const atMax = fannyRun(TRIO, [], 0);
  const full = maxes(atMax, TRIO);
  it.each([
    { expected: 1, gear: true, hearts: full, held: 0, name: "holds one at every max" },
    {
      expected: null,
      gear: true,
      hearts: full.map((max, index) => (index === 1 ? max - 1 : max)),
      held: 0,
      name: "leaves one for an owner below their max",
    },
    { expected: null, gear: true, hearts: full, held: room, name: "wastes one with the pack full" },
    { expected: null, gear: false, hearts: full, held: 0, name: "wastes one with no Fanny pack" },
  ])("$name", ({ expected, gear, hearts, held }) => {
    const stored = storeSpareTreat(data, fannyRun(TRIO, hearts, held, gear));
    expect(stored === null ? null : stored.spareTreats).toEqual(
      expected === null ? null : { held: held + expected, spent: 0, stored: expected },
    );
  });
});

// A card option that costs each affected owner 1 heart and nothing else.
const HEARTS_CARD = keysOf(ENCOUNTERS)
  .flatMap((encounter): { encounter: EncounterId; index: number }[] => {
    const { resolution } = ENCOUNTERS[encounter];
    if (resolution.kind !== "card") {
      return [];
    }
    return resolution.options.flatMap((option, index) => {
      const [only, ...rest] = option.effects;
      return rest.length === 0 &&
        only?.kind === "hearts" &&
        only.amount === -1 &&
        only.target.kind === "affected"
        ? [{ encounter, index }]
        : [];
    });
  })
  .at(0);

// The card for the hearts option with every dog affected, its view of the option, and the
// outcome of choosing it.
function chooseHearts(cardData: typeof data, run: RunState, dogs: readonly DogId[]) {
  if (HEARTS_CARD === undefined) {
    throw new Error("No card option costs each affected owner 1 heart alone");
  }
  const { encounter, index } = HEARTS_CARD;
  const source = { affected: [...dogs], encounter, kind: "encounter" } as const;
  const opened = openCard(source, run);
  const card = cardFor(cardData, opened, source);
  return {
    outcome: chooseOption(cardData, opened, card, index),
    view: card.options.find((option) => option.index === index),
  };
}

describe("a spare treat spent on a card's hearts", () => {
  it.each([
    { hearts: [3], name: "the one owner who lost one", recipient: 0 },
    { hearts: [1], name: "an owner on their last heart, who keeps walking", recipient: 0 },
    { hearts: [3, 2, 4], name: "the owner left with the fewest", recipient: 1 },
    { hearts: [2, 3, 2], name: "the front dog of those tied at the fewest", recipient: 0 },
  ])("gives a heart back to $name, before any firing", ({ hearts, recipient }) => {
    const dogs = TRIO.slice(0, hearts.length);
    const { outcome, view } = chooseHearts(data, fannyRun(dogs, hearts, 1), dogs);
    const dog = dogs[recipient];
    const expected = Object.fromEntries(
      dogs.map((each, index) => [each, (hearts[index] ?? 0) - 1 + (each === dog ? treat : 0)]),
    );
    expect(outcome.spareTreat?.dog).toBe(dog);
    expect(outcome.spareTreat?.causes).toEqual([
      { amount: treat, kind: "effect", source: FANNY_PACK },
    ]);
    expect([outcome.fired, view?.fires]).toEqual([[], []]);
    expect(heartsByDog(outcome.state)).toEqual(expected);
    expect(outcome.state.spareTreats).toEqual({ held: 0, spent: 1, stored: 0 });
  });

  // Casey's Second chance forgives the first heart lost each zone, unless forgiven is already
  // used up; a lone owner on their last heart loses one.
  const forgiving = {
    ...data,
    tuning: { ...TEST_TUNING, hearts: { ...TEST_TUNING.hearts, secondChanceForgiven: 1 } },
  };
  const [lone] = TRIO;
  it.each([
    { fired: [lone], forgiven: 1, held: 0, name: "with none held, and the owner fires you" },
    { fired: [], forgiven: 0, held: 1, name: "on a loss Second chance forgave" },
  ])("spends none $name", ({ fired, forgiven, held }) => {
    const casey = newRun(forgiving, 3, { dogs: [lone], gear: "fannyPack", walker: "casey" });
    const run: RunState = {
      ...casey,
      heartsForgiven: forgiven,
      pack: testState({ [lone]: 1 }).pack,
      spareTreats: { held, spent: 0, stored: 0 },
    };
    const { outcome } = chooseHearts(forgiving, run, [lone]);
    expect(outcome.spareTreat).toBeNull();
    expect(outcome.fired).toEqual(fired);
    expect(outcome.state.spareTreats.held).toBe(held);
  });

  it("spends none on a gain", () => {
    const run = fannyRun([lone], [2], 1);
    const gain: HeartChange = {
      after: clampHearts(3, 3),
      before: clampHearts(2, 2),
      causes: [],
      dog: lone,
      kind: "hearts",
    };
    expect(spendSpareTreat(data, [gain], run)).toEqual({ change: null, state: run });
  });
});

describe("a found Fanny pack's spare treat", () => {
  const [first, second] = keysOf(SHOP_GEAR).filter((gear) => gear !== "fannyPack") as [
    GearId,
    GearId,
  ];
  // A walk with the Fanny pack in the Pocket and first found, or with the Fanny pack found, its
  // spare treats full; then second grabbed.
  it.each([
    { expected: 0, found: "fannyPack", name: "goes back with it", pocket: null },
    { expected: room, found: first, name: "stays with the Pocket's", pocket: "fannyPack" },
  ] as const)("$name when another drop is grabbed", ({ expected, found, pocket }) => {
    const run = newRun(data, 3, { dogs: [TRIO[0]], gear: pocket, walker: "casey" });
    const grabbed = grabGear(data, found, run).run;
    const holding = { ...grabbed, spareTreats: { held: room, spent: 0, stored: room } };
    expect(grabGear(data, second, holding).run.spareTreats.held).toBe(expected);
  });
});
