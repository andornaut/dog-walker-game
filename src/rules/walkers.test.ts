import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import type { DogId, Size, WalkerId, ZoneId } from "../data/types";
import { keysOf } from "../lib/records";
import { newRun } from "../state/runState";
import { read } from "./units";
import { newWalkers, packAgility, slowestPackAgility, walkerAgility } from "./walkers";

const WALKER_IDS = keysOf(gameData.walkers);

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
  const ofSize = (size: Size) =>
    keysOf(gameData.dogs).filter((dog) => gameData.dogs[dog].size === size);
  const perSmall = read(gameData.tuning, "multipliers", "smallDogAgility");
  const perLarge = read(gameData.tuning, "multipliers", "largeDogAgility");
  const minPack = read(gameData.tuning, "multipliers", "minPackAgility");
  // A pack of three with small small dogs and large large dogs, medium dogs filling the rest.
  const packOf = (small: number, large: number) =>
    [
      ...ofSize("small").slice(0, small),
      ...ofSize("large").slice(0, large),
      ...ofSize("medium").slice(0, 3 - small - large),
    ] as [DogId, DogId, DogId];
  const mixes = [0, 1, 2, 3].flatMap((small) =>
    [0, 1, 2, 3].filter((large) => small + large <= 3).map((large) => ({ large, small })),
  );
  const gears = [null, "runningShoes"] as const;
  const packs = WALKER_IDS.flatMap((walker) =>
    gears.flatMap((gear) =>
      mixes.map(({ large, small }) => ({
        gear,
        large,
        run: newRun(gameData, 3, { dogs: packOf(small, large), gear, walker }),
        small,
        walker,
      })),
    ),
  );

  // The nimblest walker and gear and the slowest: the floor reads a walker only through its own
  // agility.
  const ownOf = ({ run, walker }: (typeof packs)[number]) =>
    walkerAgility(gameData, run.modifiers, walker);
  const owns = packs.map(ownOf);
  const extremes = packs.filter(
    (pack) => ownOf(pack) === Math.max(...owns) || ownOf(pack) === Math.min(...owns),
  );
  const ends = extremes.filter((pack) => {
    const first = extremes.find((other) => ownOf(other) === ownOf(pack));
    return first?.walker === pack.walker && first.gear === pack.gear;
  });
  it.each(ends)(
    "moves $walker with $gear by smallDogAgility for each of $small small dogs and " +
      "largeDogAgility for each of $large large dogs, never below minPackAgility",
    ({ large, run, small, walker }) => {
      const own = walkerAgility(gameData, run.modifiers, walker);
      const floor = Math.min(own, minPack);
      expect(packAgility(gameData, run)).toBeCloseTo(
        Math.max(floor, own + small * perSmall + large * perLarge),
      );
    },
  );

  it("never goes below slowestPackAgility, which the slowest pack reaches", () => {
    const agilities = packs.map(({ run }) => packAgility(gameData, run));
    for (const agility of agilities) {
      expect(agility).toBeGreaterThanOrEqual(slowestPackAgility(gameData) - 1e-9);
    }
    expect(Math.min(...agilities)).toBeCloseTo(slowestPackAgility(gameData));
  });

  it.each(WALKER_IDS.flatMap((walker) => gears.map((gear) => ({ gear, walker }))))(
    "speeds $walker with $gear up with each small dog, with no cap",
    ({ gear, walker }) => {
      const agilities = [0, 1, 2, 3].map((small) =>
        packAgility(gameData, newRun(gameData, 3, { dogs: packOf(small, 0), gear, walker })),
      );
      agilities.slice(1).forEach((agility, i) => {
        expect(agility).toBeGreaterThan(agilities[i] ?? Infinity);
      });
    },
  );
});

describe("newWalkers", () => {
  const ZONES = gameData.world.zones.map(({ id }) => id as ZoneId);

  it("unlocks each walker not owned yet for finishing its zone, in data order", () => {
    const ada = gameData.walkers.ada;
    expect(newWalkers(gameData, [], [])).toEqual(["casey"]);
    if (ada.unlock !== "start") {
      expect(newWalkers(gameData, ["casey"], [ada.zone])).toEqual(["ada"]);
    }
    expect(newWalkers(gameData, ["casey", "trista"], ZONES)).toEqual(["ada", "mrB"]);
  });
});
