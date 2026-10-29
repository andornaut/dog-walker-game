import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import type { DogId, Size } from "../data/types";
import { fillNames } from "../lib/lines";
import { keysOf } from "../lib/records";
import { cents } from "../lib/units";
import { gearSourceName } from "../rules/causes";
import type { OptionView } from "../rules/choices";
import { laneSpeedText } from "../rules/effectText";
import { grabGear } from "../rules/gearDrops";
import { type ModifiedValue, modifierCause } from "../rules/modified";
import { read } from "../rules/units";
import type { WalkItem } from "../runner/walkItems";
import { packDogs } from "../state/pack";
import { type ModifierSource, newRun } from "../state/runState";
import {
  type BuffPop,
  extraHearts,
  optionMarks,
  type PoppedValue,
  reachIcons,
  type ReachLine,
  roadMarks,
  walkStartMarks,
} from "./buffMarks";
import { effectIconKey, type EffectItem, effectName } from "./effectIcons";

const { card, seconds } = gameData.runText;
const SWEET_TALKER: ModifierSource = { kind: "upgrade", upgrade: "sweetTalker" };
const CASEY: ModifierSource = { kind: "walker", walker: "casey" };
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
  const ADA: ModifierSource = { kind: "walker", walker: "ada" };
  const adaPerk = { kind: "perk", perk: gameData.walkers.ada.perk } as const;
  const shortened = value({ debuff: "muddy", kind: "debuffSeconds" }, 30, [[-15, ADA]]);
  const hallPass = { gear: "hallPass", kind: "gear" } as const;
  const skip = value({ kind: "skip" }, 0, [[1, hallPass]]);
  const sweetTalker = { kind: "upgrade", upgrade: "sweetTalker" } as const;
  const charm = (item: EffectItem, effect: keyof typeof card.charmEffect) => ({
    effect: card.charmEffect[effect],
    item,
    name: effectName(gameData, item),
  });
  it.each([
    {
      expected: { charms: [], forgiven: null, plaque: null },
      name: "a plain option",
      view: option([]),
    },
    {
      expected: { charms: [charm(sweetTalker, "freeCards")], forgiven: null, plaque: card.free },
      name: "a cost Sweet talker waived, as FREE alone",
      view: option([waived]),
    },
    {
      expected: {
        charms: [charm(caseyPerk, "forgivenHearts")],
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
      expected: { charms: [charm(caseyPerk, "forgivenHearts")], forgiven: null, plaque: null },
      name: "a forgiven loss among other effects, which keep their text",
      view: option([forgiven], `−$5, ${fillNames(card.heartForgiven, { dog: kilo, hearts: "1" })}`),
    },
    {
      expected: {
        charms: [charm(adaPerk, "debuffSeconds"), charm(sweetTalker, "freeCards")],
        forgiven: null,
        plaque: card.free,
      },
      name: "a debuff the walker's perk shortened and a waived cost, a charm each in order",
      view: option([shortened, waived]),
    },
    {
      expected: { charms: [charm(hallPass, "skipOption")], forgiven: null, plaque: card.free },
      name: "the Skip Hall pass offers",
      view: undefined,
    },
  ])("marks $name", ({ expected, view }) => {
    expect(optionMarks(gameData, { modified: [skip] }, view)).toEqual(expected);
  });
});

