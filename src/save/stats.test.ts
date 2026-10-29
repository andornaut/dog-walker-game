import { describe, expect, it } from "vitest";

import { newPlayerSave, veteranSave } from "../testing/saves";
import { statsPage } from "./stats";

describe("statsPage", () => {
  it("sums the runs, dog walks and firings, and names the owner who fired you most", () => {
    const { stats } = veteranSave();
    expect(statsPage(stats)).toEqual({
      bestRunCents: 9_000,
      bestRunDogs: ["kilo", "penny"],
      bestRunZones: 4,
      bestZoneFinished: 4,
      dogsWalked: 7,
      lifetimeCents: stats.lifetimeCents - stats.lifetimeStartCents,
      mostFiredBy: "kilo",
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
        kilo: { timesFired: 2, walks: 5, zonesFinished: 12 },
      },
    };
    expect(statsPage(tied)).toMatchObject({ mostFiredBy: "biscuit", timesFired: 4 });
    expect(statsPage(newPlayerSave.stats)).toMatchObject({
      bestRunCents: 0,
      bestRunDogs: [],
      bestRunZones: 0,
      mostFiredBy: null,
      runsPlayed: 0,
    });
  });
});
