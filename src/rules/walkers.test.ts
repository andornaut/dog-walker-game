import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import type { WalkerId } from "../data/types";
import { newWalkers, walkerEffects } from "./walkers";

describe("walkerEffects", () => {
  it("applies the walker's pace, then its style", () => {
    const { pace, style } = gameData.walkers.ada;
    expect(walkerEffects(gameData, "ada")).toEqual([
      ...gameData.walkerPaces[pace].effects,
      ...gameData.walkerStyles[style].effects,
    ]);
  });
});

describe("newWalkers", () => {
  it.each<[string, WalkerId[], number, WalkerId[]]>([
    ["no walker before a zone is finished but the starting one", [], 0, ["casey"]],
    ["Ben for zone 1", ["casey"], 1, ["ben"]],
    ["Ada for zone 2", ["ben", "casey"], 2, ["ada"]],
    ["Trista for zone 3", ["ada", "ben", "casey"], 3, ["trista"]],
    ["nothing once every walker is unlocked", ["ada", "ben", "casey", "trista"], 4, []],
    ["every walker whose goal is met, in data order", ["casey"], 4, ["ada", "ben", "trista"]],
    ["only walkers not owned yet", ["casey", "trista"], 3, ["ada", "ben"]],
  ])("unlocks %s", (_, owned, zonesFinished, expected) => {
    expect(newWalkers(gameData, owned, zonesFinished)).toEqual(expected);
  });
});
