import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import type { DogId, WalkerId, ZoneId } from "../data/types";
import { newRun } from "../state/runState";
import { isLarge } from "./dogs";
import { read } from "./units";
import { newWalkers, packAgility, slowestPackAgility, walkerAgility } from "./walkers";

const WALKER_IDS = Object.keys(gameData.walkers) as WalkerId[];

describe("walkerAgility", () => {
  it("adds Running shoes' agility to a walker's", () => {
    const walker = WALKER_IDS[0] as WalkerId;
    const shoes = gameData.shopGear.runningShoes.effects.flatMap((effect) =>
      effect.kind === "modifier" ? [effect] : [],
    );
    const plain = gameData.walkers[walker].agility;
    expect(walkerAgility(gameData, [], walker)).toBe(plain);
    expect(walkerAgility(gameData, shoes, walker)).toBeCloseTo(
      plain + read(gameData.tuning, "multipliers", "runningShoesAgility"),
    );
  });
});

describe("packAgility", () => {
  const dogIds = Object.keys(gameData.dogs) as DogId[];
  const large = dogIds.filter((dog) => isLarge(gameData.dogs[dog]));
  const smaller = dogIds.filter((dog) => !isLarge(gameData.dogs[dog]));
  const perLarge = read(gameData.tuning, "multipliers", "largeDogAgility");
  // A pack of three with count large dogs in it.
  const packWith = (count: number) =>
    [...large.slice(0, count), ...smaller.slice(0, 3 - count)] as [DogId, DogId, DogId];

  const minPack = read(gameData.tuning, "multipliers", "minPackAgility");
  const packs = WALKER_IDS.flatMap((walker) =>
    [0, 1, 2, 3].map((count) => ({
      count,
      run: newRun(gameData, 3, { dogs: packWith(count), gear: null, walker }),
      walker,
    })),
  );

  it.each(packs)(
    "slows $walker by largeDogAgility for each of $count large dogs, never below minPackAgility",
    ({ count, run, walker }) => {
      const own = walkerAgility(gameData, run.modifiers, walker);
      const floor = Math.min(own, minPack);
      expect(packAgility(gameData, run)).toBeCloseTo(Math.max(floor, own + count * perLarge));
    },
  );

  it("never goes below slowestPackAgility, which the slowest pack reaches", () => {
    const agilities = packs.map(({ run }) => packAgility(gameData, run));
    for (const agility of agilities) {
      expect(agility).toBeGreaterThanOrEqual(slowestPackAgility(gameData) - 1e-9);
    }
    expect(Math.min(...agilities)).toBeCloseTo(slowestPackAgility(gameData));
  });

  it("slows a walker above the slowest by each large dog", () => {
    const fastest = WALKER_IDS.reduce((a, b) =>
      gameData.walkers[a].agility >= gameData.walkers[b].agility ? a : b,
    );
    const run = newRun(gameData, 3, { dogs: packWith(1), gear: null, walker: fastest });
    expect(packAgility(gameData, run)).toBeLessThan(gameData.walkers[fastest].agility);
  });
});

describe("newWalkers", () => {
  const ZONES = gameData.world.zones.map(({ id }) => id as ZoneId);

  it("unlocks each walker not owned yet for finishing its zone, in data order", () => {
    const ada = gameData.walkers.ada;
    expect(newWalkers(gameData, [], [])).toEqual(["casey"]);
    if (ada.unlock !== "start") {
      expect(newWalkers(gameData, ["casey"], [ada.zone])).toEqual(["ada"]);
    }
    expect(newWalkers(gameData, ["casey", "trista"], ZONES)).toEqual(["ada", "ben"]);
  });
});
