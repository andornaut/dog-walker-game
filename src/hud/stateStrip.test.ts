import { describe, expect, it } from "vitest";

import manifest from "../../public/art/manifest.json";
import { itemAt } from "../arrays";
import { gameData } from "../data";
import type { DebuffId, GearId, UpgradeId, WalkerId } from "../data/types";
import { defined } from "../testing/defined";
import { activeModifier, testState } from "../testing/runState";
import { TEST_TUNING } from "../testing/tuning";
import {
  moveStripPress,
  onStrip,
  STRIP,
  stripIconFallback,
  stripIconKey,
  type StripItem,
  stripItems,
  stripLayout,
  stripTapAllowed,
  stripTapped,
  stripText,
  walkerStripItems,
} from "./stateStrip";
import { PAUSE_BUTTON, type RunPause } from "./topBar";

const data = { ...gameData, tuning: TEST_TUNING };
// Walkers that change what they do, for their text.
const walkerData = {
  ...data,
  tuning: {
    ...TEST_TUNING,
    hearts: { ...TEST_TUNING.hearts, charmerStart: 1 },
    multipliers: {
      ...TEST_TUNING.multipliers,
      charmerTip: 0.85,
      slowWalkerFees: 0.9,
      slowWalkerSpeed: 0.9,
    },
  },
};

describe("stripItems", () => {
  it("lists the debuffs, then the upgrades in effect in pick order, the gear, then the walker's pace and style", () => {
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
        walker: "trista",
      },
    );
    expect(stripItems(data, run)).toEqual([
      { debuff: "stinky", kind: "debuff" },
      { kind: "upgrade", upgrade: "raincoats" },
      { kind: "upgrade", upgrade: "bigTipper" },
      { gear: "whistle", kind: "gear" },
      { kind: "pace", pace: "fast" },
      { kind: "style", style: "hustle" },
    ]);
  });

  it("drops an upgrade once its effects expire, and never shows a boost given at once", () => {
    const run = testState({ koda: 5 }, { upgradesPicked: ["shortcut", "secondWind"] });
    expect(stripItems(data, run)).toEqual(walkerStripItems(data, run.walker));
  });
});

describe("walkerStripItems", () => {
  it.each<[WalkerId, StripItem[]]>([
    [
      "ada",
      [
        { kind: "pace", pace: "fast" },
        { kind: "style", style: "charm" },
      ],
    ],
    [
      "ben",
      [
        { kind: "pace", pace: "slow" },
        { kind: "style", style: "hustle" },
      ],
    ],
  ])("gives %s's pace, then style", (walker, expected) => {
    expect(walkerStripItems(data, walker)).toEqual(expected);
  });
});

describe("stripText", () => {
  it.each<[string, StripItem, string]>([
    [
      "an upgrade's name and effect as its card does",
      { kind: "upgrade", upgrade: "bigTipper" },
      "Big tipper: tip value +50% for the run.",
    ],
    [
      "gear's name and effect as its home line does",
      { gear: "fannyPack", kind: "gear" },
      "Fanny pack: starting money +$15.",
    ],
    [
      "a debuff's modifiers for its duration",
      { debuff: "stinky", kind: "debuff" },
      "Stinky: tip value −50% for the rest of the zone.",
    ],
    [
      "a walker's pace and its effects",
      { kind: "pace", pace: "slow" },
      "Slow: road speed −10%, fees −10%.",
    ],
    [
      "a walker's style and its effects",
      { kind: "style", style: "charm" },
      "Charmer: starting ♥ +1, tip value −15%.",
    ],
  ])("writes %s", (_name, item, expected) => {
    expect(stripText(walkerData, item)).toBe(expected);
  });
});

describe("stripIconFallback", () => {
  it.each<[StripItem, string]>([
    [{ gear: "fannyPack", kind: "gear" }, "F"],
    [{ kind: "style", style: "hustle" }, "H"],
  ])("shows %o as the first letter of its name", (item, expected) => {
    expect(stripIconFallback(data, item)).toBe(expected);
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
    expect(items.map(stripIconKey).filter((key) => !keys.has(key))).toEqual([]);
  });
});

describe("stripTapAllowed", () => {
  const pause: RunPause = { card: false, hitStop: false, menu: "closed" };

  it.each<[string, RunPause, boolean]>([
    ["takes taps while walking", pause, true],
    ["takes taps under a card and hit stop", { ...pause, card: true, hitStop: true }, true],
    ["takes taps in the pause menu", { ...pause, menu: "open" }, true],
    ["leaves taps to help, which covers the bar", { ...pause, menu: "help" }, false],
    ["leaves taps to settings, which cover the bar", { ...pause, menu: "settings" }, false],
  ])("%s", (_name, state, expected) => {
    expect(stripTapAllowed(state)).toBe(expected);
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

describe("onStrip", () => {
  it("is the strip's hit area, and nowhere while the strip is empty", () => {
    const { hit } = defined(stripLayout(360, 2));
    expect(onStrip(360, 2, { x: hit.x + 1, y: hit.y + 1 })).toBe(true);
    expect(onStrip(360, 2, { x: hit.x - 1, y: hit.y + 1 })).toBe(false);
    expect(onStrip(360, 0, { x: hit.x + 1, y: hit.y + 1 })).toBe(false);
  });
});

describe("strip presses", () => {
  const start = { x: 330, y: 60 };

  it("tap the strip on a release within the tap distance", () => {
    expect(stripTapped(10, { x: 336, y: 64 }, { start, tapping: true })).toBe(true);
    expect(stripTapped(10, { x: 345, y: 60 }, { start, tapping: true })).toBe(false);
  });

  it("stay a drag after travelling past the tap distance and back", () => {
    const dragged = moveStripPress(10, { x: 300, y: 60 }, { start, tapping: true });
    expect(stripTapped(10, start, dragged)).toBe(false);
  });
});
