import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import type { WalkerId } from "../data/types";
import { newPlayerSave } from "../save/fixtures";
import { type ItemTile, itemTileState, type TileState } from "./interaction";
import { tapWalker, walkerInfo, walkerOrder, type WalkerTap, walkerTile } from "./walkers";

const save = {
  ...newPlayerSave,
  owned: { ...newPlayerSave.owned, walkers: ["casey", "ben"] as WalkerId[] },
  walker: "ben" as const,
};

describe("walkerOrder", () => {
  it("lists the starting walker, then the others by the zone that unlocks them", () => {
    expect(walkerOrder(gameData)).toEqual(["casey", "ben", "ada", "trista"]);
  });
});

describe("walkerTile", () => {
  it.each<[WalkerId, ItemTile, TileState]>([
    ["ben", { kind: "picked" }, "selected"],
    ["casey", { kind: "available" }, "normal"],
    ["ada", { goal: "Ada", kind: "goal" }, "disabled"],
    ["trista", { goal: "Trista", kind: "goal" }, "disabled"],
  ])("shows %s as %o, drawn %s", (walker, tile, state) => {
    expect(walkerTile(gameData, save, walker)).toEqual(tile);
    expect(itemTileState(tile)).toBe(state);
  });
});

describe("walkerInfo", () => {
  it.each<[WalkerId, string]>([
    ["ada", "Ada: fast, charmer."],
    ["ben", "Ben: slow, hustler."],
    ["casey", "Casey: slow, charmer."],
    ["trista", "Trista: fast, hustler."],
  ])("writes %s's pace and style", (walker, expected) => {
    expect(walkerInfo(gameData, walker)).toBe(expected);
  });
});

describe("tapWalker", () => {
  it.each<[WalkerId, WalkerTap]>([
    ["ben", { kind: "pick", text: "Ben: slow, hustler." }],
    ["casey", { kind: "pick", text: "Casey: slow, charmer." }],
    ["ada", { kind: "locked", text: "Finish zone 2 to unlock Ada." }],
    ["trista", { kind: "locked", text: "Finish zone 3 to unlock Trista." }],
  ])("on %s gives %o", (walker, tap) => {
    expect(tapWalker(gameData, save.owned, walker)).toEqual(tap);
  });
});
