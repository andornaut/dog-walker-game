import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import type { WalkerId } from "../data/types";
import { fillNames } from "../lib/lines";
import { keysOf } from "../lib/records";
import { agilityPercent, perkEffect } from "../rules/effectText";
import { newPlayerSave } from "../testing/saves";
import { type ItemTile, itemTileLook, type TileState } from "../ui/interaction";
import { homeLine } from "./homeText";
import { tapWalker, walkerDetailLines, walkerOrder, type WalkerTap, walkerTile } from "./walkers";

const save = {
  ...newPlayerSave,
  owned: { ...newPlayerSave.owned, walkers: ["casey", "mrB"] as WalkerId[] },
  walker: "mrB" as const,
};

describe("walkerOrder", () => {
  it("lists the starting walker, then the others by the zone that unlocks them", () => {
    expect(walkerOrder(gameData)).toEqual(["casey", "mrB", "ada", "trista"]);
  });
});

describe("walkerTile", () => {
  it("shows the picked walker selected, an owned one normal and a locked one by its goal", () => {
    const cases: readonly [WalkerId, ItemTile, TileState][] = [
      ["mrB", { kind: "picked" }, "selected"],
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

// A walker's info line, from the data: its own agility against the base and its perk, or its
// perk alone at the base.
const info = (walker: WalkerId) => {
  const { agility, name, perk } = gameData.walkers[walker];
  const percent = agilityPercent(agility);
  const perkName = gameData.walkerPerks[perk].name;
  return percent === null
    ? homeLine(gameData.homeText, "walkerInfoBase", { perk: perkName, walker: name })
    : homeLine(gameData.homeText, "walkerInfo", { agility: percent, perk: perkName, walker: name });
};
// The locked line names the zone whose finish unlocks the walker.
const locked = (walker: WalkerId) => {
  const data = gameData.walkers[walker];
  const goal = data.unlock === "start" ? undefined : data.zone;
  return homeLine(gameData.homeText, "walkerLocked", {
    zone: gameData.world.zones.find(({ id }) => id === goal)?.name ?? "",
  });
};
const WALKER_IDS = keysOf(gameData.walkers);
// A walker at the base lane-change speed and one off it: a walker's lines read only which it is.
const atBase = (walker: WalkerId) => agilityPercent(gameData.walkers[walker].agility) === null;
const SAMPLED = [WALKER_IDS.find(atBase), WALKER_IDS.find((walker) => !atBase(walker))].filter(
  (walker): walker is WalkerId => walker !== undefined,
);

describe("tapWalker", () => {
  it("drops the picked walker, picks an owned one and names a locked one's goal", () => {
    const cases: readonly [WalkerId, () => WalkerTap][] = [
      ["mrB", () => ({ kind: "drop" })],
      ["casey", () => ({ kind: "pick", text: info("casey"), walker: "casey" })],
      ["ada", () => ({ kind: "locked", text: locked("ada") })],
      ["trista", () => ({ kind: "locked", text: locked("trista") })],
    ];
    for (const [walker, tap] of cases) {
      expect(tapWalker(gameData, save.owned, save.walker, walker)).toEqual(tap());
    }
  });

  it.each(SAMPLED)("says %s's agility, if not at the base, and perk on a pick", (walker) => {
    expect(tapWalker(gameData, { walkers: WALKER_IDS }, null, walker)).toEqual({
      kind: "pick",
      text: info(walker),
      walker,
    });
  });
});

describe("walkerDetailLines", () => {
  it.each(SAMPLED)(
    "gives %s's agility against the base, left out at the base, then its perk",
    (walker) => {
      const { agility, perk } = gameData.walkers[walker];
      const { name } = gameData.walkerPerks[perk];
      const effect = perkEffect(gameData.tuning, gameData.walkerPerks[perk]);
      const percent = agilityPercent(agility);
      const detail = gameData.homeText.detail;
      expect(walkerDetailLines(gameData, walker)).toEqual([
        ...(percent === null ? [] : [fillNames(detail.walkerAgility, { agility: percent })]),
        fillNames(detail.walkerPerk, { effect, perk: name }),
      ]);
    },
  );
});
