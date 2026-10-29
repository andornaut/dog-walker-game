import { fillNames } from "@andornaut/game-kit/lines";
import { seededRandom } from "@andornaut/game-kit/random";
import { keysOf } from "@andornaut/game-kit/records";
import { describe, expect, it } from "vitest";

import { DEBUFFS } from "../data/debuffs";
import { DOGS } from "../data/dogs";
import { ENCOUNTERS } from "../data/encounters";
import { HOME_TEXT } from "../data/homeText";
import { QUIPS } from "../data/quips";
import { RUN_TEXT } from "../data/runText";
import { SHOP_GEAR } from "../data/shop";
import type { CardSource, GearId } from "../data/types";
import { UPGRADES } from "../data/upgrades";
import { mapPack } from "../state/pack";
import { newRun, type RunState } from "../state/runState";
import { defined } from "../testing/defined";
import { heartsByDog } from "../testing/runState";
import { TEST_TUNING } from "../testing/tuning";
import { TEST_WALKER_DATA } from "../testing/walkers";
import { TEST_WORLD } from "../testing/world";
import { cents, clampHearts } from "../units";
import { gearSourceName } from "./causes";
import { cardFor } from "./choices";
import { ownerMaxHearts } from "./dogs";
import {
  drawGearDrops,
  foundGearSource,
  gearDropCount,
  gearDropWeights,
  gearInEffect,
  grabGear,
} from "./gearDrops";
import { price } from "./shop";
import { spareTreatRoom } from "./spareTreats";
import { read } from "./units";
import { packAgility } from "./walkers";

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

const GEAR = keysOf(SHOP_GEAR);
const [FIRST, SECOND] = GEAR as [GearId, GearId];
// The tuning with every walk position placing expected drops on average.
const withDrops = (expected: number) => ({
  ...TEST_TUNING,
  counts: {
    ...TEST_TUNING.counts,
    gearDropsPerZone: { 1: expected, 2: expected, 3: expected, 4: expected },
  },
});
const POSITIONS = Object.keys(TEST_TUNING.counts.gearDropsPerZone).map(Number);
const expectedAt = (position: number): number =>
  (TEST_TUNING.counts.gearDropsPerZone as Readonly<Record<number, number>>)[position] ?? 0;
// A position whose expected count has a fractional part and one whose count is whole: the count
// reads its position only through that number.
const COUNT_POSITIONS = [
  POSITIONS.find((position) => !Number.isInteger(expectedAt(position))),
  POSITIONS.find((position) => Number.isInteger(expectedAt(position))),
].flatMap((position) => (position === undefined ? [] : [position]));

// A walk with a medium and a large dog, so the Whistle's dodge has dogs to cover.
const walkWith = (gear: GearId | null, overrides: Partial<RunState> = {}): RunState => ({
  ...newRun(data, 2, { dogs: ["buddy", "reggie"], gear, walker: "casey" }),
  ...overrides,
});

describe("gear drop count", () => {
  // A roll under the fractional part adds one drop; one at or over it adds none.
  it.each(
    COUNT_POSITIONS.flatMap((position) => [
      { extra: 1, position, roll: 0 },
      { extra: 0, position, roll: 0.9999 },
    ]),
  )(
    "places the whole part at position $position, plus $extra on a roll of $roll",
    ({ extra, position, roll }) => {
      const expected = expectedAt(position);
      const whole = Math.floor(expected);
      const added = expected > whole ? extra : 0;
      expect(gearDropCount(TEST_TUNING, () => roll, position - 1)).toBe(whole + added);
    },
  );

  it.each([{ expected: 0 }, { expected: 1 }])(
    "draws nothing for a whole count of $expected",
    ({ expected }) => {
      let draws = 0;
      const random = () => {
        draws += 1;
        return 0;
      };
      expect(gearDropCount(withDrops(expected), random, 0)).toBe(expected);
      expect(draws).toBe(0);
    },
  );

  it.each(COUNT_POSITIONS)("averages the expected count at position %i", (position) => {
    const random = seededRandom(position);
    const runs = 20000;
    let total = 0;
    for (let i = 0; i < runs; i++) {
      total += gearDropCount(TEST_TUNING, random, position - 1);
    }
    expect(total / runs).toBeCloseTo(expectedAt(position), 1);
  });
});

