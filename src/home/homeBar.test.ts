import { describe, expect, it } from "vitest";

import { SCREEN_LAYOUT } from "../data/screen";
import { isOutside } from "../input/outsideTap";
import { containsPoint, type Rect } from "../lib/rect";
import {
  type HomeBarAction,
  homeBarAction,
  type HomeBarButton,
  homeBarButtonAt,
  overlayRegion,
  regionOutside,
} from "./homeBar";
import { HOME_LAYOUT } from "./homeLayout";

const centre = (rect: Rect) => ({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 });
const BAR_BOTTOM = HOME_LAYOUT.topBar.height - 1;

describe("overlayRegion", () => {
  // A point and whether the region holds it.
  it.each([
    ["home leaves out the top bar's last row", "home", { x: 0, y: BAR_BOTTOM }, false],
    ["home holds the row under the top bar", "home", { x: 0, y: BAR_BOTTOM + 1 }, true],
    [
      "home holds the screen's last row",
      "home",
      { x: 0, y: SCREEN_LAYOUT.screen.height - 1 },
      true,
    ],
    ["walk holds the walk view", "walk", centre(SCREEN_LAYOUT.walkView), true],
  ] as const)("%s", (_, region, point, holds) => {
    expect(containsPoint(overlayRegion(region), point.x, point.y)).toBe(holds);
  });
});

describe("regionOutside", () => {
  const settingsHit = HOME_LAYOUT.settings.hit;
  // A point on the row under the top bar, under the Settings button or clear of every button.
  const underSettings = { x: centre(settingsHit).x, y: BAR_BOTTOM + 1 };
  const underBank = { x: HOME_LAYOUT.topBar.well.x, y: BAR_BOTTOM + 1 };
  it.each([
    ["home: under the top bar, clear of its buttons", "home", underBank, true],
    ["home: on a button's tap area under the top bar", "home", underSettings, false],
    ["home: on the top bar", "home", centre(HOME_LAYOUT.help.hit), false],
    ["walk: in the walk view", "walk", centre(SCREEN_LAYOUT.walkView), true],
  ] as const)("%s", (_, region, point, outside) => {
    expect(isOutside(regionOutside(region, []), point)).toBe(outside);
  });
});

describe("homeBarButtonAt", () => {
  it.each([
    ["help", centre(HOME_LAYOUT.help.hit)],
    ["logbook", centre(HOME_LAYOUT.logbook.hit)],
    ["mute", centre(HOME_LAYOUT.mute.hit)],
    ["settings", centre(HOME_LAYOUT.settings.hit)],
    [undefined, { x: HOME_LAYOUT.topBar.well.x, y: HOME_LAYOUT.topBar.mid }],
  ] satisfies readonly [HomeBarButton | undefined, { x: number; y: number }][])(
    "finds %s",
    (button, point) => {
      expect(homeBarButtonAt(point.x, point.y)).toBe(button);
    },
  );
});

describe("homeBarAction", () => {
  const NONE = { logbook: false, settings: false };
  const LOGBOOK = { logbook: true, settings: false };
  const SETTINGS = { logbook: false, settings: true };
  // open: which of the Logbook and the settings is open, over the start screen or the shop.
  it.each([
    ["neither open", NONE, "help", "openHelp"],
    ["neither open", NONE, "logbook", "openLogbook"],
    ["neither open", NONE, "mute", "mute"],
    ["neither open", NONE, "settings", "openSettings"],
    ["the Logbook open", LOGBOOK, "logbook", "close"],
    ["the Logbook open", LOGBOOK, "settings", "openSettings"],
    ["the settings open", SETTINGS, "logbook", "openLogbook"],
    ["the settings open", SETTINGS, "mute", "mute"],
    ["the settings open", SETTINGS, "settings", "close"],
    ["the settings open", SETTINGS, "help", "openHelp"],
  ] satisfies readonly [string, typeof NONE, HomeBarButton, HomeBarAction][])(
    "with %s, %s does %s",
    (_, open, button, action) => {
      expect(homeBarAction(open, button)).toBe(action);
    },
  );
});
