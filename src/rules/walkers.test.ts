import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import type { DogId, WalkerId, ZoneId } from "../data/types";
import { newRun } from "../state/runState";
import { isHeavy } from "./dogs";
import { read } from "./units";
import { newWalkers, packAgility, slowestAgility, walkerAgility } from "./walkers";

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
  const heavy = dogIds.filter((dog) => isHeavy(gameData.dogs[dog]));
  const light = dogIds.filter((dog) => !isHeavy(gameData.dogs[dog]));
  const perHeavy = read(gameData.tuning, "multipliers", "bigDogAgility");
  // A pack of three with count heavy dogs in it.
  const packWith = (count: number) =>
    [...heavy.slice(0, count), ...light.slice(0, 3 - count)] as [DogId, DogId, DogId];

  it("slows every walker by bigDogAgility for each heavy dog, never below the slowest walker", () => {
    for (const walker of WALKER_IDS) {
      for (const count of [0, 1, 2, 3]) {
        const run = newRun(gameData, 3, { dogs: packWith(count), gear: null, walker });
        const own = walkerAgility(gameData, run.modifiers, walker);
        const floor = Math.min(own, slowestAgility(gameData));
        expect(packAgility(gameData, run), `${walker}, ${count}`).toBeCloseTo(
          Math.max(floor, own + count * perHeavy),
        );
      }
    }
  });

  it("slows a walker above the slowest by each heavy dog", () => {
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
