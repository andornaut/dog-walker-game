import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import type { WalkerId, ZoneId } from "../data/types";
import { read } from "./units";
import { agilityWord, newWalkers, slowestAgility, walkerAgility, walkerEffects } from "./walkers";

const WALKER_IDS = Object.keys(gameData.walkers) as WalkerId[];

describe("walkerEffects", () => {
  it.each(WALKER_IDS)("applies %s's perk", (walker) => {
    const { perk } = gameData.walkers[walker];
    expect(walkerEffects(gameData, walker)).toEqual(gameData.walkerPerks[perk].effects);
  });
});

describe("walkerAgility", () => {
  it.each(WALKER_IDS)("adds Running shoes' agility to %s's", (walker) => {
    const shoes = gameData.shopGear.runningShoes.effects.flatMap((effect) =>
      effect.kind === "modifier" ? [effect] : [],
    );
    const plain = gameData.walkers[walker].agility;
    expect(walkerAgility(gameData, [], walker)).toBe(plain);
    expect(walkerAgility(gameData, shoes, walker)).toBeCloseTo(
      plain + read(gameData.tuning, "multipliers", "runningShoesAgility"),
    );
  });

  it("finds the slowest walker's agility", () => {
    const agilities = WALKER_IDS.map((walker) => gameData.walkers[walker].agility);
    expect(slowestAgility(gameData)).toBe(Math.min(...agilities));
  });
});

describe("agilityWord", () => {
  const bands = gameData.homeText.agilityWords;

  it.each(bands)("names an agility of $from $word", ({ from, word }) => {
    expect(agilityWord(gameData.homeText, from)).toBe(word);
  });

  it.each(bands.slice(1))("keeps the band below $from just under it", ({ from }) => {
    const below = bands[bands.findIndex((band) => band.from === from) - 1];
    expect(agilityWord(gameData.homeText, from - 0.01)).toBe(below?.word);
  });
});

describe("newWalkers", () => {
  const ZONES = gameData.world.zones.map(({ id }) => id as ZoneId);
  const goal = (walker: WalkerId): ZoneId => {
    const data = gameData.walkers[walker];
    return data.unlock === "start" ? (gameData.world.firstZone as ZoneId) : data.zone;
  };
  it.each<[string, WalkerId[], ZoneId[], WalkerId[]]>([
    ["no walker before a zone is finished but the starting one", [], [], ["casey"]],
    ["each walker for finishing its zone", ["casey"], [goal("ben")], ["ben"]],
    ["only its zone's walker", ["casey"], [goal("ada")], ["ada"]],
    ["nothing once every walker is unlocked", ["ada", "ben", "casey", "trista"], ZONES, []],
    [
      "every walker whose zone is finished, in data order",
      ["casey"],
      ZONES,
      ["ada", "ben", "trista"],
    ],
    ["only walkers not owned yet", ["casey", "trista"], ZONES, ["ada", "ben"]],
  ])("unlocks %s", (_, owned, finished, expected) => {
    expect(newWalkers(gameData, owned, finished)).toEqual(expected);
  });
});
