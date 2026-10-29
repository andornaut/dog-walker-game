import type { Point, Rect } from "@andornaut/game-kit/rect";
import { describe, expect, it } from "vitest";

import { SCREEN_LAYOUT } from "../data/screen";
import { homeBarAction, homeBarButtonAt } from "../home/homeBar";
import { HOME_LAYOUT } from "../home/homeLayout";
import { NOTHING_PAUSED, type RunPause, topBarAction, topBarButtonAt, walkPresses } from "./topBar";
import { type ExplainShown, explainTargetAt, opensOnTap, WALK_BAR, walkBarLayout } from "./walkHud";

// Every target on a top bar acts as it does with nothing open, under every card and overlay
// that leaves the bar lit: a button does what its action says, and a well that explains itself
// opens its explanation. Help alone covers the walk bar.

const centre = (rect: Rect): Point => ({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 });

const { dogSlots, topBar } = SCREEN_LAYOUT;
const BAR = walkBarLayout(topBar);
const at = (rect: Rect): Rect => ({ ...rect, x: topBar.x + rect.x, y: topBar.y + rect.y });

// The walk shows the walker's perk, an upgrade and a gear item, and a dog in the first card.
const SHOWN: ExplainShown = {
  debuffs: [],
  dogs: ["kilo", undefined, undefined],
  effects: ["perk", "upgrade", "gear"],
};

const WALK_TARGETS = {
  cashWell: centre(at(WALK_BAR.cash.well)),
  dogCard: centre(dogSlots[0] ?? topBar),
  gearIcon: centre(BAR.effectWells[2] ?? topBar),
  help: centre(BAR.buttons.help.hit),
  pause: centre(BAR.buttons.pause.hit),
  perkIcon: centre(BAR.effectWells[0] ?? topBar),
  settings: centre(BAR.buttons.settings.hit),
  sound: centre(BAR.buttons.sound.hit),
  upgradeIcon: centre(BAR.effectWells[1] ?? topBar),
} as const;

type WalkTarget = keyof typeof WALK_TARGETS;

// What a press on the walk bar or a dog card does under pause: a button's tap action, else
// "explainOnTap" when a tap or a hold there opens an explanation, "explainOnHold" when only a
// hold does, else nothing.
function walkTargetAction(pause: RunPause, point: Point): string | undefined {
  const button = topBarButtonAt(point.x, point.y);
  if (button !== undefined) {
    return topBarAction(pause, "tap", button);
  }
  const presses = walkPresses(pause);
  if (presses === "none") {
    return undefined;
  }
  const target = explainTargetAt(SCREEN_LAYOUT, SHOWN, presses === "explain", point);
  if (target === undefined) {
    return undefined;
  }
  return opensOnTap(target) ? "explainOnTap" : "explainOnHold";
}

const WALK_MODALS: readonly (readonly [string, RunPause])[] = [
  ["nothing", NOTHING_PAUSED],
  ["a card or the zone celebration", { ...NOTHING_PAUSED, card: true }],
  ["the pause menu", { ...NOTHING_PAUSED, menu: "open" }],
  ["the pause menu over a card", { ...NOTHING_PAUSED, card: true, menu: "open" }],
  ["the Home question over a card", { ...NOTHING_PAUSED, card: true, menu: "confirmHome" }],
  ["the settings", { ...NOTHING_PAUSED, menu: "settings" }],
  ["the settings over a card", { ...NOTHING_PAUSED, card: true, menu: "settings" }],
  ["help", { ...NOTHING_PAUSED, menu: "help" }],
];

// Each target's action with nothing open; the rows below list only what differs.
const WALK_BASE: Readonly<Record<WalkTarget, string | undefined>> = {
  cashWell: undefined,
  dogCard: "explainOnHold",
  gearIcon: "explainOnTap",
  help: "openHelp",
  pause: "openMenu",
  perkIcon: "explainOnTap",
  settings: "openSettings",
  sound: "mute",
  upgradeIcon: "explainOnTap",
};

const WALK_CHANGES: Readonly<Record<string, Partial<Record<WalkTarget, string | undefined>>>> = {
  "a card or the zone celebration": {},
  help: {
    dogCard: undefined,
    gearIcon: undefined,
    help: undefined,
    pause: undefined,
    perkIcon: undefined,
    settings: undefined,
    sound: undefined,
    upgradeIcon: undefined,
  },
  nothing: {},
  "the Home question over a card": { pause: "resume" },
  "the pause menu": { pause: "resume" },
  "the pause menu over a card": { pause: "resume" },
  "the settings": { pause: "resume", settings: "closeSettings" },
  "the settings over a card": { pause: "resume", settings: "closeSettings" },
};

describe("the walk bar's and dog cards' targets under each overlay", () => {
  const rows = WALK_MODALS.flatMap(([modal, pause]) =>
    (Object.keys(WALK_TARGETS) as WalkTarget[]).map((target) => {
      const changes = WALK_CHANGES[modal] ?? {};
      const expected = target in changes ? changes[target] : WALK_BASE[target];
      return [modal, target, pause, expected] as const;
    }),
  );
  it.each(rows)("under %s, %s does %s", (_modal, target, pause, expected) => {
    expect(walkTargetAction(pause, WALK_TARGETS[target])).toBe(expected);
  });
});

// The home top bar on the start screen, the Pet shop and the Logbook: what is open over the page
// sets only whether the Logbook or the settings is the button's own page.
const HOME_TARGETS = {
  bankWell: { x: HOME_LAYOUT.topBar.well.x + 1, y: HOME_LAYOUT.topBar.mid },
  help: centre(HOME_LAYOUT.help.hit),
  logbook: centre(HOME_LAYOUT.logbook.hit),
  mute: centre(HOME_LAYOUT.mute.hit),
  settings: centre(HOME_LAYOUT.settings.hit),
} as const;

type HomeTarget = keyof typeof HOME_TARGETS;

const NONE = { logbook: false, settings: false };

const HOME_MODALS: readonly (readonly [string, typeof NONE])[] = [
  ["nothing on the start screen", NONE],
  ["a detail card on the start screen", NONE],
  ["the badge celebration", NONE],
  ["the Pet shop", NONE],
  ["a detail card in the Pet shop", NONE],
  ["a purchase confirm in the Pet shop", NONE],
  ["the Logbook", { logbook: true, settings: false }],
  ["a badge card in the Logbook", { logbook: true, settings: false }],
  ["the settings", { logbook: false, settings: true }],
  ["the settings' install steps", { logbook: false, settings: true }],
];

const HOME_BASE: Readonly<Record<HomeTarget, string | undefined>> = {
  bankWell: undefined,
  help: "openHelp",
  logbook: "openLogbook",
  mute: "mute",
  settings: "openSettings",
};

function homeTargetAction(open: typeof NONE, point: Point): string | undefined {
  const button = homeBarButtonAt(point.x, point.y);
  return button === undefined ? undefined : homeBarAction(open, button);
}

describe("the home top bar's targets under each overlay", () => {
  const rows = HOME_MODALS.flatMap(([modal, open]) =>
    (Object.keys(HOME_TARGETS) as HomeTarget[]).map((target) => {
      const own =
        (target === "logbook" && open.logbook) || (target === "settings" && open.settings);
      return [modal, target, open, own ? "close" : HOME_BASE[target]] as const;
    }),
  );
  it.each(rows)("under %s, %s does %s", (_modal, target, open, expected) => {
    expect(homeTargetAction(open, HOME_TARGETS[target])).toBe(expected);
  });
});
