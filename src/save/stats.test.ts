import { describe, expect, it } from "vitest";

import { newPlayerSave, veteranSave } from "./fixtures";
import { statsPage } from "./stats";

describe("statsPage", () => {
  it("sums the runs and dog walks, and names the owner who fired you most", () => {
    expect(statsPage(veteranSave().stats)).toEqual({
      bestRunCents: 9_000,
      bestRunDogs: ["koda", "penny"],
      bestRunZones: 4,
      bestZoneFinished: 4,
      dogsWalked: 7,
      lifetimeCents: 30_000,
      mostFiredBy: "koda",
      runs: { finished: 2, noDogs: 1, wentHome: 2 },
      runsPlayed: 5,
      timesFired: 1,
    });
  });

  it("names the first dog walked on a tie, and nobody before any firing", () => {
    const { stats } = veteranSave();
    const tied = {
      ...stats,
      dogs: {
        biscuit: { timesFired: 2, walks: 2, zonesFinished: 6 },
        koda: { timesFired: 2, walks: 5, zonesFinished: 12 },
      },
    };
    expect(statsPage(tied).mostFiredBy).toBe("biscuit");
    expect(statsPage(newPlayerSave.stats)).toMatchObject({
      bestRunCents: 0,
      bestRunDogs: [],
      bestRunZones: 0,
      mostFiredBy: null,
      runsPlayed: 0,
    });
  });
});