describe("gear drop pick", () => {
  it("weights every item by 1 over its price, so a cheaper one drops more often", () => {
    const weights = gearDropWeights(data, []);
    expect(weights.map(([gear]) => gear)).toEqual(GEAR);
    for (const [gear, weight] of weights) {
      expect(weight * price(TEST_TUNING, SHOP_GEAR[gear].price)).toBeCloseTo(1);
    }
  });

  it("draws each item about as often as its weight's share", () => {
    const weights = gearDropWeights(data, []);
    const total = weights.reduce((sum, [, weight]) => sum + weight, 0);
    const random = seededRandom(7);
    const counts = new Map<GearId, number>();
    const runs = 20000;
    const run = walkWith(null, { zoneIndex: 3 });
    for (let i = 0; i < runs; i++) {
      for (const gear of drawGearDrops({ ...data, tuning: withDrops(1) }, random, run)) {
        counts.set(gear, (counts.get(gear) ?? 0) + 1);
      }
    }
    for (const [gear, weight] of weights) {
      expect((counts.get(gear) ?? 0) / runs).toBeCloseTo(weight / total, 1);
    }
  });

  // The Pocket's item and the found one are never drawn, nor an item drawn earlier in the same
  // neighbourhood; asked for more drops than items are left, fewer drop.
  it.each([
    { found: null, pocket: null },
    { found: null, pocket: FIRST },
    { found: SECOND, pocket: null },
    { found: SECOND, pocket: FIRST },
  ] as const)("excludes the Pocket's $pocket and the found $found", ({ found, pocket }) => {
    const run = walkWith(pocket, { foundGear: found });
    const left = GEAR.filter((gear) => gear !== found && gear !== pocket);
    for (const count of [2, left.length + 1]) {
      for (let seed = 0; seed < 50; seed++) {
        const tuned = { ...data, tuning: withDrops(count) };
        const drops = drawGearDrops(tuned, seededRandom(seed), run);
        expect(drops).toHaveLength(Math.min(count, left.length));
        expect(new Set(drops).size).toBe(drops.length);
        expect(drops.every((gear) => left.includes(gear))).toBe(true);
      }
    }
  });

  it.each(POSITIONS.slice(0, 1))(
    "draws the same drops from the same seed at position %i",
    (position) => {
      const run = walkWith(null, { zoneIndex: position - 1 });
      const draws = [1, 2].map(() => drawGearDrops(data, seededRandom(position * 31), run));
      expect(draws[0]).toEqual(draws[1]);
    },
  );
});

