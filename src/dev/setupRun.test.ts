import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import type { DogId, GearId, WalkerId } from "../data/types";
import type { Loadout } from "../state/runState";
import { testState } from "../testing/runState";
import type { RunSetup } from "./runSetup";
import { loadoutFor, withSetupStart } from "./setupRun";

const fallback: Loadout = { dogs: ["biscuit"], gear: "luckyCollar", walker: "casey" };
const setup: RunSetup<DogId, GearId, WalkerId> = { dev: false, seed: 1, speed: 1, zone: 1 };

describe("loadoutFor", () => {
  it("sets up the run from the setup", () => {
    for (const [, overrides, expected] of [
      ["keeps the fallback when the setup overrides nothing", {}, fallback],
      ["takes a pack of one from the setup", { pack: ["kilo"] }, { ...fallback, dogs: ["kilo"] }],
      [
        "takes a pack of three from the setup",
        { pack: ["kilo", "archie", "buddy"] },
        { ...fallback, dogs: ["kilo", "archie", "buddy"] },
      ],
      ["takes the setup's gear", { gear: "luckyCollar" }, { ...fallback, gear: "luckyCollar" }],
      ["takes the setup's lack of gear", { gear: null }, { ...fallback, gear: null }],
      ["takes the setup's walker", { walker: "ada" }, { ...fallback, walker: "ada" }],
      ["keeps the fallback pack for an empty pack", { pack: [] }, fallback],
      [
        "keeps the fallback pack for a pack too big for a run",
        { pack: ["kilo", "archie", "buddy", "penny"] },
        fallback,
      ],
    ] satisfies readonly [string, Partial<RunSetup<DogId, GearId, WalkerId>>, Loadout][]) {
      expect(loadoutFor(fallback, { ...setup, ...overrides })).toEqual(expected);
    }
  });
});

describe("withSetupStart", () => {
  const state = testState({ kilo: 3 });

  it("keeps the run's money and moves it to the setup's zone, on the pre-fork route", () => {
    expect(withSetupStart(gameData, { ...setup, zone: 3 }, state)).toEqual({
      ...state,
      firstZone: 2,
      route: gameData.world.preForkRoute.slice(0, 3),
      zoneIndex: 2,
    });
  });

  const route = ["street", "pawsPromenade", "snoozeCrescent", "park"];
  it.each([
    ["keeps the run's own route from the first zone", setup, state.route],
    ["walks the setup's route up to its zone", { ...setup, route, zone: 3 }, route.slice(0, 3)],
  ])("%s", (_, from, expected) => {
    expect(withSetupStart(gameData, from, state).route).toEqual(expected);
  });

  it("replaces the run's money with the setup's", () => {
    expect(withSetupStart(gameData, { ...setup, money: 1250 }, state).money).toBe(1250);
  });
});
