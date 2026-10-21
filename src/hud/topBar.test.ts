import { describe, expect, it } from "vitest";

import { SCREEN_CONFIG } from "../data/screen";
import { containsPoint } from "../layout/rect";
import { screenLayout } from "../layout/screenLayout";
import {
  buttonIcon,
  gameplayAllowed,
  pauseButtonIcon,
  playerPaused,
  pressesHeld,
  type RunPause,
  TOP_BAR_BUTTONS,
  type TopBarAction,
  topBarAction,
  topBarButtonAt,
  topBarButtonForKey,
  type TopBarPress,
  walkCovered,
  walkPaused,
} from "./topBar";
import { WALK_BAR_BUTTONS, walkBarLayout } from "./walkHud";

const WALKING: RunPause = {
  card: false,
  hitStop: false,
  hold: false,
  menu: "closed",
  page: "shown",
};
// A card and the zone celebration hold the walk alike.
const CARD: RunPause = { ...WALKING, card: true };
const HIT_STOP: RunPause = { ...WALKING, hitStop: true };
const HOLD: RunPause = { ...WALKING, hold: true };

describe("the walk bar in each pause state", () => {
  interface Expected {
    // The pause button's icon, and whether lane moves act.
    icon: "icon-pause" | "icon-play";
    gameplay: boolean;
    // Whether a card or a menu takes the walk's presses, and whether the walk drops them.
    covered: boolean;
    held: boolean;
    // Whether the walk is paused, and whether by the player, which ducks the music.
    paused: boolean;
    player: boolean;
    // What a tap on Home, a tap or key on pause, the M key, and a tap on sound and on Settings
    // do.
    home: TopBarAction | undefined;
    pause: TopBarAction | undefined;
    mute: TopBarAction | undefined;
    settings: TopBarAction | undefined;
    sound: TopBarAction | undefined;
  }

  const walking = {
    covered: false,
    gameplay: false,
    held: false,
    home: "confirmHome",
    icon: "icon-pause",
    mute: "mute",
    pause: "openMenu",
    paused: false,
    player: false,
    settings: "openSettings",
    sound: "mute",
  } as const;
  const card = { ...walking, covered: true, held: true, paused: true } as const;
  const menu = { ...card, icon: "icon-play", pause: "resume", player: true } as const;
  const confirm = { ...menu, home: undefined } as const;
  const cover = { ...confirm, pause: undefined, settings: undefined, sound: undefined } as const;

  it.each<[string, RunPause, Expected]>([
    ["walking", WALKING, { ...walking, gameplay: true }],
    ["under a card", CARD, card],
    ["through the hit stop", HIT_STOP, walking],
    ["while a press holds an explanation, keeping its press", HOLD, { ...walking, paused: true }],
    ["with the tab hidden", { ...WALKING, page: "hidden" }, { ...walking, paused: true }],
    ["with the window out of focus", { ...WALKING, page: "blurred" }, { ...walking, paused: true }],
    ["in the menu with the tab hidden", { ...WALKING, menu: "open", page: "hidden" }, menu],
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
      held: pressesHeld(pause),
      home: topBarAction(pause, "tap", "home"),
      icon: pauseButtonIcon(pause),
      mute: topBarAction(pause, "key", "sound"),
      pause: tapPause,
      paused: walkPaused(pause),
      player: playerPaused(pause),
      settings: topBarAction(pause, "tap", "settings"),
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

describe("the walk bar's buttons", () => {
  const { topBar } = screenLayout(SCREEN_CONFIG);
  const bar = walkBarLayout(topBar);

  it("are the walk bar layout's, left to right, the last ending on the bar's right edge", () => {
    expect(TOP_BAR_BUTTONS).toEqual(bar.buttons);
    const hits = WALK_BAR_BUTTONS.map((id) => TOP_BAR_BUTTONS[id].hit);
    hits.slice(1).forEach((hit, i) => {
      expect(hit.x).toBe((hits[i]?.x ?? 0) + (hits[i]?.width ?? 0));
    });
    const last = hits.at(-1);
    expect((last?.x ?? 0) + (last?.width ?? 0)).toBe(topBar.x + topBar.width);
  });

  it.each(WALK_BAR_BUTTONS.map((id) => [id] as const))(
    "centres %s's face in its 44px hit area on the bar, its icon 2px in and 1px down",
    (id) => {
      const { face, hit } = TOP_BAR_BUTTONS[id];
      expect([hit.width, hit.height]).toEqual([44, 44]);
      expect(hit.y).toBe(topBar.y);
      expect(face.x - hit.x).toBe((hit.width - 20) / 2);
      expect(face.y + 20).toBeLessThanOrEqual(topBar.y + topBar.height);
      expect(buttonIcon(TOP_BAR_BUTTONS[id], false)).toEqual({ x: face.x + 2, y: face.y + 1 });
      expect(buttonIcon(TOP_BAR_BUTTONS[id], true)).toEqual({ x: face.x + 2, y: face.y + 3 });
    },
  );

  it("keeps the hit areas clear of the neighbourhood well and the effect wells", () => {
    for (const { hit } of Object.values(TOP_BAR_BUTTONS)) {
      for (const well of [bar.zoneWell, ...bar.effectWells, ...bar.effectHolds]) {
        expect(well.x + well.width).toBeLessThanOrEqual(hit.x);
      }
    }
  });
});

describe("topBarButtonAt", () => {
  // Each hit area's corners, and points just outside the row of them.
  const corners = WALK_BAR_BUTTONS.flatMap((id): [number, number, TopBarPress | undefined][] => {
    const { hit } = TOP_BAR_BUTTONS[id];
    return [
      [hit.x, hit.y, id],
      [hit.x + hit.width - 1, hit.y + hit.height - 1, id],
    ];
  });
  const first = TOP_BAR_BUTTONS[WALK_BAR_BUTTONS[0]].hit;
  it.each<[number, number, TopBarPress | undefined]>([
    ...corners,
    [first.x - 1, first.y, undefined],
    [first.x, first.y + first.height, undefined],
  ])("finds at (%i, %i) the %s button", (x, y, expected) => {
    expect(topBarButtonAt(x, y)).toBe(expected);
    if (expected !== undefined) {
      expect(containsPoint(TOP_BAR_BUTTONS[expected].hit, x, y)).toBe(true);
    }
  });
});