describe("grabbing a gear drop", () => {
  it.each(GEAR)("puts %s in effect until the walk ends, named as found", (gear) => {
    const run = walkWith(null, { zoneDistance: read(TEST_TUNING, "pixels", "roadScrollSpeed") });
    const grab = grabGear(data, gear, run);
    expect(grab.replaced).toBeNull();
    expect(grab.run.foundGear).toBe(gear);
    expect(gearInEffect(grab.run)).toEqual([gear]);
    const sources = [
      ...grab.run.modifiers.map(({ source }) => source),
      ...grab.run.dodges.map(({ source }) => source),
      ...(grab.run.skipPass === null ? [] : [grab.run.skipPass]),
    ].filter(({ kind }) => kind === "gear");
    expect(sources).toEqual([foundGearSource(gear)]);
    expect(grab.run.modifiers.every(({ untilZone }) => untilZone === undefined)).toBe(true);
    expect(gearSourceName(data, foundGearSource(gear))).toBe(
      fillNames(RUN_TEXT.foundGear, { gear: SHOP_GEAR[gear].name }),
    );
  });

  it("keeps the Pocket's gear in effect beside the found item", () => {
    const grabbed = grabGear(data, SECOND, walkWith(FIRST)).run;
    expect(gearInEffect(grabbed)).toEqual([FIRST, SECOND]);
  });

  // A swap ends the item found before and starts the new one: the walk is as if only the new
  // one had been found. Each item is replaced by the next in turn, so each is found first once
  // and found next once.
  const SWAPS = GEAR.map((first, i) => [first, defined(GEAR[(i + 1) % GEAR.length])] as const);
  it.each(SWAPS)("replaces a found %s with %s", (first, next) => {
    const run = walkWith(null, { cardsThisZone: 1, zoneIndex: 1 });
    const swap = grabGear(data, next, grabGear(data, first, run).run);
    expect(swap.replaced).toBe(first);
    expect(swap.run).toEqual(grabGear(data, next, run).run);
  });

  it("raises each owner's max with Lucky collar, not their hearts", () => {
    const run = walkWith(null);
    const grabbed = grabGear(data, "luckyCollar", run).run;
    for (const dog of ["buddy", "reggie"] as const) {
      expect(ownerMaxHearts(data, grabbed, dog)).toBe(
        ownerMaxHearts(data, run, dog) + read(TEST_TUNING, "hearts", "luckyCollarMax"),
      );
    }
    expect(grabbed.pack).toEqual(run.pack);
  });

  it("lowers each owner's max when a found Lucky collar goes back, and hearts above it to it", () => {
    const run = walkWith(null);
    const collared = grabGear(data, "luckyCollar", run).run;
    const full: RunState = {
      ...collared,
      pack: mapPack(
        (slot) =>
          slot.status === "walking"
            ? { ...slot, hearts: clampHearts(Infinity, ownerMaxHearts(data, collared, slot.dog)) }
            : slot,
        collared.pack,
      ),
    };
    const other = GEAR.find((gear) => gear !== "luckyCollar") ?? FIRST;
    const swapped = grabGear(data, other, full).run;
    for (const dog of ["buddy", "reggie"] as const) {
      expect(ownerMaxHearts(data, swapped, dog)).toBe(ownerMaxHearts(data, run, dog));
    }
    expect(heartsByDog(swapped)).toEqual(heartsByDog(run));
  });

  // A card mid-walk, in a zone after the first, with cash for every option.
  const skunk: CardSource = { affected: ["buddy"], encounter: "skunk", kind: "encounter" };
  const midWalk = walkWith(null, { cardsThisZone: 1, money: cents(100000), zoneIndex: 2 });
  const whistle = SHOP_GEAR.whistle.effects[0];
  // What each item changes, read where it acts, and what it reads once the item is found, from
  // what it read before.
  const ACTS: readonly {
    readonly act: (run: RunState) => unknown;
    readonly found: (before: unknown) => unknown;
    readonly gear: GearId;
  }[] = [
    {
      act: (run) => spareTreatRoom(data, run),
      found: (before) => (before as number) + read(TEST_TUNING, "counts", "fannyPackTreats"),
      gear: "fannyPack",
    },
    { act: (run) => cardFor(data, run, skunk).skip, found: () => true, gear: "hallPass" },
    {
      act: (run) => ownerMaxHearts(data, run, "buddy"),
      found: (before) => (before as number) + read(TEST_TUNING, "hearts", "luckyCollarMax"),
      gear: "luckyCollar",
    },
    {
      act: (run) => packAgility(data, run),
      found: (before) =>
        expect.closeTo(
          (before as number) + read(TEST_TUNING, "multipliers", "runningShoesAgility"),
        ),
      gear: "runningShoes",
    },
    {
      act: (run) => run.dodges.map(({ chance, sizes }) => ({ chance, sizes })),
      found: () => [{ chance: whistle.chance, sizes: whistle.sizes }],
      gear: "whistle",
    },
  ];
  it.each(ACTS)(
    "acts at once with a $gear found mid-walk, and stops once it goes back",
    ({ act, found, gear }) => {
      const before = act(midWalk);
      const grabbed = grabGear(data, gear, midWalk).run;
      expect(act(grabbed)).toEqual(found(before));
      for (const other of GEAR.filter((each) => each !== gear)) {
        const back = grabGear(data, other, grabbed).run;
        expect(act(back), other).toEqual(act(grabGear(data, other, midWalk).run));
      }
    },
  );
});
