import { isOutside } from "@andornaut/game-kit/input/outsideTap";
import { containsPoint, type Rect } from "@andornaut/game-kit/rect";
import { describe, expect, it } from "vitest";

import { SCREEN_LAYOUT } from "../data/screen";
import { TOP_BAR_BUTTONS } from "../hud/topBar";
import { walkBarLayout } from "../hud/walkHud";
import {
  homeBackAction,
  type HomeBarAction,
  homeBarAction,
  homeBarButtonAt,
  overlayRegion,
  regionOutside,
} from "./homeBar";
import { HOME_BAR_BUTTONS, HOME_LAYOUT, type HomeBarButton, homeBarButtons } from "./homeLayout";

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

// Each button's centre on the top bar as shown, with Exit or without it.
function buttonCentres(exit: boolean): Partial<Record<HomeBarButton, { x: number; y: number }>> {
  return Object.fromEntries(homeBarButtons(exit).map(([id, { hit }]) => [id, centre(hit)]));
}

describe.each([true, false])("the top bar with Exit shown %s", (exit) => {
  const centres = buttonCentres(exit);
  const settingsHit = homeBarButtons(exit).find(([id]) => id === "settings")?.[1].hit;
  // A point on the row under the top bar, under the Settings button or clear of every button.
  const underSettings = {
    x: settingsHit === undefined ? 0 : centre(settingsHit).x,
    y: BAR_BOTTOM + 1,
  };
  const underBank = { x: HOME_LAYOUT.topBar.well.x, y: BAR_BOTTOM + 1 };
  const onBank = { x: HOME_LAYOUT.topBar.well.x + 1, y: HOME_LAYOUT.topBar.mid };
  const { dogSlots, topBar } = SCREEN_LAYOUT;
  const firstWell = walkBarLayout(topBar).effectWells[0] ?? topBar;

  // Anywhere on the screen but the panel and the top bar's buttons is outside.
  it.each([
    ["home: under the top bar, clear of its buttons", "home", underBank, true],
    ["home: on a button's tap area under the top bar", "home", underSettings, false],
    ["home: on a top bar button", "home", centres.help ?? underBank, false],
    ["home: on the top bar's bank", "home", onBank, true],
    ["walk: in the walk view", "walk", centre(SCREEN_LAYOUT.walkView), true],
    ["walk: on a dog card", "walk", centre(dogSlots[0] ?? topBar), true],
    ["walk: on a walk bar well", "walk", centre(firstWell), true],
    ["walk: on a walk bar button", "walk", centre(TOP_BAR_BUTTONS.pause.hit), false],
  ] as const)("regionOutside, %s", (_, region, point, outside) => {
    expect(isOutside(regionOutside(exit, region, []), point)).toBe(outside);
  });

  // The bar's buttons left to right, Exit last where it shows, and what a press finds on each.
  it("lists its buttons left to right, Exit last where it shows", () => {
    const order = ["logbook", "help", "mute", "settings", ...(exit ? ["exit"] : [])];
    expect(homeBarButtons(exit).map(([id]) => id)).toEqual(order);
  });

  it.each(HOME_BAR_BUTTONS.map((id) => [id, centres[id]] as const))(
    "homeBarButtonAt finds %s at its centre where it shows",
    (id, point) => {
      expect(point === undefined).toBe(id === "exit" && !exit);
      if (point !== undefined) {
        expect(homeBarButtonAt(exit, point.x, point.y)).toBe(id);
      }
    },
  );

  it("homeBarButtonAt finds nothing on the bank's well", () => {
    expect(homeBarButtonAt(exit, HOME_LAYOUT.topBar.well.x, HOME_LAYOUT.topBar.mid)).toBe(
      undefined,
    );
  });
});

// Where Exit shows, its column, the screen's last, holds Exit; where it is hidden, Settings.
describe("the top bar's last column", () => {
  const last = { x: SCREEN_LAYOUT.screen.width - 1, y: HOME_LAYOUT.topBar.mid };
  it.each([
    [true, "exit"],
    [false, "settings"],
  ] as const)("with Exit shown %s, holds %s", (exit, button) => {
    expect(homeBarButtonAt(exit, last.x, last.y)).toBe(button);
  });
});

describe("homeBarAction", () => {
  const NONE = { logbook: false, settings: false };
  const LOGBOOK = { logbook: true, settings: false };
  const SETTINGS = { logbook: false, settings: true };
  // open: which of the Logbook and the settings is open, over the start screen or the shop.
  it.each([
    ["neither open", NONE, "exit", "exit"],
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
    ["the Logbook open", LOGBOOK, "exit", "exit"],
    ["the settings open", SETTINGS, "exit", "exit"],
  ] satisfies readonly [string, typeof NONE, HomeBarButton, HomeBarAction][])(
    "with %s, %s does %s",
    (_, open, button, action) => {
      expect(homeBarAction(open, button)).toBe(action);
    },
  );
});

describe("homeBackAction", () => {
  it.each([
    [true, "closeDetail"],
    [false, "askQuit"],
  ] as const)("with a detail card open %s, back does %s", (detailOpen, action) => {
    expect(homeBackAction(detailOpen)).toBe(action);
  });
});
