import { keysOf } from "@andornaut/game-kit/records";
import { describe, expect, it } from "vitest";

import manifest from "../../public/art/manifest.json";
import { gameData } from "../data";
import { modifiersOf } from "../rules/modifiers";
import { activeModifier, testState } from "../testing/runState";
import {
  effectIconKey,
  type EffectItem,
  effectItems,
  spareTreatWell,
  walkerEffectItems,
} from "./effectIcons";

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
      ...keysOf(gameData.upgrades).map((upgrade): EffectItem => ({
        kind: "upgrade",
        upgrade,
      })),
      ...keysOf(gameData.shopGear).map((gear): EffectItem => ({
        gear,
        kind: "gear",
      })),
    ];
    expect(shipped.map(effectIconKey).filter((key) => !keys.has(key))).toEqual([]);
    const perks = keysOf(gameData.walkerPerks).map((perk) => effectIconKey({ kind: "perk", perk }));
    expect(new Set(perks).size).toBe(perks.length);
  });
});

describe("spareTreatWell", () => {
  const fanny = modifiersOf(gameData.shopGear.fannyPack.effects);
  // The Fanny pack in the Pocket or found, the Lucky collar in the other place, holding held.
  const holding = (found: boolean, held: number) => {
    const source = found
      ? ({ found: true, gear: "fannyPack", kind: "gear" } as const)
      : ({ gear: "fannyPack", kind: "gear" } as const);
    return testState(
      { kilo: 5 },
      {
        foundGear: found ? "fannyPack" : "luckyCollar",
        gear: found ? "luckyCollar" : "fannyPack",
        modifiers: fanny.map((modifier) => activeModifier(source, modifier)),
        spareTreats: { held, spent: 0, stored: held },
      },
    );
  };
  // The walk's wells: the perk's, the Pocket's, then the found item's.
  it.each([
    { expected: 1, found: false, held: 1, name: "the Pocket's Fanny pack's well, holding one" },
    { expected: 2, found: true, held: 1, name: "the found Fanny pack's well, holding one" },
    { expected: -1, found: false, held: 0, name: "no well, holding none" },
  ])("shows $name", ({ expected, found, held }) => {
    const run = holding(found, held);
    expect(spareTreatWell(effectItems(gameData, run), run)).toBe(expected);
  });
});
