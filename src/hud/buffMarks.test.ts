import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import type { EncounterId } from "../data/types";
import { fillNames } from "../lib/lines";
import { amountText } from "../rules/causes";
import { cardFor, chooseOption, openCard, type OptionView } from "../rules/choices";
import { baseMoneyCost } from "../rules/effects";
import { formatDollars } from "../rules/effectText";
import { type ModifiedValue, modifierCause } from "../rules/modified";
import { cents, read, roundDollars } from "../rules/units";
import type { WalkItem } from "../runner/walk";
import type { ModifierSource } from "../state/runState";
import { activeModifier, testState } from "../testing/runState";
import {
  type BuffPop,
  NO_SPAWNS,
  optionMarks,
  type PoppedValue,
  popsOf,
  spawnPops,
} from "./buffMarks";

const { card, seconds } = gameData.runText;
const SWEET_TALKER: ModifierSource = { kind: "upgrade", upgrade: "sweetTalker" };
const CASEY: ModifierSource = { kind: "walker", walker: "casey" };
const FANNY_PACK = { gear: "fannyPack", kind: "gear" } as const;
const caseyPerk = { kind: "perk", perk: gameData.walkers.casey.perk } as const;
const kilo = gameData.dogs.kilo.name;

const value = (
  subject: ModifiedValue["subject"],
  before: number,
  shares: readonly [number, ModifierSource][],
): ModifiedValue => ({
  after: shares.reduce((sum, [amount]) => sum + amount, before),
  before,
  by: shares.map(([amount, source]) => modifierCause(amount, source)),
  subject,
});

const option = (modified: readonly ModifiedValue[], text = "Hose it off"): OptionView => ({
  art: "",
  availability: { enabled: true },
  breakdown: [],
  cost: cents(0),
  fires: [],
  index: 0,
  label: "Option",
  modified,
  text,
});

describe("optionMarks", () => {
  const forgiven = value({ dog: "kilo", kind: "hearts" }, -1, [[1, CASEY]]);
  const waived = value({ kind: "money" }, -1000, [[1000, SWEET_TALKER]]);
  const cut = value({ kind: "money" }, -1000, [[500, FANNY_PACK]]);
  const skip = value({ kind: "skip" }, 0, [[1, { gear: "hallPass", kind: "gear" }]]);
  it.each([
    {
      expected: { charms: [], forgiven: null, plaque: null },
      name: "a plain option",
      view: option([]),
    },
    {
      expected: {
        charms: [{ kind: "upgrade", upgrade: "sweetTalker" }],
        forgiven: null,
        plaque: card.free,
      },
      name: "a cost Sweet talker waived, as FREE alone",
      view: option([waived]),
    },
    {
      expected: {
        charms: [FANNY_PACK],
        forgiven: null,
        plaque: "$5",
      },
      name: "a cost a buff cut, as the lowered price alone",
      view: option([cut]),
    },
    {
      expected: {
        charms: [caseyPerk],
        forgiven: {
          name: gameData.walkerPerks[caseyPerk.perk].name,
          rows: [`0♥ ${kilo}`],
        },
        plaque: null,
      },
      name: "a loss the walker's perk forgives, as the hearts left alone",
      view: option([forgiven], fillNames(card.heartForgiven, { dog: kilo, hearts: "1" })),
    },
    {
      expected: { charms: [caseyPerk], forgiven: null, plaque: null },
      name: "a forgiven loss among other effects, which keep their text",
      view: option([forgiven], `−$5, ${fillNames(card.heartForgiven, { dog: kilo, hearts: "1" })}`),
    },
    {
      expected: {
        charms: [{ gear: "hallPass", kind: "gear" }],
        forgiven: null,
        plaque: card.free,
      },
      name: "the Skip Hall pass offers",
      view: undefined,
    },
  ])("marks $name", ({ expected, view }) => {
    expect(optionMarks(gameData, { modified: [skip] }, view)).toEqual(expected);
  });
});

