import { describe, expect, it } from "vitest";

import manifest from "../../public/art/manifest.json";
import { itemAt } from "../arrays";
import { gameData } from "../data";
import type { DebuffId, GearId, UpgradeId } from "../data/types";
import { defined } from "../testing/defined";
import { activeModifier, testState } from "../testing/runState";
import { TEST_TUNING } from "../testing/tuning";
import {
  STRIP,
  stripIconKey,
  type StripItem,
  stripItems,
  stripLayout,
  stripTapAllowed,
  stripText,
} from "./stateStrip";
import { PAUSE_BUTTON } from "./topBar";

const data = { ...gameData, tuning: TEST_TUNING };

describe("stripItems", () => {
  it("lists the debuffs, then the upgrades in effect in pick order, then the gear", () => {
    const run = testState(
      { koda: 5 },
      {
        debuffs: [{ debuff: "stinky" }],
        gear: "whistle",
        immunities: [{ encounter: "thief" }, { encounter: "puddle" }],
        modifiers: [
          activeModifier(
            { kind: "upgrade", upgrade: "bigTipper" },
            { by: "bigTipperTip", operation: "multiply", stat: "tipValue" },
          ),
        ],
        upgradesPicked: ["raincoats", "bellyRubs", "bigTipper"],
      },
    );
    expect(stripItems(data, run)).toEqual([
      { debuff: "stinky", kind: "debuff" },
      { kind: "upgrade", upgrade: "raincoats" },
      { kind: "upgrade", upgrade: "bigTipper" },
      { gear: "whistle", kind: "gear" },
    ]);
  });

  it("drops an upgrade once its effects expire, and never shows a boost given at once", () => {
    const run = testState({ koda: 5 }, { upgradesPicked: ["shortcut", "secondWind"] });
    expect(stripItems(data, run)).toEqual([]);
  });
});

describe("stripText", () => {
  it("writes the name and effect as the upgrade card and the gear's home line do", () => {
    expect(stripText(data, { kind: "upgrade", upgrade: "bigTipper" })).toBe(
      "Big tipper: Tip value +50% for the run.",
    );
    expect(stripText(data, { gear: "fannyPack", kind: "gear" })).toBe(
      "Fanny pack: Starting money +$15.",
    );
  });

  it("writes a debuff's modifiers for its duration", () => {
    expect(stripText(data, { debuff: "stinky", kind: "debuff" })).toBe(
      "Stinky: Tip value −50% for the rest of the zone.",
    );
  });
});

describe("stripIconKey", () => {
  it("names an icon the art manifest has for every debuff, upgrade and gear item", () => {
    const keys = new Set(manifest.images.map((image) => image.key));
    const items: StripItem[] = [
      ...(Object.keys(gameData.debuffs) as DebuffId[]).map((debuff): StripItem => ({
        debuff,
        kind: "debuff",
      })),
      ...(Object.keys(gameData.upgrades) as UpgradeId[]).map((upgrade): StripItem => ({
        kind: "upgrade",
        upgrade,
      })),
      ...(Object.keys(gameData.shopGear) as GearId[]).map((gear): StripItem => ({
        gear,
        kind: "gear",
      })),
    ];
    expect(items).toHaveLength(15);
    expect(items.map(stripIconKey).filter((key) => !keys.has(key))).toEqual([]);
  });
});

describe("stripTapAllowed", () => {
  const pause = { card: false, hitStop: false, menu: "closed" } as const;

  it("takes taps while walking, under a card or hit stop, and in the pause menu", () => {
    expect(stripTapAllowed(pause)).toBe(true);
    expect(stripTapAllowed({ ...pause, card: true, hitStop: true })).toBe(true);
    expect(stripTapAllowed({ ...pause, menu: "open" })).toBe(true);
  });

  it("leaves taps to help and settings, which cover the bar", () => {
    expect(stripTapAllowed({ ...pause, menu: "help" })).toBe(false);
    expect(stripTapAllowed({ ...pause, menu: "settings" })).toBe(false);
  });
});

describe("stripLayout", () => {
  it("draws nothing for no items", () => {
    expect(stripLayout(360, 0)).toBeUndefined();
  });

  it("hangs the tab under the bar, right-aligned with the zone well, icons 18px apart", () => {
    const layout = stripLayout(360, 5);
    expect(layout?.tab).toEqual({ height: 26, width: 99, x: 257, y: 40 });
    expect(layout?.well).toEqual({ height: 20, width: 92, x: 260, y: 41 });
    expect(layout?.icons.map((icon) => icon.x)).toEqual([262, 280, 298, 316, 334]);
    expect(layout?.icons.every((icon) => icon.y === 43)).toBe(true);
  });

  it("keeps a tap target at least 44px square inside the screen, clear of the pause button", () => {
    for (const count of [1, 2, 5]) {
      const layout = defined(stripLayout(360, count));
      const { hit } = layout;
      expect(Math.min(hit.width, hit.height)).toBeGreaterThanOrEqual(STRIP.minHit);
      expect(hit.x + hit.width).toBeLessThanOrEqual(360);
      expect(hit.x).toBeLessThanOrEqual(layout.tab.x);
      expect(hit.x).toBeGreaterThanOrEqual(PAUSE_BUTTON.hit.x + PAUSE_BUTTON.hit.width);
      const last = itemAt(layout.icons, count - 1);
      expect(last.x + STRIP.icon).toBeLessThanOrEqual(hit.x + hit.width);
    }
  });
});
