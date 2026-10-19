import { describe, expect, it } from "vitest";

import {
  buttonIcon,
  gameplayAllowed,
  HOME_BUTTON,
  PAUSE_BUTTON,
  pauseButtonIcon,
  type RunPause,
  SOUND_BUTTON,
  TOP_BAR,
  TOP_BAR_BUTTONS,
  type TopBarAction,
  topBarAction,
  type TopBarButton,
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
    // What a tap on Home, a tap or key on pause, the M key and a tap on sound do.
    home: TopBarAction | undefined;
    pause: TopBarAction | undefined;
    mute: TopBarAction | undefined;
    sound: TopBarAction | undefined;
  }

  const walking = {
    covered: false,
    gameplay: false,
    home: "confirmHome",
    icon: "icon-pause",
    mute: "mute",
    pause: "openMenu",
    sound: "mute",
  } as const;
  const menu = { ...walking, covered: true, icon: "icon-play", pause: "resume" } as const;
  const confirm = { ...menu, home: undefined } as const;
  const cover = { ...confirm, pause: undefined, sound: undefined } as const;

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
      sound: topBarAction(pause, "tap", "sound"),
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

describe("the top bar's buttons", () => {
  // Each 20x20 face, 2px from the next, its icon at +2,+1, and its 44px-square hit area centred
  // on it from the top of the bar.
  it.each<[TopBarPress, TopBarButton, number]>([
    ["home", HOME_BUTTON, 130],
    ["sound", SOUND_BUTTON, 152],
    ["pause", PAUSE_BUTTON, 174],
  ])("puts %s's face at x %i", (press, button, x) => {
    expect(TOP_BAR_BUTTONS[press]).toBe(button);
    expect(button).toEqual({
      face: { x, y: 10 },
      hit: { height: 44, width: 44, x: x - 12, y: 0 },
    });
    expect(buttonIcon(button, false)).toEqual({ x: x + 2, y: 11 });
    expect(buttonIcon(button, true)).toEqual({ x: x + 2, y: 13 });
  });

  it("keeps the faces and the hit areas clear of the zone well", () => {
    for (const { face, hit } of Object.values(TOP_BAR_BUTTONS)) {
      expect(face.x + 20).toBeLessThan(TOP_BAR.zone.x);
      expect(hit.x + hit.width).toBeLessThanOrEqual(TOP_BAR.zone.x);
    }
  });
});

describe("topBarButtonAt", () => {
  // The outer corners of the hit areas, which reach 4px into the band, points just outside
  // them, and the overlaps, where the nearer face centre (140, 162 or 184) wins.
  it.each<[number, number, TopBarPress | undefined]>([
    [118, 0, "home"],
    [118, 43, "home"],
    [150, 20, "home"],
    [152, 20, "sound"],
    [162, 43, "sound"],
    [172, 20, "sound"],
    [174, 20, "pause"],
    [205, 43, "pause"],
    [140, 44, undefined],
    [117, 20, undefined],
    [206, 20, undefined],
    [300, 20, undefined],
  ])("finds at (%i, %i) the %s button", (x, y, expected) => {
    expect(topBarButtonAt(x, y)).toBe(expected);
  });
});
