import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import type { WalkerId } from "../data/types";
import { agilityWord } from "../rules/walkers";
import { newPlayerSave } from "../save/fixtures";
import { homeLine } from "./homeText";
import { type ItemTile, itemTileLook, type TileState } from "./interaction";
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
    ["ada", { goal: gameData.homeText.lockedName, kind: "goal" }, "disabled"],
    ["trista", { goal: gameData.homeText.lockedName, kind: "goal" }, "disabled"],
  ])("shows %s as %o, drawn %s", (walker, tile, state) => {
    expect(walkerTile(gameData, save, walker)).toEqual(tile);
    expect(itemTileLook(tile).state).toBe(state);
  });
});

// A walker's info line, from the data: its agility word in lower case and its perk.
const info = (walker: WalkerId) => {
  const { agility, name, perk } = gameData.walkers[walker];
  return homeLine(gameData.homeText, "walkerInfo", {
    agility: agilityWord(gameData.homeText, agility).toLowerCase(),
    perk: gameData.walkerPerks[perk].name,
    walker: name,
  });
};
// The locked line names the zone whose finish unlocks the walker.
const locked = (walker: WalkerId) => {
  const data = gameData.walkers[walker];
  const goal = data.unlock === "start" ? undefined : data.zone;
  return homeLine(gameData.homeText, "walkerLocked", {
    zone: gameData.world.zones.find(({ id }) => id === goal)?.name ?? "",
  });
};

describe("walkerInfo", () => {
  it.each(Object.keys(gameData.walkers) as WalkerId[])(
    "writes %s's agility word and perk",
    (walker) => {
      expect(walkerInfo(gameData, walker)).toBe(info(walker));
    },
  );
});

describe("tapWalker", () => {
  it.each<[WalkerId, () => WalkerTap]>([
    ["ben", () => ({ kind: "drop" })],
    ["casey", () => ({ kind: "pick", text: info("casey"), walker: "casey" })],
    ["ada", () => ({ kind: "locked", text: locked("ada") })],
    ["trista", () => ({ kind: "locked", text: locked("trista") })],
  ])("on %s", (walker, tap) => {
    expect(tapWalker(gameData, save.owned, save.walker, walker)).toEqual(tap());
  });
});
