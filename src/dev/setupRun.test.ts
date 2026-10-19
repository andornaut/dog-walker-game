import { describe, expect, it } from "vitest";

import type { DogId, GearId } from "../data/types";
import type { Loadout } from "../state/runState";
import { testState } from "../testing/runState";
import type { RunSetup } from "./runSetup";
import { loadoutFor, withSetupStart } from "./setupRun";

const fallback: Loadout = { dogs: ["biscuit"], gear: "whistle" };
const setup: RunSetup<DogId, GearId> = { dev: false, seed: 1, speed: 1, zone: 1 };

describe("loadoutFor", () => {
  it("keeps the fallback when the setup overrides nothing", () => {
    expect(loadoutFor(fallback, setup)).toEqual(fallback);
  });

  it.each<readonly DogId[]>([["koda"], ["koda", "dash"], ["koda", "dash", "zippy"]])(
    "takes a pack of %j from the setup",
    (...pack) => {
      expect(loadoutFor(fallback, { ...setup, pack }).dogs).toEqual(pack);
    },
  );

  it("takes the setup's gear, including none", () => {
    expect(loadoutFor(fallback, { ...setup, gear: "luckyCollar" }).gear).toBe("luckyCollar");
    expect(loadoutFor(fallback, { ...setup, gear: null }).gear).toBeNull();
  });

  it("keeps the fallback pack for a pack no run can take", () => {
    expect(loadoutFor(fallback, { ...setup, pack: [] }).dogs).toEqual(fallback.dogs);
    const four: DogId[] = ["koda", "dash", "zippy", "waffles"];
    expect(loadoutFor(fallback, { ...setup, pack: four }).dogs).toEqual(fallback.dogs);
  });
});

describe("withSetupStart", () => {
  const state = testState({ koda: 3 });

  it("keeps the run's money and moves it to the setup's zone", () => {
    expect(withSetupStart({ ...setup, zone: 3 }, state)).toEqual({
      ...state,
      firstZone: 2,
      zoneIndex: 2,
    });
  });

  it("replaces the run's money with the setup's", () => {
    expect(withSetupStart({ ...setup, money: 1250 }, state).money).toBe(1250);
  });
});