describe("roadMarks", () => {
  const item = (kind: WalkItem["kind"], id = 1): WalkItem => ({
    height: 12,
    id,
    kind,
    lane: 0,
    laneSpan: 1,
    y: 0,
  });
  const plain = { chip: null, forgiven: null, index: 0 };
  const longReach = { kind: "perk", perk: "longReach" } as const;
  const big = { kind: "upgrade", upgrade: "bigTipper" } as const;
  const hallPass = { gear: "hallPass", kind: "gear" } as const;
  it.each<{ name: string; popped: PoppedValue; pops: BuffPop[]; reaches?: ReachLine[] }>([
    {
      name: "a bump forgiven whole, by the walker",
      popped: {
        bump: true,
        dog: "kilo",
        item: item("trashCan"),
        value: value({ dog: "kilo", kind: "hearts" }, -1, [[1, CASEY]]),
      },
      pops: [
        {
          ...plain,
          at: { kind: "walker" },
          forgiven: { dog: "kilo", whole: true },
          item: caseyPerk,
        },
      ],
    },
    {
      name: "a tip Big tipper raised, as its charm with no chip",
      popped: {
        bump: false,
        dog: null,
        item: item("tip"),
        value: value({ kind: "money" }, 100, [[100, big]]),
      },
      pops: [{ ...plain, at: { item: 1, kind: "item" }, item: big }],
    },
    {
      name: "a tip two buffs raised, as their charms with no chip",
      popped: {
        bump: false,
        dog: null,
        item: item("tip"),
        value: value({ kind: "money" }, 100, [
          [100, big],
          [100, hallPass],
        ]),
      },
      pops: [
        { ...plain, at: { item: 1, kind: "item" }, item: big },
        { ...plain, at: { item: 1, kind: "item" }, index: 1, item: hallPass },
      ],
    },
    {
      name: "a treat Long reach grabbed, as its line from the dog and its well's glint",
      popped: {
        bump: false,
        dog: "kilo",
        item: item("treat"),
        value: value({ kind: "reach", pickup: "treat" }, 0, [
          [1, { kind: "walker", walker: "trista" }],
        ]),
      },
      pops: [],
      reaches: [{ dog: "kilo", glint: longReach, item: 1 }],
    },
    {
      name: "a tip Long reach grabbed, as its line from the pack's lead and its well's glint",
      popped: {
        bump: false,
        dog: null,
        item: item("tip", 2),
        value: value({ kind: "reach", pickup: "tip" }, 0, [
          [1, { kind: "walker", walker: "trista" }],
        ]),
      },
      pops: [],
      reaches: [{ dog: null, glint: longReach, item: 2 }],
    },
    {
      name: "a debuff Quick recovery shortened, with its charm and the new seconds' chip",
      popped: {
        bump: false,
        dog: null,
        item: null,
        value: value({ debuff: "muddy", kind: "debuffSeconds" }, 8, [
          [-4, { kind: "walker", walker: "ada" }],
        ]),
      },
      pops: [
        {
          ...plain,
          at: { kind: "pack" },
          chip: fillNames(seconds, { seconds: "4" }),
          item: { kind: "perk", perk: "quickRecovery" },
        },
      ],
    },
    {
      name: "a card option's cost Sweet talker waived, with its charm and the waived cost's chip",
      popped: {
        bump: false,
        dog: null,
        item: null,
        value: value({ kind: "money" }, -300, [[300, SWEET_TALKER]]),
      },
      pops: [
        {
          ...plain,
          at: { kind: "pack" },
          chip: gameData.runText.waivedCost,
          item: { kind: "upgrade", upgrade: "sweetTalker" },
        },
      ],
    },
    {
      name: "nothing for a debuff's change",
      popped: {
        bump: false,
        dog: null,
        item: item("tip"),
        value: value({ kind: "money" }, 100, [[-100, { debuff: "stinky", kind: "debuff" }]]),
      },
      pops: [],
    },
  ])("marks $name", ({ popped, pops, reaches = [] }) => {
    expect(roadMarks(gameData, [popped])).toEqual({ pops, reaches });
  });

  it("stacks a second pop at the same place", () => {
    const raised = value({ kind: "money" }, 100, [[100, big]]);
    const tip = { bump: false, dog: null, item: item("tip"), value: raised };
    expect(roadMarks(gameData, [tip, tip]).pops.map(({ index }) => index)).toEqual([0, 1]);
  });
});

