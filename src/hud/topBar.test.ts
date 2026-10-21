import { describe, expect, it } from "vitest";

import { SCREEN_CONFIG } from "../data/screen";
import { containsPoint } from "../layout/rect";
import { screenLayout } from "../layout/screenLayout";
import {
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
  walkPaused,
} from "./topBar";
import { WALK_BAR, WALK_BAR_BUTTONS, walkBarLayout } from "./walkHud";

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
    // Whether a card or a menu takes the walk's presses, so the walk drops them.
    held: boolean;
    // Whether the walk is paused, and whether by the player, which ducks the music.
    paused: boolean;
    player: boolean;
    // What a tap on Home, a tap or key on pause, the M key, and a tap on sound, Help and Settings
    // do.
    home: TopBarAction | undefined;
    pause: TopBarAction | undefined;
    mute: TopBarAction | undefined;
    help: TopBarAction | undefined;
    settings: TopBarAction | undefined;
    sound: TopBarAction | undefined;
  }

  const walking = {
    gameplay: false,
    held: false,
    help: "openHelp",
    home: "confirmHome",
    icon: "icon-pause",
    mute: "mute",
    pause: "openMenu",
    paused: false,
    player: false,
    settings: "openSettings",
    sound: "mute",
  } as const;
  const card = { ...walking, held: true, paused: true } as const;
  const menu = { ...card, icon: "icon-play", pause: "resume", player: true } as const;
  const confirm = { ...menu, home: undefined } as const;
  const cover = {
    ...confirm,
    help: undefined,
    pause: undefined,
    settings: undefined,
    sound: undefined,
  } as const;

  it("pauses, covers and routes the bar's presses as each state calls for", () => {
    const cases: [string, RunPause, Expected][] = [
      ["walking", WALKING, { ...walking, gameplay: true }],
      ["under a card", CARD, card],
      ["through the hit stop", HIT_STOP, walking],
      ["while a press holds an explanation", HOLD, { ...walking, paused: true }],
      ["with the tab hidden", { ...WALKING, page: "hidden" }, { ...walking, paused: true }],
      ["out of focus", { ...WALKING, page: "blurred" }, { ...walking, paused: true }],
      ["in the menu with the tab hidden", { ...WALKING, menu: "open", page: "hidden" }, menu],
      ["in the menu over a card", { ...CARD, menu: "open" }, menu],
      ["in the menu over the hit stop", { ...HIT_STOP, menu: "open" }, menu],
      ["asking whether to head home over a card", { ...CARD, menu: "confirmHome" }, confirm],
      ["under help, which mutes on M", { ...WALKING, menu: "help" }, cover],
      [
        "under settings, which leaves M to its own sound switch",
        { ...WALKING, menu: "settings" },
        { ...cover, mute: undefined },
      ],
    ];
    for (const [name, pause, expected] of cases) {
      const tapPause = topBarAction(pause, "tap", "pause");
      expect(topBarAction(pause, "key", "pause"), name).toBe(tapPause);
      expect(
        {
          gameplay: gameplayAllowed(pause),
          held: pressesHeld(pause),
          help: topBarAction(pause, "tap", "help"),
          home: topBarAction(pause, "tap", "home"),
          icon: pauseButtonIcon(pause),
          mute: topBarAction(pause, "key", "sound"),
          pause: tapPause,
          paused: walkPaused(pause),
          player: playerPaused(pause),
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
    const keys: Record<string, TopBarPress | undefined> = {
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
    const { topBar } = screenLayout(SCREEN_CONFIG);
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
