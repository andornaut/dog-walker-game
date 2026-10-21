import { describe, expect, it } from "vitest";

import manifest from "../../public/art/manifest.json";
import { gameData } from "../data";
import type { GearId, UpgradeId, WalkerId, WalkerPerkId } from "../data/types";
import { activeModifier, testState } from "../testing/runState";
import {
  STRIP,
  stripIconFallback,
  stripIconKey,
  type StripItem,
  stripItems,
  stripLayout,
  walkerStripItems,
} from "./stateStrip";

describe("stripItems", () => {
  it("lists the upgrades in effect in pick order, the gear, then the walker's perk", () => {
    const run = testState(
      { koda: 5 },
      {
        gear: "luckyCollar",
        immunities: [{ encounter: "puddle" }],
        modifiers: [
          activeModifier(
            { kind: "upgrade", upgrade: "bigTipper" },
            { by: "bigTipperTipBonus", operation: "add", stat: "tipValue" },
          ),
        ],
        upgradesPicked: ["raincoats", "bellyRubs", "bigTipper"],
        walker: "trista",
      },
    );
    expect(stripItems(gameData, run)).toEqual([
      { kind: "upgrade", upgrade: "raincoats" },
      { kind: "upgrade", upgrade: "bigTipper" },
      { gear: "luckyCollar", kind: "gear" },
      { kind: "perk", perk: gameData.walkers.trista.perk },
    ]);
  });

  it("drops an upgrade once its effects expire, and never shows one applied at once", () => {
    const run = testState({ koda: 5 }, { upgradesPicked: ["bigTipper", "bellyRubs"] });
    expect(stripItems(gameData, run)).toEqual(walkerStripItems(gameData, run.walker));
  });
});

describe("walkerStripItems", () => {
  it.each(Object.keys(gameData.walkers) as WalkerId[])("gives %s's perk", (walker) => {
    expect(walkerStripItems(gameData, walker)).toEqual([
      { kind: "perk", perk: gameData.walkers[walker].perk },
    ]);
  });
});

describe("stripIconFallback", () => {
  it.each<[StripItem, string]>([
    [{ gear: "fannyPack", kind: "gear" }, gameData.shopGear.fannyPack.name],
    [{ kind: "perk", perk: "kindWords" }, gameData.walkerPerks.kindWords.name],
    [{ kind: "upgrade", upgrade: "raincoats" }, gameData.upgrades.raincoats.name],
  ])("shows %o as the first letter of its name", (item, name) => {
    expect(stripIconFallback(gameData, item)).toBe(name.slice(0, 1));
  });
});

describe("stripIconKey", () => {
  it("names an icon for every upgrade, gear item and perk, and the manifest has the upgrades' and gear's", () => {
    const keys = new Set(manifest.images.map((image) => image.key));
    const shipped: StripItem[] = [
      ...(Object.keys(gameData.upgrades) as UpgradeId[]).map((upgrade): StripItem => ({
        kind: "upgrade",
        upgrade,
      })),
      ...(Object.keys(gameData.shopGear) as GearId[]).map((gear): StripItem => ({
        gear,
        kind: "gear",
      })),
    ];
    expect(shipped.map(stripIconKey).filter((key) => !keys.has(key))).toEqual([]);
    const perks = (Object.keys(gameData.walkerPerks) as WalkerPerkId[]).map((perk) =>
      stripIconKey({ kind: "perk", perk }),
    );
    expect(new Set(perks).size).toBe(perks.length);
  });
});

describe("stripLayout", () => {
  it("draws nothing for no items", () => {
    expect(stripLayout(0)).toBeUndefined();
  });

  it.each([1, 3, 5])("hangs %i icons under the bar, right-aligned, a gap apart", (count) => {
    const layout = stripLayout(count);
    if (layout === undefined) {
      throw new Error("a strip");
    }
    expect(layout.tab.y).toBe(STRIP.y);
    expect(layout.tab.x + layout.tab.width).toBe(STRIP.right);
    expect(layout.icons).toHaveLength(count);
    layout.icons.slice(1).forEach((icon, i) => {
      expect(icon.x - (layout.icons[i]?.x ?? 0)).toBe(STRIP.icon + STRIP.gap);
    });
    const last = layout.icons[count - 1];
    expect((last?.x ?? 0) + STRIP.icon + STRIP.padding).toBe(layout.well.x + layout.well.width);
  });
});
