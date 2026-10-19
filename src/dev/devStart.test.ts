import { describe, expect, it } from "vitest";

import type { DogId, GearId, WalkerId } from "../data/types";
import type { HomeLoadout } from "../home/home";
import type { Loadout } from "../state/runState";
import { devRunLoadout, namesRunSetup } from "./devStart";
import type { RunSetup } from "./runSetup";

const setup: RunSetup<DogId, GearId, WalkerId> = { dev: false, seed: 1, speed: 1, zone: 1 };

describe("namesRunSetup", () => {
  it.each([
    ["?seed=123&pack=koda,duchess&zone=1&dev=1", true],
    ["?speed=2", true],
    ["?gear=none", true],
    ["?walker=ada", true],
    ["", false],
    ["?dev=1", false],
  ])("reads %j as naming a run setup: %s", (search, expected) => {
    expect(namesRunSetup(search)).toBe(expected);
  });
});

describe("devRunLoadout", () => {
  it.each<[string, HomeLoadout, Partial<RunSetup<DogId, GearId, WalkerId>>, Loadout]>([
    [
      "takes the link's pack, gear and walker over the saved loadout",
      { dogs: ["biscuit"], gear: null },
      { gear: "whistle", pack: ["koda", "duchess"], walker: "trista" },
      { dogs: ["koda", "duchess"], gear: "whistle", walker: "trista" },
    ],
    [
      "keeps the saved loadout and walker for what the link leaves out",
      { dogs: ["biscuit"], gear: "fannyPack" },
      {},
      { dogs: ["biscuit"], gear: "fannyPack", walker: "ben" },
    ],
    [
      "walks the first owned dog when nothing was picked yet",
      { dogs: [], gear: null },
      {},
      { dogs: ["koda"], gear: null, walker: "ben" },
    ],
  ])("%s", (_name, saved, overrides, expected) => {
    expect(devRunLoadout(saved, "ben", "koda", { ...setup, ...overrides })).toEqual(expected);
  });
});
