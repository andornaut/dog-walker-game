import { describe, expect, it } from "vitest";

import manifestJson from "../../public/art/manifest.json";
import { parseManifest } from "../assets/manifest";
import { badgeKey } from "../assets/spriteKeys";
import { maxHearts } from "../rules/dogs";
import { moneyCost } from "../rules/effects";
import { modifiedStat, modifiersOf } from "../rules/modifiers";
import { unlockPrice } from "../rules/shop";
import { probability, read, readTable } from "../rules/units";
import { testState } from "../testing/runState";
import { gameData } from ".";
import { SCREEN_CONFIG } from "./screen";
import type {
  CardOption,
  DogId,
  Effect,
  Energy,
  Modifier,
  QuipMoment,
  Size,
  Temperament,
  TraitId,
} from "./types";

// Invariants the rulebook states about the content and numbers, checked on the real data.
const {
  defaultWalker,
  dogSlots,
  dogs,
  encounters,
  forcedStops,
  help,
  hints,
  quips,
  shopGear,
  tuning,
  upgrades,
  walkers,
  world,
} = gameData;
const dogList = Object.values(dogs);
const KEBAB_CASE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const QUIP_MOMENTS: readonly QuipMoment[] = ["fired", "happier", "parting", "upset"];

// Every card: the encounters that open one, then the forced stops.
const cards: readonly { readonly name: string; readonly options: readonly CardOption[] }[] = [
  ...Object.values(encounters).flatMap(({ name, resolution }) =>
    resolution.kind === "card" ? [{ name, options: resolution.options }] : [],
  ),
  ...Object.values(forcedStops),
];
const cardOptions = cards.flatMap((card) => card.options);
const instantEffects: readonly (readonly Effect[])[] = Object.values(encounters).flatMap(
  ({ resolution }) => (resolution.kind === "instant" ? [resolution.effects] : []),
);
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

  it("turns needs urgent soonest for hyper dogs and latest for calm ones", () => {
    const urgentAfter = ENERGIES.map((energy) =>
      readTable(tuning, "seconds", "needUrgentByEnergy", energy),
    );
    expect([...urgentAfter].sort((a, b) => b - a)).toEqual(urgentAfter);
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
    const amounts = [...cardOptions, ...instantEffects.map((effects) => ({ effects }))].flatMap(
      (option) =>
        option.effects.flatMap((effect) => (effect.kind === "money" ? [effect.amount] : [])),
    );
    for (const amount of amounts) {
      expect(read(tuning, "money", amount)).toBeGreaterThan(0);
    }
  });

  it("prices every gear item, locked dog and bought dog slot above $0", () => {
    for (const gear of Object.values(shopGear)) {
      expect(tuning.money.prices[gear.price]).toBeGreaterThan(0);
    }
    for (const item of [...dogList, ...dogSlots]) {
      if (item.unlock === "shop") {
        expect(tuning.money.prices[item.price]).toBeGreaterThan(0);
      }
    }
  });
});

