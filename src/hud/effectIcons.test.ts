import { describe, expect, it } from "vitest";

import manifest from "../../public/art/manifest.json";
import { gameData } from "../data";
import type { GearId, UpgradeId, WalkerPerkId } from "../data/types";
import { activeModifier, testState } from "../testing/runState";
import { effectIconKey, type EffectItem, effectItems, walkerEffectItems } from "./effectIcons";

describe("effectItems", () => {
  it("lists the perk, the Pocket's gear, the found gear, then the upgrades in pick order", () => {
    const run = testState(
      { kilo: 5 },
      {
        foundGear: "whistle",
        gear: "luckyCollar",
        immunities: [{ encounter: "puddle", source: { kind: "upgrade", upgrade: "raincoats" } }],
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
    expect(effectItems(gameData, run)).toEqual([
      { kind: "perk", perk: gameData.walkers.trista.perk },
      { gear: "luckyCollar", kind: "gear" },
      { found: true, gear: "whistle", kind: "gear" },
      { kind: "upgrade", upgrade: "raincoats" },
      { kind: "upgrade", upgrade: "bigTipper" },
    ]);
  });

  it("drops an upgrade once its effects expire, and never shows one applied at once", () => {
    const run = testState({ kilo: 5 }, { upgradesPicked: ["bigTipper", "bellyRubs"] });
    expect(effectItems(gameData, run)).toEqual(walkerEffectItems(gameData, run.walker));
  });
});

describe("effectIconKey", () => {
  it("names an icon for every upgrade, gear item and perk, and the manifest has the upgrades' and gear's", () => {
    const keys = new Set(manifest.images.map((image) => image.key));
    const shipped: EffectItem[] = [
      ...(Object.keys(gameData.upgrades) as UpgradeId[]).map((upgrade): EffectItem => ({
        kind: "upgrade",
        upgrade,
      })),
      ...(Object.keys(gameData.shopGear) as GearId[]).map((gear): EffectItem => ({
        gear,
        kind: "gear",
      })),
    ];
    expect(shipped.map(effectIconKey).filter((key) => !keys.has(key))).toEqual([]);
    const perks = (Object.keys(gameData.walkerPerks) as WalkerPerkId[]).map((perk) =>
      effectIconKey({ kind: "perk", perk }),
    );
    expect(new Set(perks).size).toBe(perks.length);
  });
});
