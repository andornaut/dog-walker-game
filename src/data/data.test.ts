import { describe, expect, it } from "vitest";

import manifestJson from "../../public/art/manifest.json";
import { parseManifest } from "../assets/manifest";
import { badgeKey, kebabCase } from "../assets/spriteKeys";
import { maxHearts, startHearts } from "../rules/dogs";
import { modifiersOf } from "../rules/modifiers";
import { forkPaths } from "../rules/route";
import { unlockPrice } from "../rules/shop";
import { read, readTable } from "../rules/units";
import { walkerGoal } from "../rules/walkers";
import { PACK_PLACES } from "../testing/packPlaces";
import { gameData } from ".";
import { SCREEN_CONFIG } from "./screen";
import type {
  CardOption,
  DogId,
  Effect,
  Encounter,
  EncounterId,
  Modifier,
  QuipMoment,
  Size,
  ZoneId,
} from "./types";

// Invariants the rulebook states about the content and numbers, checked on the real data.
const {
  defaultWalker,
  dogSlots,
  dogs,
  encounters,
  help,
  hints,
  minorObstacles,
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

// Every card: the encounters that open one.
const cards: readonly { readonly name: string; readonly options: readonly CardOption[] }[] =
  Object.values(encounters).flatMap(({ name, resolution }) =>
    resolution.kind === "card" ? [{ name, options: resolution.options }] : [],
  );
const cardOptions = cards.flatMap((card) => card.options);
const instantEffects: readonly (readonly Effect[])[] = Object.values(encounters).flatMap(
  ({ resolution }) => (resolution.kind === "instant" ? [resolution.effects] : []),
);
const SIZES: readonly Size[] = ["small", "medium", "large"];

describe("roster", () => {
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

  it("starts every owner full and above 0 with any gear, and raises the max with size", () => {
    for (const set of gearModifierSets) {
      for (const place of PACK_PLACES) {
        for (const dog of dogList) {
          expect(startHearts(tuning, set, place, dog)).toBe(maxHearts(tuning, set, place, dog));
          expect(startHearts(tuning, set, place, dog)).toBeGreaterThan(0);
        }
      }
    }
    const max = SIZES.map((size) => readTable(tuning, "hearts", "maxBySize", size));
    expect([...max].sort((a, b) => a - b)).toEqual(max);
    expect(new Set(max).size).toBe(SIZES.length);
  });
});

describe("money", () => {
  it("pays a whole number of dollars a dog, and names only positive amounts in money effects", () => {
    expect(Number.isInteger(tuning.money.payPerDog)).toBe(true);
    expect(tuning.money.payPerDog).toBeGreaterThan(0);
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
  it("applies every lucky find at once, with only gains", () => {
    const instant = Object.entries(encounters).flatMap(([id, encounter]) =>
      encounter.resolution.kind === "instant" ? [id] : [],
    );
    const lucky = (Object.keys(encounters) as EncounterId[]).filter(
      (id) => encounters[id].kind === "lucky",
    );
    expect(instant.sort()).toEqual(lucky.sort());
    for (const effect of instantEffects.flat()) {
      expect(effect.kind === "money" ? effect.change : "gain").toBe("gain");
      expect(effect.kind === "hearts" ? effect.amount : 1).toBeGreaterThan(0);
    }
  });

  it("has enough upgrades for every pick when picked cards leave the pool", () => {
    const picks = world.walkLength - 1;
    const removedBeforeLastPick = picks - 1;
    const mostPaths = forkPaths(gameData, () => 0, [world.firstZone as ZoneId]).length;
    expect(Object.keys(upgrades).length - removedBeforeLastPick).toBeGreaterThanOrEqual(mostPaths);
  });

  it("gives every card's options distinct names, and every option, upgrade and popup its own art key", () => {
    for (const card of cards) {
      const names = card.options.map((option) => option.name);
      expect(new Set(names).size, card.name).toBe(names.length);
    }
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

describe("card illustrations", () => {
  it("names each encounter's option art card-<kebab id>-<option>", () => {
    const misnamed = (Object.entries(encounters) as [EncounterId, Encounter][]).flatMap(
      ([id, { resolution }]) =>
        resolution.kind === "card"
          ? resolution.options
              .map(({ art }) => art)
              .filter((art) => !art.startsWith(`card-${kebabCase(id)}-`))
          : [],
    );
    expect(misnamed, "card art not named card-<kebab id>-<option>").toEqual([]);
  });
});

describe("run, world and walkers", () => {
  it("gives every zone palette road colours, and leaves three unwalked zones at every fork", () => {
    expect(world.zones.length - (world.walkLength - 1)).toBeGreaterThanOrEqual(3);
    for (const zone of world.zones) {
      expect(zone.roadColour).toMatch(/^#[0-9a-f]{6}$/);
      expect(zone.leashColour).toMatch(/^#[0-9a-f]{6}$/);
      expect(zone.roadShadowColour).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("names only the world's zones on the pre-fork route", () => {
    const ids: readonly string[] = world.zones.map(({ id }) => id);
    expect(world.preForkRoute.filter((id) => !ids.includes(id))).toEqual([]);
  });

  // A dart's one outcome draw picks turning back, stopping or crossing, so its shares to turn
  // back and to stop add up to at most 1, and the lanes a stop is drawn from are a range.
  it("gives every dart shares to turn back and to stop adding up to at most 1, and its stop lanes a range", () => {
    for (const [kind, { movement }] of [
      ...Object.entries(encounters),
      ...Object.entries(minorObstacles),
    ]) {
      if (movement?.kind === "dart") {
        expect(movement.turnBackShare, kind).toBeGreaterThanOrEqual(0);
        expect(movement.stopShare, kind).toBeGreaterThanOrEqual(0);
        expect(movement.turnBackShare + movement.stopShare, kind).toBeLessThanOrEqual(1);
      }
    }
    expect(tuning.counts.dartStopLanesMin).toBeLessThanOrEqual(tuning.counts.dartStopLanesMax);
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
      const { density, moverShare, speed, weights } = zone;
      for (const value of [speed, density.luckyFinds, density.obstacles, density.tips]) {
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

  // Every obstacle kind that names its zones, with the weights table that draws it in each zone.
  const zoneKinds = [
    ...Object.entries(encounters).flatMap(([id, encounter]) =>
      encounter.kind === "obstacle" && "zones" in encounter && encounter.zones !== undefined
        ? [{ id, table: "obstacles" as const, zones: encounter.zones }]
        : [],
    ),
    ...Object.entries(minorObstacles).flatMap(([id, minor]) =>
      "zones" in minor ? [{ id, table: "minorObstacles" as const, zones: minor.zones }] : [],
    ),
  ];
  const zoneIds = world.zones.map(({ id }) => id);

  it("names the neighbourhoods of some obstacles, card or not, one or more each", () => {
    expect(zoneKinds.map(({ table }) => table)).toEqual(
      expect.arrayContaining(["minorObstacles", "obstacles"]),
    );
    expect(zoneKinds.some(({ zones }) => zones.length > 1)).toBe(true);
  });

  it.each(zoneKinds)("draws $id only in its own zones, $zones", ({ id, table, zones }) => {
    const weighted = world.zones.flatMap((each) =>
      ((each.weights[table] as Readonly<Record<string, number>>)[id] ?? 0) > 0 ? [each.id] : [],
    );
    expect(weighted).toEqual(zoneIds.filter((zone) => zones.includes(zone)));
    expect(zones.filter((zone) => !zoneIds.includes(zone))).toEqual([]);
  });

  it("fits the largest pack in the card row, one dog slot a place, the first free and the rest priced", () => {
    expect(tuning.counts.packSizeMax).toBe(SCREEN_CONFIG.dogSlotCount);
    expect(dogSlots).toHaveLength(tuning.counts.packSizeMax);
    const [first, ...rest] = dogSlots.map((slot) => unlockPrice(tuning, slot));
    expect(first).toBe(0);
    expect(dogSlots.slice(1).every((slot) => slot.unlock === "shop")).toBe(true);
    expect(rest.every((price) => price > 0)).toBe(true);
  });

  it("gives each walker its own sprite, portrait, agility, perk and unlock zone, the default walker free", () => {
    const list = Object.values(walkers);
    expect(new Set(list.map((walker) => walker.spriteKey)).size).toBe(list.length);
    expect(new Set(list.map((walker) => walker.portraitKey)).size).toBe(list.length);
    expect(new Set(list.map(({ agility }) => agility)).size).toBe(list.length);
    expect(new Set(list.map(({ perk }) => perk)).size).toBe(list.length);
    const goals = Object.values(walkers).map(walkerGoal);
    const zones = world.zones.map(({ id }) => id);
    expect(walkers[defaultWalker].unlock).toBe("start");
    expect(goals.filter((goal) => goal === null)).toHaveLength(1);
    expect(new Set(goals).size).toBe(goals.length);
    expect(goals.every((goal) => goal === null || zones.includes(goal))).toBe(true);
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

  it("has one hint per trigger, each one line", () => {
    const triggers = hintList.map(({ trigger }) => JSON.stringify(trigger));
    expect(new Set(triggers).size).toBe(hintList.length);
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

  it("gives every badge its own id and name, a goal and a one-line badge line", () => {
    expect(new Set(achievements.map(({ id }) => id)).size).toBe(achievements.length);
    expect(new Set(achievements.map(({ name }) => name)).size).toBe(achievements.length);
    for (const { badgeLine, goal, name } of achievements) {
      expect(goal.trim(), name).not.toBe("");
      expect(badgeLine.trim(), name).not.toBe("");
      expect(badgeLine, name).not.toContain("\n");
    }
  });

  it("keeps every numeric threshold a positive whole number", () => {
    const thresholds = achievements.flatMap(({ conditions }) =>
      conditions.flatMap((condition) =>
        "count" in condition
          ? [condition.count]
          : "dollars" in condition
            ? [condition.dollars]
            : "packSize" in condition
              ? [condition.packSize]
              : [],
      ),
    );
    for (const threshold of thresholds) {
      expect(threshold === "all" || (Number.isInteger(threshold) && threshold > 0)).toBe(true);
    }
  });
});

describe("the art manifest", () => {
  const sprites = new Set(parseManifest(manifestJson).sprites.map(({ key }) => key));

  it("has every walker's sprite and portrait and every badge's art", () => {
    const keys = [
      ...Object.values(walkers).flatMap((walker) => [walker.spriteKey, walker.portraitKey]),
      ...gameData.achievements.map(({ id }) => badgeKey(id)),
    ];
    expect(keys.filter((key) => !sprites.has(key))).toEqual([]);
  });
});