describe("cards", () => {
  const pack = testState({ duchess: 5, koda: 5, pierre: 5 });
  const affected: readonly DogId[] = ["duchess", "koda", "pierre"];
  const freeOption = (options: readonly CardOption[]) =>
    options.some((option) => moneyCost(gameData, { affected }, pack, option.effects) === 0);

  it("keeps a free option on every card", () => {
    for (const card of cards) {
      expect(freeOption(card.options), card.name).toBe(true);
    }
  });

  it("gives every option on a card a distinct name", () => {
    for (const card of cards) {
      const names = card.options.map((option) => option.name);
      expect(new Set(names).size, card.name).toBe(names.length);
    }
  });

  it("has 5 obstacle encounters and 3 lucky ones", () => {
    const kinds = Object.values(encounters).map((encounter) => encounter.kind);
    expect(countBy(kinds, "obstacle")).toBe(5);
    expect(countBy(kinds, "lucky")).toBe(3);
  });

  it("applies the biscuit neighbour and photo op at once, with only gains", () => {
    const instant = Object.entries(encounters).flatMap(([id, encounter]) =>
      encounter.resolution.kind === "instant" ? [id] : [],
    );
    expect(instant.sort()).toEqual(["biscuitNeighbour", "photoOp"]);
    for (const effect of instantEffects.flat()) {
      expect(effect.kind === "money" ? effect.change : "gain").toBe("gain");
      expect(effect.kind === "hearts" ? effect.amount : 1).toBeGreaterThan(0);
    }
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

  it("gives every card option, upgrade and instant popup its own kebab-case art key", () => {
    const arts = [
      ...cardOptions.map((option) => option.art),
      ...Object.values(upgrades).map((upgrade) => upgrade.art),
      ...Object.values(encounters).flatMap(({ resolution }) =>
        resolution.kind === "instant" ? [resolution.art] : [],
      ),
    ];
    for (const art of arts) {
      expect(art).toMatch(KEBAB_CASE);
    }
    expect(new Set(arts).size).toBe(arts.length);
  });
});

describe("run, world and walkers", () => {
  it("has 4 zones with palette road colours", () => {
    expect(world.zones).toHaveLength(4);
    for (const zone of world.zones) {
      expect(zone.roadColor).toMatch(/^#[0-9a-f]{6}$/);
      expect(zone.leashColor).toMatch(/^#[0-9a-f]{6}$/);
      expect(zone.roadShadowColor).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("fits the largest pack in the doghouse row", () => {
    expect(tuning.counts.packSizeMin).toBeGreaterThanOrEqual(1);
    expect(tuning.counts.packSizeMax).toBe(SCREEN_CONFIG.dogSlotCount);
  });

  it("has one dog slot per pack place, the first free and the others dearer in turn", () => {
    expect(dogSlots).toHaveLength(tuning.counts.packSizeMax);
    const prices = dogSlots.map((slot) => unlockPrice(tuning, slot));
    expect(prices[0]).toBe(0);
    expect(dogSlots.slice(1).every((slot) => slot.unlock === "shop")).toBe(true);
    expect([...prices].sort((a, b) => a - b)).toEqual(prices);
    expect(new Set(prices).size).toBe(prices.length);
  });

  it("has 5 gear items", () => {
    expect(Object.keys(shopGear)).toHaveLength(5);
  });

  it("has 4 free walkers with their own sprites and portraits, the default among them", () => {
    const list = Object.values(walkers);
    expect(list).toHaveLength(4);
    expect(list.every((walker) => walker.unlock === "start")).toBe(true);
    expect(new Set(list.map((walker) => walker.spriteKey)).size).toBe(list.length);
    expect(new Set(list.map((walker) => walker.portraitKey)).size).toBe(list.length);
    expect(Object.keys(walkers)).toContain(defaultWalker);
  });

  it("finds every walker's sprite and portrait in the art manifest", () => {
    const manifest = parseManifest(manifestJson);
    const sprites = new Set(manifest.sprites.map(({ key }) => key));
    const missing = Object.values(walkers)
      .flatMap((walker) => [walker.spriteKey, walker.portraitKey])
      .filter((key) => !sprites.has(key));
    expect(missing).toEqual([]);
  });

  it("gives every owner two distinct lines for every moment", () => {
    for (const id of Object.keys(dogs) as DogId[]) {
      for (const moment of QUIP_MOMENTS) {
        const lines = quips[id][moment];
        expect(lines, `${id} ${moment}`).toHaveLength(2);
        expect(new Set(lines).size, `${id} ${moment}`).toBe(2);
        expect(lines.every((line) => line.trim() !== "")).toBe(true);
      }
    }
  });
});

describe("hints", () => {
  const hintList = Object.values(hints);

  it("has one hint per trigger the rulebook names, each one line", () => {
    const triggers = hintList.map(({ trigger }) => JSON.stringify(trigger));
    expect(new Set(triggers).size).toBe(hintList.length);
    expect(hintList.map(({ trigger }) => trigger.kind).sort()).toEqual([
      "card",
      "debuff",
      "drag",
      "encounter",
      "encounter",
      "encounter",
      "firedOwner",
      "forcedStop",
      "luckyFind",
      "minorBump",
      "pause",
      "pull",
      "tip",
      "treat",
    ]);
    for (const { text } of hintList) {
      expect(text).not.toBe("");
      expect(text).not.toContain("\n");
    }
  });
});

describe("help", () => {
  it("gives every page a title, a body and its own illustration key in manifest form", () => {
    for (const page of help) {
      expect(page.title).not.toBe("");
      expect(page.body).not.toBe("");
      expect(page.art).toMatch(KEBAB_CASE);
    }
    expect(new Set(help.map((page) => page.art)).size).toBe(help.length);
    expect(new Set(help.map((page) => page.title)).size).toBe(help.length);
  });
});

describe("achievements", () => {
  const { achievements } = gameData;

  it("has the rulebook's 15 badges, each with its own id and name", () => {
    expect(achievements).toHaveLength(15);
    expect(new Set(achievements.map(({ id }) => id)).size).toBe(15);
    expect(new Set(achievements.map(({ name }) => name)).size).toBe(15);
  });

  it("gives every badge a goal and a one-line badge line", () => {
    for (const { badgeLine, goal, name } of achievements) {
      expect(goal.trim(), name).not.toBe("");
      expect(badgeLine.trim(), name).not.toBe("");
      expect(badgeLine, name).not.toContain("\n");
    }
  });

  it("keeps every numeric threshold a positive whole number", () => {
    const thresholds = achievements.flatMap(({ conditions }) =>
      conditions.map((condition) => ("count" in condition ? condition.count : condition.dollars)),
    );
    for (const threshold of thresholds) {
      expect(threshold === "all" || (Number.isInteger(threshold) && threshold > 0)).toBe(true);
    }
  });

  it("finds every badge's art in the manifest", () => {
    const manifest = parseManifest(manifestJson);
    const sprites = new Set(manifest.sprites.map(({ key }) => key));
    const missing = achievements.map(({ id }) => badgeKey(id)).filter((key) => !sprites.has(key));
    expect(missing).toEqual([]);
  });
});

describe("needs", () => {
  const { needCards, needSpots, needs } = gameData;

  it("gives every dog the need the rulebook names", () => {
    expect(Object.fromEntries(Object.entries(dogs).map(([id, dog]) => [id, dog.need]))).toEqual({
      archie: "playful",
      biscuit: "regular",
      duchess: "friendly",
      koda: "nosy",
      nugget: "thirsty",
      penny: "thirsty",
      pierre: "nosy",
      snowball: "friendly",
      zippy: "playful",
    });
  });

  it("has a spot for every need, weighted above 0 in every zone", () => {
    for (const zone of world.zones) {
      const weighted = Object.entries(zone.weights.needSpots)
        .filter(([, weight]) => weight > 0)
        .map(([spot]) => needSpots[spot as keyof typeof needSpots].need);
      expect(new Set(weighted), zone.id).toEqual(new Set(Object.keys(needs)));
    }
  });

  it("pays off with a payoff card, and goes wrong with a trouble card or a loss", () => {
    for (const need of Object.values(needs)) {
      expect(needCards[need.payoff].kind).toBe("payoff");
      if (need.goneWrong.kind === "card") {
        expect(needCards[need.goneWrong.card].kind).toBe("trouble");
      }
    }
    expect(probability(tuning.probability.needPayoffCard)).toBeGreaterThan(0);
  });

  it("keeps a free option on every need card", () => {
    for (const card of Object.values(needCards)) {
      expect(
        card.options.some(
          (option) =>
            moneyCost(gameData, { affected: [] }, testState({ koda: 3 }), option.effects) === 0,
        ),
      ).toBe(true);
    }
  });
});
