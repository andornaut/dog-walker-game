import { keysOf } from "@andornaut/game-kit/records";
import { describe, expect, it } from "vitest";

import manifestJson from "../../public/art/manifest.json";
import { parseManifest } from "../assets/manifest";
import { badgeKey } from "../assets/spriteKeys";
import { forkPaths } from "../rules/route";
import { unlockPrice } from "../rules/shop";
import { read } from "../rules/units";
import { walkerGoal } from "../rules/walkers";
import { gameData } from ".";
import { LANE_COUNT, SCREEN_CONFIG } from "./screen";
import type { CardOption, Effect, EncounterId, ZoneId } from "./types";

// Invariants the rulebook states about the content and numbers, checked on the real data.
const {
  defaultWalker,
  dogSlots,
  dogs,
  encounters,
  minorObstacles,
  shopGear,
  tuning,
  upgrades,
  walkers,
  world,
} = gameData;
const dogList = Object.values(dogs);

// Every card: the encounters that open one.
const cards: readonly { readonly name: string; readonly options: readonly CardOption[] }[] =
  Object.values(encounters).flatMap(({ name, resolution }) =>
    resolution.kind === "card" ? [{ name, options: resolution.options }] : [],
  );
const cardOptions = cards.flatMap((card) => card.options);
const instantEffects: readonly (readonly Effect[])[] = Object.values(encounters).flatMap(
  ({ resolution }) => (resolution.kind === "instant" ? [resolution.effects] : []),
);

describe("roster", () => {
  it("starts with at least one dog, and sells every other dog", () => {
    const starters = dogList.filter((dog) => dog.unlock === "start");
    expect(starters.length).toBeGreaterThan(0);
    expect(
      dogList.filter((dog) => dog.unlock !== "start").every((dog) => dog.unlock === "shop"),
    ).toBe(true);
  });
});

