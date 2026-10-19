import { describe, expect, it } from "vitest";

import {
  buttonIcon,
  gameplayAllowed,
  HOME_BUTTON,
  PAUSE_BUTTON,
  pauseButtonIcon,
  type RunPause,
  topBarAction,
  topBarButtonAt,
  topBarButtonForKey,
  walkCovered,
} from "./topBar";

const WALKING: RunPause = { card: false, hitStop: false, menu: "closed" };
const CARD: RunPause = { ...WALKING, card: true };
const HIT_STOP: RunPause = { ...WALKING, hitStop: true };
const MENU: RunPause = { ...WALKING, menu: "open" };
const MENU_OVER_CARD: RunPause = { ...CARD, menu: "open" };
const MENU_OVER_HIT_STOP: RunPause = { ...HIT_STOP, menu: "open" };
const CONFIRM: RunPause = { ...WALKING, menu: "confirmHome" };
const CONFIRM_OVER_CARD: RunPause = { ...CARD, menu: "confirmHome" };
const HELP: RunPause = { ...WALKING, menu: "help" };
const SETTINGS: RunPause = { ...WALKING, menu: "settings" };
const HELD = [
  CARD,
  HIT_STOP,
  MENU,
  MENU_OVER_CARD,
  MENU_OVER_HIT_STOP,
  CONFIRM,
  CONFIRM_OVER_CARD,
  HELP,
  SETTINGS,
];

describe("pauseButtonIcon", () => {
  it("shows play while the pause menu or Home's question is up, under help or settings too", () => {
    for (const pause of [MENU, MENU_OVER_CARD, CONFIRM, HELP, SETTINGS]) {
      expect(pauseButtonIcon(pause)).toBe("icon-play");
    }
  });

  it("shows pause while walking, under a card and through the hit stop", () => {
    for (const pause of [WALKING, CARD, HIT_STOP]) {
      expect(pauseButtonIcon(pause)).toBe("icon-pause");
    }
  });
});

describe("gameplayAllowed", () => {
  it("lets lane moves and treats act only while walking", () => {
    expect(gameplayAllowed(WALKING)).toBe(true);
    for (const pause of HELD) {
      expect(gameplayAllowed(pause)).toBe(false);
    }
  });
});

describe("walkCovered", () => {
  it("is true while a card or a menu takes the walk's presses, and not through a hit stop", () => {
    expect(walkCovered(WALKING)).toBe(false);
    expect(walkCovered(HIT_STOP)).toBe(false);
    for (const pause of [CARD, MENU, MENU_OVER_CARD, MENU_OVER_HIT_STOP, HELP, SETTINGS]) {
      expect(walkCovered(pause)).toBe(true);
    }
  });
});

describe("topBarAction", () => {
  it("mutes from M whenever the bar is in view", () => {
    for (const pause of [WALKING, CARD, HIT_STOP, MENU, MENU_OVER_CARD, CONFIRM]) {
      expect(topBarAction(pause, "key", "sound")).toBe("mute");
    }
  });

  it("asks whether to head home from Home, while walking, over a card or from the menu", () => {
    for (const pause of [WALKING, CARD, HIT_STOP, MENU, MENU_OVER_CARD]) {
      expect(topBarAction(pause, "tap", "home")).toBe("confirmHome");
    }
  });

  it("leaves the question up when Home is tapped again", () => {
    expect(topBarAction(CONFIRM, "tap", "home")).toBeUndefined();
  });

  it("opens the menu while walking, over a card and through the hit stop", () => {
    for (const pause of [WALKING, CARD, HIT_STOP]) {
      expect(topBarAction(pause, "tap", "pause")).toBe("openMenu");
      expect(topBarAction(pause, "key", "pause")).toBe("openMenu");
    }
  });

  it("resumes while the menu or the question is up, over a card or the hit stop too", () => {
    for (const pause of [MENU, MENU_OVER_CARD, MENU_OVER_HIT_STOP, CONFIRM, CONFIRM_OVER_CARD]) {
      expect(topBarAction(pause, "tap", "pause")).toBe("resume");
      expect(topBarAction(pause, "key", "pause")).toBe("resume");
    }
  });

  it("leaves taps and the pause keys to help and settings, which cover the bar", () => {
    for (const pause of [HELP, SETTINGS]) {
      expect(topBarAction(pause, "tap", "home")).toBeUndefined();
      expect(topBarAction(pause, "tap", "pause")).toBeUndefined();
      expect(topBarAction(pause, "key", "pause")).toBeUndefined();
    }
  });

  it("mutes on M under help, and leaves M to settings' own sound switch", () => {
    expect(topBarAction(HELP, "key", "sound")).toBe("mute");
    expect(topBarAction(SETTINGS, "key", "sound")).toBeUndefined();
  });
});

describe("topBarButtonForKey", () => {
  it("maps M to sound and P or Escape to pause, in either case", () => {
    expect(topBarButtonForKey(false, "m")).toBe("sound");
    expect(topBarButtonForKey(false, "M")).toBe("sound");
    expect(topBarButtonForKey(false, "p")).toBe("pause");
    expect(topBarButtonForKey(false, "P")).toBe("pause");
    expect(topBarButtonForKey(false, "Escape")).toBe("pause");
  });

  it("ignores a held key's repeats and every other key", () => {
    expect(topBarButtonForKey(true, "m")).toBeUndefined();
    expect(topBarButtonForKey(true, "Escape")).toBeUndefined();
    expect(topBarButtonForKey(false, "ArrowLeft")).toBeUndefined();
    expect(topBarButtonForKey(false, "1")).toBeUndefined();
  });
});

describe("topBarButtonAt", () => {
  it("finds the Home and pause buttons over their 44px hit areas", () => {
    expect(topBarButtonAt(118, 0)).toBe("home");
    expect(topBarButtonAt(161, 43)).toBe("home");
    expect(topBarButtonAt(162, 0)).toBe("pause");
    expect(topBarButtonAt(205, 43)).toBe("pause");
  });

  it("reaches 4px into the band and no further", () => {
    expect(topBarButtonAt(140, 43)).toBe("home");
    expect(topBarButtonAt(140, 44)).toBeUndefined();
  });

  it("finds no button elsewhere on the bar, the sound button gone from it", () => {
    expect(topBarButtonAt(60, 20)).toBeUndefined();
    expect(topBarButtonAt(117, 20)).toBeUndefined();
    expect(topBarButtonAt(206, 20)).toBeUndefined();
    expect(topBarButtonAt(300, 20)).toBeUndefined();
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
