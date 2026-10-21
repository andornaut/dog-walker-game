import { describe, expect, it } from "vitest";

import type { DogId, GearId, WalkerId } from "../data/types";
import type { HomeLoadout } from "../home/home";
import type { Loadout } from "../state/runState";
import { devRunLoadout, homeRunSetup, namesRunSetup, stripDevParams } from "./devStart";
import type { RunSetup } from "./runSetup";

const setup: RunSetup<DogId, GearId, WalkerId> = { dev: false, seed: 1, speed: 1, zone: 1 };

describe("namesRunSetup", () => {
  it("reads which queries name a run setup", () => {
    for (const [search, expected] of [
      ["?seed=123&pack=koda,duchess&zone=1&dev=1", true],
      ["?speed=2", true],
      ["?gear=none", true],
      ["?walker=ada", true],
      ["", false],
      ["?dev=1", false],
    ] as const) {
      expect(namesRunSetup(search)).toBe(expected);
    }
  });
});

describe("devRunLoadout", () => {
  it("derives each case", () => {
    for (const [, saved, overrides, expected] of [
      [
        "takes the link's pack, gear and walker over the saved loadout",
        { dogs: ["biscuit"], gear: null },
        { gear: "luckyCollar", pack: ["koda", "duchess"], walker: "trista" },
        { dogs: ["koda", "duchess"], gear: "luckyCollar", walker: "trista" },
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
    ] satisfies readonly [
      string,
      HomeLoadout,
      Partial<RunSetup<DogId, GearId, WalkerId>>,
      Loadout,
    ][]) {
      expect(devRunLoadout(saved, "ben", "koda", { ...setup, ...overrides })).toEqual(expected);
    }
  });
});

describe("stripDevParams", () => {
  const base = "http://host/play/";
  it("strips the dev parameters", () => {
    for (const [search, disableDev, expected] of [
      [
        "?dev=1&pack=koda&seed=3&gear=none&walker=ada&zone=2&money=5&speed=2&route=a,b",
        false,
        "?dev=1",
      ],
      ["?dev=1&pack=koda", true, ""],
      ["?pack=koda&lang=fr&zone=2#top", false, "?lang=fr#top"],
      ["?dev=1&lang=fr", true, "?lang=fr"],
      ["", false, ""],
    ] as const) {
      expect(stripDevParams(`${base}${search}`, disableDev)).toBe(`${base}${expected}`);
    }
  });
});

describe("homeRunSetup", () => {
  it("derives each case", () => {
    for (const [, dev] of [
      ["keeps dev mode on while home", true],
      ["keeps dev mode off while home", false],
    ] satisfies readonly [string, boolean][]) {
      const overridden: RunSetup<DogId, GearId, WalkerId> = {
        dev,
        gear: "luckyCollar",
        money: 5,
        pack: ["koda"],
        route: ["a"],
        seed: 1,
        speed: 3,
        walker: "trista",
        zone: 2,
      };
      expect(homeRunSetup(overridden, 9)).toEqual({
        dev,
        seed: 9,
        speed: 1,
        zone: 1,
      });
    }
  });
});