describe("hearts", () => {
  it("keeps real owner heart limits positive whole numbers", () => {
    const limits = [tuning.hearts.maxOwnerHearts, ...Object.values(tuning.hearts.maxBySize)];
    expect(limits.every((limit) => Number.isInteger(limit) && limit > 0)).toBe(true);
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
    const lucky = keysOf(encounters).filter((id) => encounters[id].kind === "lucky");
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

  it("keeps saved option ids unique on each card", () => {
    for (const card of cards) {
      const ids = card.options.map((option) => option.id);
      expect(new Set(ids).size, card.name).toBe(ids.length);
    }
  });
});

describe("run, world and walkers", () => {
  it("leaves enough unwalked zones for three paths at every fork", () => {
    expect(world.zones.length - (world.walkLength - 1)).toBeGreaterThanOrEqual(3);
  });

  it("gives every walk position a gear drop count of 0 or more, and every gear item a road kind of its own", () => {
    const drops = tuning.counts.gearDropsPerZone as Readonly<Record<number, number>>;
    const positions = Array.from({ length: world.walkLength }, (_, i) => i + 1);
    expect(positions.map((position) => drops[position] ?? -1).every((n) => n >= 0)).toBe(true);
    const roadKinds = [...Object.keys(encounters), ...Object.keys(minorObstacles), "tip", "treat"];
    expect(Object.keys(shopGear).filter((gear) => roadKinds.includes(gear))).toEqual([]);
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

  it("gives distraction patterns valid probabilities adding up to 1", () => {
    const odds = Object.values(tuning.probability.distractionPatternOdds);
    expect(odds.every((chance) => chance >= 0 && chance <= 1)).toBe(true);
    expect(odds.reduce((sum, value) => sum + value, 0)).toBeCloseTo(1);
  });

  it("orders zones from easiest to hardest", () => {
    const ranks = world.zones.map(({ difficulty }) => difficulty);
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks);
  });

  it("gives every zone positive multipliers, a mover share from 0 to 1 and a kind to draw", () => {
    for (const zone of world.zones) {
      const { density, moverShare, speed, weights } = zone;
      for (const value of [speed, ...Object.values(density)]) {
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

  it("weighs every obstacle in every zone, and counts every lucky find per zone, 0 or more", () => {
    const lucky = Object.keys(encounters).filter(
      (id) => encounters[id as EncounterId].kind === "lucky",
    );
    for (const { name, weights } of world.zones) {
      for (const id of Object.keys(weights.obstacles)) {
        expect(encounters[id as EncounterId].kind, name).toBe("obstacle");
      }
      expect([...Object.keys(weights.obstacles), ...lucky].sort(), name).toEqual(
        Object.keys(encounters).sort(),
      );
    }
    const counts = tuning.counts.luckyFindsPerZone as Readonly<Record<string, number>>;
    expect(Object.keys(counts).sort()).toEqual(lucky.sort());
    expect(Object.values(counts).every((count) => count >= 0)).toBe(true);
  });

  // Every obstacle kind that names its zones, with the weights table that draws it in each zone. An
  // obstacle with skins names each zone a skin names.
  const zoneKinds = [
    ...Object.entries(encounters).flatMap(([id, encounter]) =>
      encounter.kind === "obstacle" && "zones" in encounter && encounter.zones !== undefined
        ? [{ id, table: "obstacles" as const, zones: encounter.zones }]
        : [],
    ),
    ...Object.entries(minorObstacles).flatMap(([id, minor]) => {
      if ("skins" in minor) {
        const named = new Set(Object.values(minor.skins).flatMap(({ zones }) => zones));
        const zones: readonly string[] = [...named];
        return [{ id, table: "minorObstacles" as const, zones }];
      }
      return "zones" in minor ? [{ id, table: "minorObstacles" as const, zones: minor.zones }] : [];
    }),
  ];
  const zoneIds = world.zones.map(({ id }) => id);

  it("draws each of those obstacles only in the world's zones it names", () => {
    const offenders = zoneKinds.flatMap(({ id, table, zones }) => {
      const weighted = world.zones.flatMap((each) =>
        ((each.weights[table] as Readonly<Record<string, number>>)[id] ?? 0) > 0 ? [each.id] : [],
      );
      const named = zoneIds.filter((zone) => zones.includes(zone));
      return weighted.join() === named.join() && named.length === zones.length
        ? []
        : [`${id}: names ${zones.join(", ")}, weighed in ${weighted.join(", ")}`];
    });
    expect(offenders).toEqual([]);
  });

  // So the neighbourhoods stay distinct, no mover or plain obstacle appears in more than 3, each
  // skin of one with skins counting as its own by the zones it names. One test lists every
  // obstacle or skin over the limit, with its zones.
  it("weighs every mover and plain obstacle above 0 in at most 3 zones, each skin on its own", () => {
    const over = Object.entries(minorObstacles).flatMap(([id, minor]) => {
      const looks =
        "skins" in minor
          ? Object.entries(minor.skins).map(([skin, { zones }]) => ({ id: skin, zones }))
          : [
              {
                id,
                zones: world.zones.flatMap((each) =>
                  ((each.weights.minorObstacles as Readonly<Record<string, number>>)[id] ?? 0) > 0
                    ? [each.id]
                    : [],
                ),
              },
            ];
      return looks.flatMap((look) =>
        look.zones.length > 3 ? [`${look.id}: ${look.zones.join(", ")}`] : [],
      );
    });
    expect(over).toEqual([]);
  });

  // Each active wide fixed kind has a narrower replacement and leaves the required lanes open.
  it.each(world.zones)(
    "gives wide fixed obstacles a narrower replacement in $name",
    ({ weights }) => {
      const weighed = weights.minorObstacles as Readonly<Record<string, number>>;
      const fixedWidths = new Set(
        Object.entries(minorObstacles).flatMap(([id, minor]) =>
          !("movement" in minor) && (weighed[id] ?? 0) > 0 ? [minor.shape.lanes] : [],
        ),
      );
      const widths = [...fixedWidths];
      const widest = Math.min(3, LANE_COUNT - read(tuning, "counts", "openLanesPerRowMin"));
      expect(
        widths.every((width) => Number.isInteger(width) && width >= 1 && width <= widest),
      ).toBe(true);
      expect(
        widths.filter((width) => width > 1).every((width) => widths.some((other) => other < width)),
      ).toBe(true);
    },
  );

  it("fits the largest pack in the card row, one dog slot a place, the first free and the rest priced", () => {
    expect(tuning.counts.packSizeMax).toBe(SCREEN_CONFIG.dogSlotCount);
    expect(dogSlots).toHaveLength(tuning.counts.packSizeMax);
    const [first, ...rest] = dogSlots.map((slot) => unlockPrice(tuning, slot));
    expect(first).toBe(0);
    expect(dogSlots.slice(1).every((slot) => slot.unlock === "shop")).toBe(true);
    expect(rest.every((price) => price > 0)).toBe(true);
  });

  it("starts with an unlocked walker and reachable unlock goals", () => {
    const goals = Object.values(walkers).map(walkerGoal);
    expect(walkers[defaultWalker].unlock).toBe("start");
    expect(goals.filter((goal) => goal === null)).toHaveLength(1);
    // A walk takes at most one dog per dog slot.
    expect(
      goals.every(
        (goal) => goal === null || (Number.isInteger(goal) && goal >= 1 && goal <= dogSlots.length),
      ),
    ).toBe(true);
  });
});

describe("achievements", () => {
  const { achievements } = gameData;

  it("keeps saved badge ids unique", () => {
    expect(new Set(achievements.map(({ id }) => id)).size).toBe(achievements.length);
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
