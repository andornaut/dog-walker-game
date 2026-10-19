import { describe, expect, it } from "vitest";

import type { WalkerId } from "../data/types";
import { newPlayerSave } from "../save/fixtures";
import type { TileState } from "./interaction";
import { walkerTileState } from "./walkers";

describe("walkerTileState", () => {
  const save = {
    ...newPlayerSave,
    owned: { ...newPlayerSave.owned, walkers: ["casey", "ben"] as WalkerId[] },
    walker: "ben" as const,
  };

  it.each<[WalkerId, TileState]>([
    ["ben", "selected"],
    ["casey", "normal"],
    ["trista", "disabled"],
  ])("shows %s as %s", (walker, expected) => {
    expect(walkerTileState(save, walker)).toBe(expected);
  });
});
