import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import type { WalkerId } from "../data/types";
import { agilityWord } from "../rules/walkers";
import { newPlayerSave } from "../testing/saves";
import { type ItemTile, itemTileLook, type TileState } from "../ui/interaction";
import { homeLine } from "./homeText";
import { tapWalker, walkerOrder, type WalkerTap, walkerTile } from "./walkers";

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
  it("shows the picked walker selected, an owned one normal and a locked one by its goal", () => {
    const cases: readonly [WalkerId, ItemTile, TileState][] = [
      ["ben", { kind: "picked" }, "selected"],
      ["casey", { kind: "available" }, "normal"],
      ["ada", { goal: gameData.walkers.ada.name, kind: "goal" }, "disabled"],
      ["trista", { goal: gameData.walkers.trista.name, kind: "goal" }, "disabled"],
    ];
    for (const [walker, tile, state] of cases) {
      expect(walkerTile(gameData, save, walker)).toEqual(tile);
      expect(itemTileLook(tile).state).toBe(state);
    }
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

describe("tapWalker", () => {
  it("drops the picked walker, picks an owned one and names a locked one's goal", () => {
    const cases: readonly [WalkerId, () => WalkerTap][] = [
      ["ben", () => ({ kind: "drop" })],
      ["casey", () => ({ kind: "pick", text: info("casey"), walker: "casey" })],
      ["ada", () => ({ kind: "locked", text: locked("ada") })],
      ["trista", () => ({ kind: "locked", text: locked("trista") })],
    ];
    for (const [walker, tap] of cases) {
      expect(tapWalker(gameData, save.owned, save.walker, walker)).toEqual(tap());
    }
  });
});
