import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { fittingTextStyle, TEXT_FIT_STYLES, type TextFitStyle } from "../layout/textFit";
import { read } from "../rules/units";
import {
  buttonIcon,
  DOLLAR_GAP,
  gameplayAllowed,
  HOME_BUTTON,
  MONEY_WELL,
  moneyTop,
  PAUSE_BUTTON,
  pauseButtonIcon,
  playerPaused,
  pressesHeld,
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
  TREAT_WELL,
  walkCovered,
  walkPaused,
  WELL_INSET,
} from "./topBar";

const WALKING: RunPause = {
  card: false,
  hitStop: false,
  menu: "closed",
  page: "shown",
  stripBubble: false,
};
// A card and the zone celebration hold the walk alike.
const CARD: RunPause = { ...WALKING, card: true };
const HIT_STOP: RunPause = { ...WALKING, hitStop: true };

describe("the top bar in each pause state", () => {
  interface Expected {
    // The pause button's icon, and whether lane moves and treats act.
    icon: "icon-pause" | "icon-play";
    gameplay: boolean;
    // Whether a card or a menu takes the walk's presses, and whether the walk drops them.
    covered: boolean;
    held: boolean;
    // Whether the walk is paused, and whether by the player, which ducks the music.
    paused: boolean;
    player: boolean;
    // What a tap on Home, a tap or key on pause, the M key and a tap on sound do.
    home: TopBarAction | undefined;
    pause: TopBarAction | undefined;
    mute: TopBarAction | undefined;
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
    sound: "mute",
  } as const;
  const card = { ...walking, covered: true, held: true, paused: true } as const;
  const menu = { ...card, icon: "icon-play", pause: "resume", player: true } as const;
  const confirm = { ...menu, home: undefined } as const;
  const cover = { ...confirm, pause: undefined, sound: undefined } as const;

  it.each<[string, RunPause, Expected]>([
    ["walking", WALKING, { ...walking, gameplay: true }],
    ["under a card", CARD, card],
    ["through the hit stop", HIT_STOP, walking],
    [
      "under the strip's bubble",
      { ...WALKING, stripBubble: true },
      { ...walking, held: true, paused: true, player: true },
    ],
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

// The title font's glyphs, from its .fnt: each one's left side bearing, inked width and advance.
const TITLE_FNT = new URL("../../public/art/fonts/font-title.fnt", import.meta.url);
const TITLE_GLYPHS = new Map(
  [
    ...readFileSync(TITLE_FNT, "utf8").matchAll(
      /<char id="(\d+)"[^>]*\bwidth="(\d+)"[^>]*\bxoffset="(-?\d+)"[^>]*\bxadvance="(\d+)"/g,
    ),
  ].map(([, id, width, xOffset, advance]) => [
    String.fromCodePoint(Number(id)),
    { advance: Number(advance), width: Number(width), xOffset: Number(xOffset) },
  ]),
);

// The screen columns text inks at a style, from its left edge, as Phaser lays it out.
function titleInk(style: TextFitStyle, text: string): { left: number; right: number } {
  let x = 0;
  const spans = [...text].map((char) => {
    const glyph = TITLE_GLYPHS.get(char);
    if (glyph === undefined) {
      throw new Error(`font-title has no ${char}`);
    }
    const span = { left: x + glyph.xOffset, right: x + glyph.xOffset + glyph.width };
    x += glyph.advance + style.letterSpacing;
    return span;
  });
  const left = Math.min(...spans.map((span) => span.left));
  const right = Math.max(...spans.map((span) => span.right));
  return { left: left * style.scale, right: right * style.scale };
}

describe("the money well", () => {
  const dollarRight = MONEY_WELL.dollarX + titleInk({ letterSpacing: 0, scale: 2 }, "$").right;
  const room = TOP_BAR.money.x + TOP_BAR.money.width - WELL_INSET - (dollarRight + DOLLAR_GAP);
  const inkWidth = (amount: string) => (style: TextFitStyle) => {
    const ink = titleInk(style, amount);
    return ink.right - ink.left;
  };

  it.each<[string, TextFitStyle]>([
    ["0", { letterSpacing: 0, scale: 2 }],
    ["9999", { letterSpacing: 0, scale: 2 }],
    ["49695", { letterSpacing: -1, scale: 2 }],
    ["999999", { letterSpacing: 0, scale: 1 }],
  ])("sets $%s at %o, inside the well", (amount, expected) => {
    const style = fittingTextStyle(TEXT_FIT_STYLES, inkWidth(amount), room);
    expect(style).toEqual(expected);
    expect(inkWidth(amount)(style)).toBeLessThanOrEqual(room);
  });

  it.each([1, 2])("keeps the amount's capitals' bottom row on the $'s at %ix", (scale) => {
    expect(moneyTop(scale) + MONEY_WELL.capRows * scale).toBe(
      MONEY_WELL.top + MONEY_WELL.capRows * 2,
    );
  });
});

describe("the treat well", () => {
  const max = read(gameData.tuning, "counts", "treatCarryMax");

  it.each(Array.from({ length: max + 1 }, (_, count) => `${count}/${max}`))(
    "fits %s under the icon, inside the well",
    (count) => {
      const ink = titleInk(TREAT_WELL.countStyle, count);
      const well = TOP_BAR.treats;
      const bottom = TREAT_WELL.countTop + MONEY_WELL.capRows * TREAT_WELL.countStyle.scale;
      expect(ink.right - ink.left).toBeLessThanOrEqual(well.width - 2 * WELL_INSET);
      expect(bottom).toBeLessThanOrEqual(well.y + well.height - WELL_INSET);
    },
  );
});