describe("found gear's marks", () => {
  // A Lucky collar in the Pocket, or found on the road, names its row in a held dog card: Buddy's,
  // which walks beside the lead and takes no pack-size bonus.
  const fresh = (gear: "luckyCollar" | null) =>
    newRun(gameData, 3, { dogs: ["reggie", "buddy", "kilo"], gear, walker: "casey" });
  it.each([
    { found: false, run: fresh("luckyCollar") },
    { found: true, run: grabGear(gameData, "luckyCollar", fresh(null)).run },
  ])("names the Lucky collar's extra hearts row, found: $found", ({ found, run }) => {
    const name = gearSourceName(gameData, {
      gear: "luckyCollar",
      ...(found ? { found: true as const } : {}),
    });
    const hearts = String(read(gameData.tuning, "hearts", "luckyCollarMax"));
    const owner = gameData.dogs.buddy.owner.name;
    expect(extraHearts(gameData, run, "buddy")).toEqual([
      fillNames(gameData.runText.explain.extraHearts, { hearts, name, owner }),
    ]);
  });
});

describe("walkStartMarks", () => {
  const ofSize = (size: Size) =>
    keysOf(gameData.dogs).filter((dog) => gameData.dogs[dog].size === size);
  const speed = (agility: "largeDogAgility" | "smallDogAgility") =>
    laneSpeedText(gameData.tuning, agility);
  // The strip line a walk's start says for dog: largeDog for a large dog, smallDog for a small
  // one and none for a medium one.
  const sizeLine = (dog: DogId): string[] => {
    const { name, size } = gameData.dogs[dog];
    const { largeDog, smallDog } = gameData.runText.strip;
    switch (size) {
      case "large":
        return [fillNames(largeDog, { dog: name, speed: speed("largeDogAgility") })];
      case "medium":
        return [];
      case "small":
        return [fillNames(smallDog, { dog: name, speed: speed("smallDogAgility") })];
      default:
        return size satisfies never;
    }
  };
  it.each([
    { large: 0, medium: 3, small: 0 },
    { large: 0, medium: 0, small: 3 },
    { large: 3, medium: 0, small: 0 },
    { large: 1, medium: 1, small: 1 },
    { large: 2, medium: 0, small: 1 },
  ])(
    "says a line for each of $small small and $large large dogs, in pack order, and none for " +
      "$medium medium dogs",
    ({ large, medium, small }) => {
      const dogs = [
        ...ofSize("small").slice(0, small),
        ...ofSize("medium").slice(0, medium),
        ...ofSize("large").slice(0, large),
      ] as [DogId, DogId, DogId];
      const run = newRun(gameData, 3, { dogs, gear: null, walker: "casey" });
      const { glints, lines } = walkStartMarks(gameData, run);
      expect(glints).toEqual([]);
      expect(lines).toEqual(
        packDogs(run)
          .flatMap(sizeLine)
          .map((text) => ({ icon: "hint", text })),
      );
    },
  );
});

describe("reachIcons", () => {
  const longReach = { kind: "perk", perk: "longReach" } as const;
  const big = { kind: "upgrade", upgrade: "bigTipper" } as const;
  it.each<{ icons: [number, string][]; name: string; reaches: ReachLine[] }>([
    { icons: [], name: "no reach", reaches: [] },
    {
      icons: [
        [1, effectIconKey(longReach)],
        [2, effectIconKey(longReach)],
      ],
      name: "a tip and a treat reached",
      reaches: [
        { dog: null, glint: longReach, item: 1 },
        { dog: "kilo", glint: longReach, item: 2 },
      ],
    },
    {
      icons: [[1, effectIconKey(longReach)]],
      name: "a pickup reached by two buffs",
      reaches: [
        { dog: null, glint: longReach, item: 1 },
        { dog: null, glint: big, item: 1 },
      ],
    },
  ])("gives $name its first reaching buff's icon", ({ icons, reaches }) => {
    expect([...reachIcons(reaches)]).toEqual(icons);
  });
});
