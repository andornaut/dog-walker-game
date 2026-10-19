import { describe, expect, it } from "vitest";

import { maxHearts } from "../rules/dogs";
import { moneyCost } from "../rules/effects";
import { modifiedStat, modifiersOf } from "../rules/modifiers";
import { probability, read, readTable } from "../rules/units";
import { testState } from "../testing/runState";
import { gameData } from ".";
import { SCREEN_CONFIG } from "./screen";
import type { CardOption, DogId, Energy, Modifier, Size, Temperament, TraitId } from "./types";

// Invariants the rulebook states about the content and numbers, checked on the real data.
const { dogs, encounters, forcedStops, help, quips, shopGear, tuning, upgrades, walkers, world } =
  gameData;
const dogList = Object.values(dogs);
const SIZES: readonly Size[] = ["small", "medium", "big"];
const TRAITS: readonly TraitId[] = ["chaser", "fancy", "foodDriven"];
const ENERGIES: readonly Energy[] = ["calm", "steady", "hyper"];
const TEMPERAMENTS: readonly Temperament[] = ["dramatic", "fussy", "laidBack"];

const countBy = <T>(items: readonly T[], value: T) => items.filter((item) => item === value).length;

describe("roster", () => {
  it("has 9 dogs, each size and trait pair once", () => {
    expect(dogList).toHaveLength(9);
    const pairs = dogList.map((dog) => `${dog.size}/${dog.trait}`);
    expect(new Set(pairs).size).toBe(SIZES.length * TRAITS.length);
  });

  it("has each energy and each temperament three times", () => {
    for (const energy of ENERGIES) {
      expect(
        countBy(
          dogList.map((dog) => dog.energy),
          energy,
        ),
      ).toBe(3);
    }
    for (const temperament of TEMPERAMENTS) {
      expect(
        countBy(
          dogList.map((dog) => dog.owner.temperament),
          temperament,
        ),
      ).toBe(3);
    }
  });

  it("starts with 3 dogs covering every size and trait, with laid-back owners", () => {
    const starters = dogList.filter((dog) => dog.unlock === "start");
    expect(starters).toHaveLength(3);
    expect(new Set(starters.map((dog) => dog.size)).size).toBe(SIZES.length);
    expect(new Set(starters.map((dog) => dog.trait)).size).toBe(TRAITS.length);
    expect(starters.every((dog) => dog.owner.temperament === "laidBack")).toBe(true);
  });

  it("gives every dog and owner a distinct name", () => {
    expect(new Set(dogList.map((dog) => dog.name)).size).toBe(dogList.length);
    expect(new Set(dogList.map((dog) => dog.owner.name)).size).toBe(dogList.length);
  });
});

describe("hearts", () => {
  const gearModifierSets: readonly (readonly Modifier[])[] = [
    [],
    ...Object.values(shopGear).map((gear) => modifiersOf(gear.effects)),
  ];

  it("starts every owner above 0 and at most their dog's max, with or without any gear", () => {
    for (const modifiers of gearModifierSets) {
      for (const dog of dogList) {
        const base = readTable(tuning, "hearts", "startByTemperament", dog.owner.temperament);
        const start = modifiedStat(tuning, modifiers, "startHearts", base);
        expect(start).toBeGreaterThan(0);
        expect(start).toBeLessThanOrEqual(maxHearts(tuning, modifiers, dog));
      }
    }
  });

  it("raises the max with size: small, then medium, then big", () => {
    const max = SIZES.map((size) => readTable(tuning, "hearts", "maxBySize", size));
    expect([...max].sort((a, b) => a - b)).toEqual(max);
    expect(new Set(max).size).toBe(SIZES.length);
  });

  it("counts a dramatic owner's changes more than other owners'", () => {
    const dramatic = readTable(tuning, "multipliers", "heartsByTemperament", "dramatic");
    expect(dramatic).toBeGreaterThan(
      readTable(tuning, "multipliers", "heartsByTemperament", "fussy"),
    );
    expect(dramatic).toBeGreaterThan(
      readTable(tuning, "multipliers", "heartsByTemperament", "laidBack"),
    );
  });
});

describe("size and energy", () => {
  it("locks input longest after a big dog's pull and not at all after a small dog's", () => {
    const locks = SIZES.map((size) => readTable(tuning, "seconds", "inputLockBySize", size));
    expect(locks[0]).toBe(0);
    expect([...locks].sort((a, b) => a - b)).toEqual(locks);
  });

  it("pulls most often for hyper dogs and least for calm ones", () => {
    const intervals = ENERGIES.map((energy) =>
      readTable(tuning, "seconds", "pullIntervalByEnergy", energy),
    );
    expect([...intervals].sort((a, b) => b - a)).toEqual(intervals);
  });

  it("keeps every catch chance a probability, with small dogs rolling half as often", () => {
    for (const size of SIZES) {
      expect(() => probability(tuning.probability.catchBySize[size])).not.toThrow();
    }
    expect(tuning.probability.catchBySize.small).toBe(tuning.probability.catchBySize.medium / 2);
  });
});

