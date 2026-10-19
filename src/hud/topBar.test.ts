import { describe, expect, it } from "vitest";

import {
  buttonIcon,
  gameplayAllowed,
  HOME_BUTTON,
  PAUSE_BUTTON,
  pauseButtonIcon,
  type RunPause,
  type TopBarAction,
  topBarAction,
  topBarButtonAt,
  topBarButtonForKey,
  type TopBarPress,
  walkCovered,
} from "./topBar";

const WALKING: RunPause = { card: false, hitStop: false, menu: "closed" };
const CARD: RunPause = { ...WALKING, card: true };
const HIT_STOP: RunPause = { ...WALKING, hitStop: true };

describe("the top bar in each pause state", () => {
  interface Expected {
    // The pause button's icon, and whether lane moves and treats act.
    icon: "icon-pause" | "icon-play";
    gameplay: boolean;
    // Whether a card or a menu takes the walk's presses.
    covered: boolean;
    // What a tap on Home, a tap or key on pause, and the M key do.
    home: TopBarAction | undefined;
    pause: TopBarAction | undefined;
    mute: TopBarAction | undefined;
  }

  const walking = {
    covered: false,
    gameplay: false,
    home: "confirmHome",
    icon: "icon-pause",
    mute: "mute",
    pause: "openMenu",
  } as const;
  const menu = { ...walking, covered: true, icon: "icon-play", pause: "resume" } as const;
  const confirm = { ...menu, home: undefined } as const;
  const cover = { ...confirm, pause: undefined } as const;

  it.each<[string, RunPause, Expected]>([
    ["walking", WALKING, { ...walking, gameplay: true }],
    ["under a card", CARD, { ...walking, covered: true }],
    ["through the hit stop", HIT_STOP, walking],
    ["in the menu", { ...WALKING, menu: "open" }, menu],
    ["in the menu over a card", { ...CARD, menu: "open" }, menu],
    ["in the menu over the hit stop", { ...HIT_STOP, menu: "open" }, menu],
    ["asking whether to head home", { ...WALKING, menu: "confirmHome" }, confirm],
    ["asking whether to head home over a card", { ...CARD, menu: "confirmHome" }, confirm],
    ["under help, which mutes on M", { ...WALKING, menu: "help" }, cover],
    [
      "under settings, which leaves M to its own sound switch",
      { ...WALKING, menu: "settings" },
      { ...cover, mute: undefined },
    ],
  ])("acts as it should %s", (_name, pause, expected) => {
    const tapPause = topBarAction(pause, "tap", "pause");
    expect(topBarAction(pause, "key", "pause")).toBe(tapPause);
    expect({
      covered: walkCovered(pause),
      gameplay: gameplayAllowed(pause),
      home: topBarAction(pause, "tap", "home"),
      icon: pauseButtonIcon(pause),
      mute: topBarAction(pause, "key", "sound"),
      pause: tapPause,
    }).toEqual(expected);
  });
});

describe("topBarButtonForKey", () => {
  it.each<[string, boolean, Record<string, TopBarPress | undefined>]>([
    [
      "maps M to sound and P or Escape to pause, in either case, and nothing else",
      false,
      {
        "1": undefined,
        ArrowLeft: undefined,
        Escape: "pause",
        M: "sound",
        P: "pause",
        m: "sound",
        p: "pause",
      },
    ],
    ["ignores a held key's repeats", true, { Escape: undefined, m: undefined }],
  ])("%s", (_name, repeat, expected) => {
    for (const [key, button] of Object.entries(expected)) {
      expect(topBarButtonForKey(repeat, key), key).toBe(button);
    }
  });
});

describe("topBarButtonAt", () => {
  // The corners of each 44px hit area, which reaches 4px into the band, and points just outside
  // them; the sound button is gone from the bar.
  it.each<[number, number, TopBarPress | undefined]>([
    [118, 0, "home"],
    [161, 43, "home"],
    [162, 0, "pause"],
    [205, 43, "pause"],
    [140, 44, undefined],
    [117, 20, undefined],
    [206, 20, undefined],
    [300, 20, undefined],
  ])("finds at (%i, %i) the %s button", (x, y, expected) => {
    expect(topBarButtonAt(x, y)).toBe(expected);
  });

  it("keeps both hit areas at least 44px square, without overlapping", () => {
    for (const { hit } of [HOME_BUTTON, PAUSE_BUTTON]) {
      expect(Math.min(hit.width, hit.height)).toBeGreaterThanOrEqual(44);
    }
    expect(HOME_BUTTON.hit.x + HOME_BUTTON.hit.width).toBeLessThanOrEqual(PAUSE_BUTTON.hit.x);
  });
});

describe("buttonIcon", () => {
  it("centres the 16px icons on x 140 and 184, 2px lower while pressed", () => {
    expect(buttonIcon(HOME_BUTTON, false)).toEqual({ x: 132, y: 11 });
    expect(buttonIcon(PAUSE_BUTTON, false)).toEqual({ x: 176, y: 11 });
    expect(buttonIcon(PAUSE_BUTTON, true)).toEqual({ x: 176, y: 13 });
  });
});