describe("popsOf", () => {
  const item = (kind: WalkItem["kind"], id = 1): WalkItem => ({
    height: 12,
    id,
    kind,
    lane: 0,
    laneSpan: 1,
    y: 0,
  });
  const plain = { charm: true, chip: null, forgiven: null, index: 0, reach: null };
  const big = { kind: "upgrade", upgrade: "bigTipper" } as const;
  const hallPass = { gear: "hallPass", kind: "gear" } as const;
  it.each<{ expected: BuffPop[]; name: string; popped: PoppedValue }>([
    {
      expected: [
        {
          ...plain,
          at: { kind: "walker" },
          forgiven: { dog: "kilo", whole: true },
          item: caseyPerk,
        },
      ],
      name: "a bump forgiven whole, by the walker",
      popped: {
        bump: true,
        dog: "kilo",
        item: item("trashCan"),
        value: value({ dog: "kilo", kind: "hearts" }, -1, [[1, CASEY]]),
      },
    },
    {
      expected: [
        {
          ...plain,
          at: { item: 1, kind: "item" },
          charm: false,
          chip: "+$2",
          item: big,
        },
      ],
      name: "a tip Big tipper raised, as the new amount's chip with no charm",
      popped: {
        bump: false,
        dog: null,
        item: item("tip"),
        value: value({ kind: "money" }, 100, [[100, big]]),
      },
    },
    {
      expected: [
        { ...plain, at: { item: 1, kind: "item" }, charm: false, chip: "+$3", item: big },
        { ...plain, at: { item: 1, kind: "item" }, charm: false, index: 1, item: hallPass },
      ],
      name: "a tip two buffs raised, as one chip with no charm",
      popped: {
        bump: false,
        dog: null,
        item: item("tip"),
        value: value({ kind: "money" }, 100, [
          [100, big],
          [100, hallPass],
        ]),
      },
    },
    {
      expected: [
        {
          ...plain,
          at: { item: 1, kind: "item" },
          item: { kind: "perk", perk: "longReach" },
          reach: { dog: "kilo", item: 1 },
        },
      ],
      name: "a treat Long reach grabbed, with its line",
      popped: {
        bump: false,
        dog: "kilo",
        item: item("treat"),
        value: value({ kind: "reach", pickup: "treat" }, 0, [
          [1, { kind: "walker", walker: "trista" }],
        ]),
      },
    },
    {
      expected: [
        {
          ...plain,
          at: { kind: "pack" },
          chip: fillNames(seconds, { seconds: "4" }),
          item: { kind: "perk", perk: "quickRecovery" },
        },
      ],
      name: "a debuff Quick recovery shortened, with its charm and the new seconds' chip",
      popped: {
        bump: false,
        dog: null,
        item: null,
        value: value({ debuff: "muddy", kind: "debuffSeconds" }, 8, [
          [-4, { kind: "walker", walker: "ada" }],
        ]),
      },
    },
    {
      expected: [],
      name: "nothing for a debuff's change",
      popped: {
        bump: false,
        dog: null,
        item: item("tip"),
        value: value({ kind: "money" }, 100, [[-100, { debuff: "stinky", kind: "debuff" }]]),
      },
    },
  ])("pops $name", ({ expected, popped }) => {
    expect(popsOf(gameData, [popped])).toEqual(expected);
  });

  it("stacks a second pop at the same place", () => {
    const raised = value({ kind: "money" }, 100, [[100, big]]);
    const tip = { bump: false, dog: null, item: item("tip"), value: raised };
    expect(popsOf(gameData, [tip, tip]).map(({ index }) => index)).toEqual([0, 1]);
  });
});

describe("spawnPops", () => {
  it("pops Keen eye's charm on every second treat collected", () => {
    const run = testState(
      { kilo: 3 },
      {
        modifiers: [
          activeModifier(
            { kind: "walker", walker: "mrB" },
            { by: "keenEyeTreatSpawns", operation: "multiply", stat: "treatSpawns" },
          ),
        ],
        walker: "mrB",
      },
    );
    const treat = (id: number): WalkItem => ({
      height: 12,
      id,
      kind: "treat",
      lane: 0,
      laneSpan: 1,
      y: 0,
    });
    let counts = NO_SPAWNS;
    const popped = [1, 2, 3, 4].map((id) => {
      const step = spawnPops(gameData, run, [treat(id)], counts);
      counts = step.counts;
      return step.pops.map(({ item }) => item);
    });
    const finder = { kind: "perk", perk: "keenEye" };
    expect(popped).toEqual([[], [finder], [], [finder]]);
  });
});

describe("a card cost Fanny pack cuts", () => {
  const fannyPack = activeModifier(FANNY_PACK, {
    by: "fannyPackCardCostFactor",
    operation: "multiply",
    stat: "cardCost",
  });
  const factor = read(gameData.tuning, "multipliers", "fannyPackCardCostFactor");
  const optionEffects = (id: EncounterId, index: number) => {
    const { resolution } = gameData.encounters[id];
    return resolution.kind === "card" ? (resolution.options[index]?.effects ?? []) : [];
  };
  const paid = (Object.keys(gameData.encounters) as EncounterId[]).flatMap((id) => {
    const { resolution } = gameData.encounters[id];
    return resolution.kind === "card"
      ? resolution.options.flatMap((option, index) =>
          baseMoneyCost(gameData, option.effects) > 0 ? [[id, option.name, index] as const] : [],
        )
      : [];
  });

  it.each(paid)("shows %s's %s at the cut price everywhere, and charges it", (id, _, index) => {
    const state = testState(
      { duchess: 5, kilo: 5 },
      { modifiers: [fannyPack], money: cents(5000) },
    );
    const source = { affected: ["duchess", "kilo"], encounter: id, kind: "encounter" } as const;
    const opened = openCard(source, state);
    const card = cardFor(gameData, opened, source);
    const view = card.options.find((each) => each.index === index);
    const base = baseMoneyCost(gameData, optionEffects(id, index));
    const cost = roundDollars(base * factor);
    const charged = -chooseOption(gameData, opened, card, index).moneyDelta;
    expect([view?.cost, charged]).toEqual([cost, cost]);
    expect(optionMarks(gameData, card, view).plaque).toBe(formatDollars(cost));
    expect(view?.text).toContain(`−${formatDollars(cost)}`);
    expect(view?.breakdown).toContainEqual({
      dog: null,
      name: gameData.shopGear.fannyPack.name,
      text: amountText("money", base - cost),
    });
  });
});