describe("money", () => {
  it("has a tip factor for every pack size, never rising with a bigger pack", () => {
    const sizes = Array.from(
      { length: tuning.counts.packSizeMax - tuning.counts.packSizeMin + 1 },
      (_, i) => tuning.counts.packSizeMin + i,
    );
    const factors = sizes.map((size) =>
      readTable(
        tuning,
        "multipliers",
        "tipByPackSize",
        size as keyof typeof tuning.multipliers.tipByPackSize,
      ),
    );
    expect([...factors].sort((a, b) => b - a)).toEqual(factors);
  });

  it("names only positive amounts in money effects; the effect says gain or lose", () => {
    const cards = [...Object.values(encounters), ...Object.values(forcedStops)];
    const amounts = cards.flatMap((card) =>
      card.options.flatMap((option) =>
        option.effects.flatMap((effect) => (effect.kind === "money" ? [effect.amount] : [])),
      ),
    );
    for (const amount of amounts) {
      expect(read(tuning, "money", amount)).toBeGreaterThan(0);
    }
  });

  it("prices every gear item and locked dog above $0", () => {
    for (const gear of Object.values(shopGear)) {
      expect(tuning.money.prices[gear.price]).toBeGreaterThan(0);
    }
    expect(tuning.money.prices.lockedDog).toBeGreaterThan(0);
  });
});

describe("cards", () => {
  const pack = testState({ duchess: 5, koda: 5, pierre: 5 });
  const affected: readonly DogId[] = ["duchess", "koda", "pierre"];
  const freeOption = (options: readonly CardOption[]) =>
    options.some((option) => moneyCost(gameData, { affected }, pack, option.effects) === 0);

  it("keeps a free option on every encounter and forced stop", () => {
    for (const card of [...Object.values(encounters), ...Object.values(forcedStops)]) {
      expect(freeOption(card.options), card.name).toBe(true);
    }
  });

  it("gives every option on a card a distinct name", () => {
    for (const card of [...Object.values(encounters), ...Object.values(forcedStops)]) {
      const names = card.options.map((option) => option.name);
      expect(new Set(names).size, card.name).toBe(names.length);
    }
  });

  it("has 5 obstacle encounters and 3 lucky ones", () => {
    const kinds = Object.values(encounters).map((encounter) => encounter.kind);
    expect(countBy(kinds, "obstacle")).toBe(5);
    expect(countBy(kinds, "lucky")).toBe(3);
  });

  it("has a forced stop for every zone, with none repeated", () => {
    expect(Object.keys(forcedStops).length).toBeGreaterThanOrEqual(world.zones.length);
  });

  it("has enough upgrades for every pick when picked cards leave the pool", () => {
    const picks = world.zones.length - 1;
    const removedBeforeLastPick = picks - 1;
    expect(Object.keys(upgrades).length - removedBeforeLastPick).toBeGreaterThanOrEqual(
      tuning.counts.upgradeChoiceCount,
    );
  });

  it("has 9 upgrades, two of them trade-offs", () => {
    const kinds = Object.values(upgrades).map((upgrade) => upgrade.kind);
    expect(kinds).toHaveLength(9);
    expect(countBy(kinds, "tradeOff")).toBe(2);
  });
});

describe("run, world and walkers", () => {
  it("has 4 zones with palette road colours", () => {
    expect(world.zones).toHaveLength(4);
    for (const zone of world.zones) {
      expect(zone.roadColor).toMatch(/^#[0-9a-f]{6}$/);
      expect(zone.roadShadowColor).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("fits the largest pack in the dog column", () => {
    expect(tuning.counts.packSizeMin).toBeGreaterThanOrEqual(1);
    expect(tuning.counts.packSizeMax).toBe(SCREEN_CONFIG.dogSlotCount);
  });

  it("has 5 gear items", () => {
    expect(Object.keys(shopGear)).toHaveLength(5);
  });

  it("has 3 to 4 walkers with distinct sprites, at least one available from the start", () => {
    const list = Object.values(walkers);
    expect(list.length).toBeGreaterThanOrEqual(3);
    expect(list.length).toBeLessThanOrEqual(4);
    expect(new Set(list.map((walker) => walker.spriteKey)).size).toBe(list.length);
    expect(list.some((walker) => walker.unlock === "start")).toBe(true);
  });

  it("has a quip for every temperament and moment", () => {
    for (const temperament of TEMPERAMENTS) {
      for (const lines of Object.values(quips[temperament])) {
        expect(lines.length).toBeGreaterThan(0);
      }
    }
  });
});

describe("help", () => {
  it("gives every page a title, a body and its own illustration key in manifest form", () => {
    for (const page of help) {
      expect(page.title).not.toBe("");
      expect(page.body).not.toBe("");
      expect(page.art).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
    expect(new Set(help.map((page) => page.art)).size).toBe(help.length);
    expect(new Set(help.map((page) => page.title)).size).toBe(help.length);
  });
});
