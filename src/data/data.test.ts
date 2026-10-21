import { describe, expect, it } from "vitest";

import manifestJson from "../../public/art/manifest.json";
import { parseManifest } from "../assets/manifest";
import { badgeKey } from "../assets/spriteKeys";
import { maxHearts } from "../rules/dogs";
import { moneyCost } from "../rules/effects";
import { modifiedStat, modifiersOf } from "../rules/modifiers";
import { unlockPrice } from "../rules/shop";
import { baseCardArtPrefix } from "../rules/skins";
import { probability, read, readTable } from "../rules/units";
import { walkerGoal } from "../rules/walkers";
import { testState } from "../testing/runState";
import { gameData } from ".";
import { SCREEN_CONFIG } from "./screen";
import type {
  CardOption,
  DogId,
  Effect,
  Encounter,
  EncounterId,
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

  it("gives every dog the quirk the rulebook names, each once", () => {
    expect(Object.fromEntries(Object.entries(dogs).map(([id, dog]) => [id, dog.quirk]))).toEqual({
      archie: "acrobatic",
      biscuit: "scentHound",
      duchess: "pampered",
      koda: "sledDog",
      nugget: "cameraReady",
      penny: "nervous",
      pierre: "showDog",
      snowball: "crowdPleaser",
      zippy: "ratter",
    });
  });

  it("marks the puddle, trash day and picnic raid messy, and only them", () => {
    const messy = Object.entries(encounters).flatMap(([id, encounter]) =>
      encounter.messy === true ? [id] : [],
    );
    expect(messy.sort()).toEqual(["picnic", "puddle", "trash"]);
  });

  it("marks the stranger as the only stranger spot and the playmate as the only other dog", () => {
    const marked = (key: "otherDog" | "stranger") =>
      Object.entries(gameData.needSpots).flatMap(([id, spot]) => (spot[key] === true ? [id] : []));
    expect(marked("stranger")).toEqual(["stranger"]);
    expect(marked("otherDog")).toEqual(["playmate"]);
  });

  it("names and describes every quirk", () => {
    for (const { description, name } of Object.values(gameData.quirks)) {
      expect(name).not.toBe("");
      expect(description).not.toBe("");
    }
  });

  it("costs a nervous owner a heart when the Other dog sniffs, and gives others one", () => {
    const { resolution } = encounters.otherDog;
    const sniff = resolution.kind === "card" ? resolution.options[0].effects[0] : undefined;
    expect(sniff).toMatchObject({ amount: 1, kind: "hearts", quirkAmounts: { nervous: -1 } });
  });

  it("starts with at least one dog, and sells every other dog", () => {
    const starters = dogList.filter((dog) => dog.unlock === "start");
    expect(starters.length).toBeGreaterThan(0);
    expect(
      dogList.filter((dog) => dog.unlock !== "start").every((dog) => dog.unlock === "shop"),
    ).toBe(true);
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

  it("has every area effect catch at least one size, each once", () => {
    const catches = Object.values(encounters).flatMap(({ affects }) =>
      affects.kind === "caught" ? [affects.catches] : [],
    );
    expect(catches.length).toBeGreaterThan(0);
    for (const sizes of catches) {
      expect(sizes.length).toBeGreaterThan(0);
      expect(new Set(sizes).size).toBe(sizes.length);
      expect(sizes.every((size) => SIZES.includes(size))).toBe(true);
    }
  });
});

describe("money", () => {
  it("has a tip spawns factor for every pack size, never rising with a bigger pack", () => {
    const sizes = Array.from(
      { length: tuning.counts.packSizeMax - tuning.counts.packSizeMin + 1 },
      (_, i) => tuning.counts.packSizeMin + i,
    );
    const factors = sizes.map((size) =>
      readTable(
        tuning,
        "multipliers",
        "tipSpawnsByPackSize",
        size as keyof typeof tuning.multipliers.tipSpawnsByPackSize,
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
  it("gives every option on a card a distinct name", () => {
    for (const card of cards) {
      const names = card.options.map((option) => option.name);
      expect(new Set(names).size, card.name).toBe(names.length);
    }
  });

  it("has 10 obstacle encounters and 4 lucky ones", () => {
    const kinds = Object.values(encounters).map((encounter) => encounter.kind);
    expect(countBy(kinds, "obstacle")).toBe(10);
    expect(countBy(kinds, "lucky")).toBe(4);
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

  it("has a forced stop for every zone of a walk, with none repeated", () => {
    expect(Object.keys(forcedStops).length).toBeGreaterThanOrEqual(world.walkLength);
  });

  it("has enough upgrades for every pick when picked cards leave the pool", () => {
    const picks = world.walkLength - 1;
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

describe("obstacle skins", () => {
  const zoneIds = world.zones.map(({ id }) => id);
  const minorObstacles = Object.entries(gameData.minorObstacles);
  const skinned = [...Object.entries(encounters), ...minorObstacles].flatMap(([id, { skins }]) =>
    Object.entries(skins ?? {}).map(([zone, skin]) => ({ id, skin, zone })),
  );

  it("keys every skin by a zone's id, with a name and a kebab-case art key", () => {
    expect(skinned.filter(({ zone }) => !zoneIds.includes(zone))).toEqual([]);
    for (const { id, skin } of skinned) {
      expect(skin?.name, id).not.toBe("");
      expect(skin?.art, id).toMatch(KEBAB_CASE);
      expect(skin?.cardArtPrefix ?? "card-x", id).toMatch(/^card-[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(skin?.cloudArt ?? "x", id).toMatch(KEBAB_CASE);
      expect(skin?.statusArt ?? "fx-status-x", id).toMatch(/^fx-status-[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it("names a cloud only on a Stink skin, and a status overlay only where a status starts", () => {
    const misplaced = skinned.flatMap(({ id, skin }) => [
      ...(skin?.cloudArt === undefined || id === "skunk" ? [] : [`${id}: cloudArt`]),
      ...(skin?.statusArt === undefined || ["puddle", "skunk", "thief"].includes(id)
        ? []
        : [`${id}: statusArt`]),
    ]);
    expect(misplaced).toEqual([]);
  });

  it("skins only the five obstacle kinds and the minor obstacles but the barrier", () => {
    const kinds = [...Object.entries(encounters), ...minorObstacles].flatMap(([id, { skins }]) =>
      skins === undefined ? [] : [id],
    );
    const allowed = [
      ...["bench", "bin", "cone", "hedge", "parkedCar"],
      ...["otherDog", "puddle", "skunk", "squirrel", "thief"],
    ];
    expect(kinds.filter((id) => !allowed.includes(id))).toEqual([]);
  });

  it("gives the minor obstacles of one shape one skin in each zone", () => {
    for (const zone of zoneIds) {
      const byShape = new Map<string, unknown>();
      for (const [id, { shape, skins }] of minorObstacles) {
        const skin = skins?.[zone];
        const key = `${shape.lanes}x${shape.rows}`;
        if (skin !== undefined) {
          expect(skin, `${id} in ${zone}`).toEqual(byShape.get(key) ?? skin);
          byShape.set(key, skin);
        }
      }
    }
  });

  it("names every card encounter's illustrations card-<kebab id>-<option>, for a skin's prefix", () => {
    const misnamed = (Object.entries(encounters) as [EncounterId, Encounter][]).flatMap(
      ([id, { resolution }]) =>
        resolution.kind === "card"
          ? resolution.options
              .map(({ art }) => art)
              .filter((art) => !art.startsWith(`${baseCardArtPrefix(id)}-`))
          : [],
    );
    expect(misnamed).toEqual([]);
  });
});

describe("run, world and walkers", () => {
  it("has 6 zones with palette road colours", () => {
    expect(world.zones).toHaveLength(6);
    for (const zone of world.zones) {
      expect(zone.roadColor).toMatch(/^#[0-9a-f]{6}$/);
      expect(zone.leashColor).toMatch(/^#[0-9a-f]{6}$/);
      expect(zone.roadShadowColor).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("walks 4 zones, starting on the street zone, with three unwalked zones left at every fork", () => {
    expect(world.walkLength).toBe(4);
    expect(world.firstZone).toBe("street");
    expect(world.zones.map(({ id }) => id)).toContain(world.firstZone);
    expect(world.zones.length - (world.walkLength - 1)).toBeGreaterThanOrEqual(3);
  });

  it("lists the zones from easiest to hardest, each with a difficulty in words", () => {
    const ranks = world.zones.map(({ difficulty }) => difficulty);
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks);
    for (const zone of world.zones) {
      expect(zone.difficultyName, zone.name).not.toBe("");
    }
  });

  it("gives every zone positive multipliers, a mover share from 0 to 1 and a kind to draw", () => {
    for (const zone of world.zones) {
      const { density, fees, moverShare, speed, weights } = zone;
      for (const value of [fees, speed, density.luckyFinds, density.obstacles, density.tips]) {
        expect(value, zone.name).toBeGreaterThan(0);
      }
      expect(moverShare, zone.name).toBeGreaterThanOrEqual(0);
      expect(moverShare, zone.name).toBeLessThanOrEqual(1);
      for (const group of Object.values(weights) as Readonly<Record<string, number>>[]) {
        const values = Object.values(group);
        expect(
          values.every((weight) => weight >= 0),
          zone.name,
        ).toBe(true);
        expect(
          values.some((weight) => weight > 0),
          zone.name,
        ).toBe(true);
      }
    }
  });

  it("weighs every obstacle and lucky find in every zone, each of its own kind", () => {
    for (const { name, weights } of world.zones) {
      for (const id of Object.keys(weights.obstacles)) {
        expect(encounters[id as EncounterId].kind, name).toBe("obstacle");
      }
      for (const id of Object.keys(weights.luckyFinds)) {
        expect(encounters[id as EncounterId].kind, name).toBe("lucky");
      }
      const kinds = [...Object.keys(weights.obstacles), ...Object.keys(weights.luckyFinds)];
      expect(kinds.sort(), name).toEqual(Object.keys(encounters).sort());
    }
  });

  it("draws each zone encounter only in its zones", () => {
    const zonesOf = (id: EncounterId) =>
      world.zones
        .filter(({ weights }) => ({ ...weights.obstacles, ...weights.luckyFinds })[id] > 0)
        .map(({ id }) => id);
    expect(zonesOf("cafe")).toEqual(["shops"]);
    expect(zonesOf("goose")).toEqual(["pawsPromenade", "homeStretch"]);
    expect(zonesOf("lemonade")).toEqual(["snoozeCrescent", "street"]);
    expect(zonesOf("petunias")).toEqual(["snoozeCrescent", "street"]);
    expect(zonesOf("picnic")).toEqual(["park", "pawsPromenade"]);
    expect(zonesOf("trash")).toEqual(["street", "homeStretch"]);
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

  it("has 4 walkers with their own sprites and portraits, one for each pace and style", () => {
    const list = Object.values(walkers);
    expect(list).toHaveLength(4);
    expect(new Set(list.map((walker) => walker.spriteKey)).size).toBe(list.length);
    expect(new Set(list.map((walker) => walker.portraitKey)).size).toBe(list.length);
    expect(new Set(list.map(({ pace, style }) => `${pace} ${style}`)).size).toBe(list.length);
  });

  it("starts with the default walker alone, and unlocks the others at zones of the walk, one each", () => {
    const goals = Object.values(walkers).map(walkerGoal);
    expect(walkers[defaultWalker].unlock).toBe("start");
    expect(goals.filter((goal) => goal === 0)).toHaveLength(1);
    expect(new Set(goals).size).toBe(goals.length);
    expect(goals.every((goal) => goal <= world.walkLength)).toBe(true);
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
      "accident",
      "areaEffect",
      "card",
      "debuff",
      "debuff",
      "debuff",
      "debuff",
      "drag",
      "encounter",
      "encounter",
      "encounter",
      "firedOwner",
      "forcedStop",
      "fork",
      "homeButton",
      "luckyFind",
      "minorBump",
      "needSpot",
      "needUrgent",
      "pull",
      "strip",
      "tip",
      "treat",
      "upgrade",
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
      penny: "friendly",
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

describe("the art manifest", () => {
  const sprites = new Set(parseManifest(manifestJson).sprites.map(({ key }) => key));

  it.each([
    [
      "every walker's sprite and portrait",
      Object.values(walkers).flatMap((walker) => [walker.spriteKey, walker.portraitKey]),
    ],
    ["every badge's art", gameData.achievements.map(({ id }) => badgeKey(id))],
  ])("has %s", (_, keys) => {
    expect(keys.filter((key) => !sprites.has(key))).toEqual([]);
  });
});
