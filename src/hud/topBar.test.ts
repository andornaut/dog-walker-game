import { describe, expect, it } from "vitest";

import { SCREEN_LAYOUT } from "../data/screen";
import type { PressMode } from "../input/pointerTracking";
import { containsPoint } from "../lib/rect";
import {
  gameplayAllowed,
  NOTHING_PAUSED,
  pauseButtonIcon,
  playerPaused,
  type RunPause,
  TOP_BAR_BUTTONS,
  type TopBarAction,
  topBarAction,
  topBarButtonAt,
  topBarButtonForKey,
  walkPaused,
  walkPresses,
} from "./topBar";
import { WALK_BAR, WALK_BAR_BUTTONS, type WalkBarButtonId, walkBarLayout } from "./walkHud";

// A card and the zone celebration hold the walk alike.
const CARD: RunPause = { ...NOTHING_PAUSED, card: true };
const HIT_STOP: RunPause = { ...NOTHING_PAUSED, hitStop: true };
const HOLD: RunPause = { ...NOTHING_PAUSED, hold: true };

describe("the walk bar in each pause state", () => {
  interface Expected {
    // The pause button's icon, and whether lane moves act.
    icon: "icon-pause" | "icon-play";
    gameplay: boolean;
    // What the walk's presses do: steer, only hold to explain, or nothing.
    presses: PressMode;
    // Whether the walk is paused, and whether by the player, which ducks the music.
    paused: boolean;
    player: boolean;
    // What a tap on pause, P, the M key, and a tap on sound, Help and Settings do.
    pause: TopBarAction | undefined;
    pauseKey: TopBarAction | undefined;
    mute: TopBarAction | undefined;
    help: TopBarAction | undefined;
    settings: TopBarAction | undefined;
    sound: TopBarAction | undefined;
  }

  const walking = {
    gameplay: false,
    help: "openHelp",
    icon: "icon-pause",
    mute: "mute",
    pause: "openMenu",
    pauseKey: "openMenu",
    paused: false,
    player: false,
    presses: "steer",
    settings: "openSettings",
    sound: "mute",
  } as const;
  const card = { ...walking, paused: true, presses: "none" } as const;
  // The menu and the Home question dim the walk only: a hold on the bar's wells explains.
  const menu = {
    ...walking,
    icon: "icon-play",
    pause: "resume",
    pauseKey: "resume",
    paused: true,
    player: true,
    presses: "explain",
  } as const;
  const cover = {
    ...menu,
    help: undefined,
    pause: undefined,
    pauseKey: undefined,
    presses: "none",
    settings: undefined,
    sound: undefined,
  } as const;
  // An explanation's detail card takes every tap on the bar to close it; the keys act.
  const detail = {
    ...walking,
    help: undefined,
    pause: undefined,
    paused: true,
    settings: undefined,
    sound: undefined,
  } as const;

  it("pauses, covers and routes the bar's presses as each state calls for", () => {
    const cases: [string, RunPause, Expected][] = [
      ["walking", NOTHING_PAUSED, { ...walking, gameplay: true }],
      ["under a card", CARD, card],
      ["through the hit stop", HIT_STOP, walking],
      ["under an explanation's detail card", HOLD, detail],
      ["with the tab hidden", { ...NOTHING_PAUSED, page: "hidden" }, { ...walking, paused: true }],
      ["out of focus", { ...NOTHING_PAUSED, page: "blurred" }, { ...walking, paused: true }],
      [
        "in the menu with the tab hidden",
        { ...NOTHING_PAUSED, menu: "open", page: "hidden" },
        menu,
      ],
      ["in the menu over a card", { ...CARD, menu: "open" }, menu],
      ["in the menu over the hit stop", { ...HIT_STOP, menu: "open" }, menu],
      ["asking whether to head home over a card", { ...CARD, menu: "confirmHome" }, menu],
      [
        "under an explanation's detail card over the menu",
        { ...HOLD, menu: "open" },
        { ...menu, help: undefined, pause: undefined, settings: undefined, sound: undefined },
      ],
      ["under help, which mutes on M", { ...NOTHING_PAUSED, menu: "help" }, cover],
      [
        "under settings, which leaves M to its own sound switch",
        { ...NOTHING_PAUSED, menu: "settings" },
        { ...cover, mute: undefined },
      ],
    ];
    for (const [name, pause, expected] of cases) {
      expect(
        {
          gameplay: gameplayAllowed(pause),
          help: topBarAction(pause, "tap", "help"),
          icon: pauseButtonIcon(pause),
          mute: topBarAction(pause, "key", "sound"),
          pause: topBarAction(pause, "tap", "pause"),
          pauseKey: topBarAction(pause, "key", "pause"),
          paused: walkPaused(pause),
          player: playerPaused(pause),
          presses: walkPresses(pause),
          settings: topBarAction(pause, "tap", "settings"),
          sound: topBarAction(pause, "tap", "sound"),
        },
        name,
      ).toEqual(expected);
    }
  });
});

