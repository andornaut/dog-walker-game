import { describe, expect, it } from "vitest";

import type { DogId, GearId, WalkerId } from "../data/types";
import type { Loadout } from "../state/runState";
import { testState } from "../testing/runState";
import type { RunSetup } from "./runSetup";
import { loadoutFor, withSetupStart } from "./setupRun";

const fallback: Loadout = { dogs: ["biscuit"], gear: "luckyCollar", walker: "casey" };
const setup: RunSetup<DogId, GearId, WalkerId> = { dev: false, seed: 1, speed: 1, zone: 1 };

describe("loadoutFor", () => {
  it.each<[string, Partial<RunSetup<DogId, GearId, WalkerId>>, Loadout]>([
    ["keeps the fallback when the setup overrides nothing", {}, fallback],
    ["takes a pack of one from the setup", { pack: ["koda"] }, { ...fallback, dogs: ["koda"] }],
    [
      "takes a pack of three from the setup",
      { pack: ["koda", "archie", "zippy"] },
      { ...fallback, dogs: ["koda", "archie", "zippy"] },
    ],
    ["takes the setup's gear", { gear: "luckyCollar" }, { ...fallback, gear: "luckyCollar" }],
    ["takes the setup's lack of gear", { gear: null }, { ...fallback, gear: null }],
    ["takes the setup's walker", { walker: "ada" }, { ...fallback, walker: "ada" }],
    ["keeps the fallback pack for an empty pack", { pack: [] }, fallback],
    [
      "keeps the fallback pack for a pack too big for a run",
      { pack: ["koda", "archie", "zippy", "penny"] },
      fallback,
    ],
  ])("%s", (_name, overrides, expected) => {
    expect(loadoutFor(fallback, { ...setup, ...overrides })).toEqual(expected);
  });
});

describe("withSetupStart", () => {
  const state = testState({ koda: 3 });

  it("keeps the run's money and moves it to the setup's zone, on the pre-fork route", () => {
    expect(withSetupStart({ ...setup, zone: 3 }, state)).toEqual({
      ...state,
      firstZone: 2,
      route: ["street", "park", "shops"],
      zoneIndex: 2,
    });
  });

  it("keeps the run's own route from the first zone", () => {
    expect(withSetupStart(setup, state).route).toEqual(state.route);
  });

  it("walks the setup's route up to its zone", () => {
    const route = ["street", "pawsPromenade", "snoozeCrescent", "park"];
    expect(withSetupStart({ ...setup, route, zone: 3 }, state).route).toEqual(route.slice(0, 3));
  });

  it("replaces the run's money with the setup's", () => {
    expect(withSetupStart({ ...setup, money: 1250 }, state).money).toBe(1250);
  });
});