describe("topBarButtonForKey", () => {
  it("maps M to sound and P or Escape to pause, in either case, and ignores repeats", () => {
    const keys: Record<string, WalkBarButtonId | undefined> = {
      "1": undefined,
      ArrowLeft: undefined,
      Escape: "pause",
      M: "sound",
      P: "pause",
      m: "sound",
      p: "pause",
    };
    for (const [key, button] of Object.entries(keys)) {
      expect(topBarButtonForKey(false, key), key).toBe(button);
      expect(topBarButtonForKey(true, key), key).toBeUndefined();
    }
  });
});

describe("the walk bar's buttons", () => {
  it("sets each face in a thumb-wide hit area, left to right, none over the next or the wells", () => {
    const { topBar } = SCREEN_LAYOUT;
    const bar = walkBarLayout(topBar);
    const hits = WALK_BAR_BUTTONS.map((id) => TOP_BAR_BUTTONS[id].hit);
    hits.slice(1).forEach((hit, i) => {
      expect(hit.x).toBeGreaterThanOrEqual((hits[i]?.x ?? 0) + (hits[i]?.width ?? 0));
    });
    const last = hits.at(-1);
    expect((last?.x ?? 0) + (last?.width ?? 0)).toBeLessThanOrEqual(topBar.x + topBar.width);
    const size = WALK_BAR.buttonFace.size;
    for (const { face, hit } of Object.values(TOP_BAR_BUTTONS)) {
      expect(hit.width).toBeGreaterThanOrEqual(WALK_BAR.minHitWidth);
      expect(face.x).toBeGreaterThanOrEqual(hit.x);
      expect(face.x + size).toBeLessThanOrEqual(hit.x + hit.width);
      expect(face.y + size).toBeLessThanOrEqual(topBar.y + topBar.height);
      for (const well of [bar.zoneWell, ...bar.effectWells, ...bar.effectHolds]) {
        expect(well.x + well.width).toBeLessThanOrEqual(hit.x);
      }
    }
  });
});

describe("topBarButtonAt", () => {
  it("finds each button at its hit area's corners, and none just outside the row", () => {
    for (const id of WALK_BAR_BUTTONS) {
      const { hit } = TOP_BAR_BUTTONS[id];
      for (const [x, y] of [
        [hit.x, hit.y],
        [hit.x + hit.width - 1, hit.y + hit.height - 1],
      ] as const) {
        expect(topBarButtonAt(x, y), id).toBe(id);
        expect(containsPoint(hit, x, y)).toBe(true);
      }
    }
    const first = TOP_BAR_BUTTONS[WALK_BAR_BUTTONS[0]].hit;
    expect(topBarButtonAt(first.x - 1, first.y)).toBeUndefined();
    expect(topBarButtonAt(first.x, first.y + first.height)).toBeUndefined();
  });
});
