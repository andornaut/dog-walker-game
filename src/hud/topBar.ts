import { isMuteKey, isPauseKey } from "../input/keyBindings";
import { containsPoint, type Point, type Rect } from "../layout/rect";

// The run's top bar, as ui-top-bar draws it: the money, treat and zone wells. The zone's
// name is right-aligned at zone.nameRight.
export const TOP_BAR = {
  money: { height: 26, width: 88, x: 4, y: 8 },
  treats: { height: 26, width: 32, x: 96, y: 8 },
  zone: { height: 29, nameRight: 352, width: 144, x: 212, y: 5 },
} as const;

// Text in a well keeps this many pixels clear of the well's edges, and 2px of ink separate the
// money's "$" from its amount.
export const WELL_INSET = 2;
export const DOLLAR_GAP = 2;

// A well's text: its scale and the font pixels added between glyphs.
export interface WellTextStyle {
  letterSpacing: number;
  scale: number;
}

// The money well's "$" at 2x from dollarX, the top of its capitals at top. The amount's
// capitals, capRows font pixels tall, end on the same row as the "$"'s at any scale.
export const MONEY_WELL = { capRows: 5, dollarX: TOP_BAR.money.x + 22, top: TOP_BAR.money.y + 7 };

// The amount's capitals' top at scale.
export function moneyTop(scale: number): number {
  return MONEY_WELL.top + MONEY_WELL.capRows * (2 - scale);
}

// The bank's amount at 2x, then at 2x with its glyphs a font pixel closer, then at 1x.
export const MONEY_TEXT_STYLES: readonly WellTextStyle[] = [
  { letterSpacing: 0, scale: 2 },
  { letterSpacing: -1, scale: 2 },
  { letterSpacing: 0, scale: 1 },
];

// The first style whose ink, measured by inkWidth, is no wider than room; the last when none is.
export function fittingWellStyle(
  styles: readonly WellTextStyle[],
  inkWidth: (style: WellTextStyle) => number,
  room: number,
): WellTextStyle {
  return styles.find((style) => inkWidth(style) <= room) ?? (styles.at(-1) as WellTextStyle);
}

// The treat well stacks the 16px treat icon, its bone in rows 4 to 10, over the count, such as
// 0/3, both centred across the well. The count is at 2x with its glyphs a font pixel closer, so
// it keeps WELL_INSET clear of the well's sides, and its capitals start 2px under the bone.
export const TREAT_WELL = {
  countTop: TOP_BAR.treats.y + 13,
  countStyle: { letterSpacing: -1, scale: 2 },
  icon: { x: TOP_BAR.treats.x + (TOP_BAR.treats.width - 16) / 2, y: TOP_BAR.treats.y },
} as const;

// A top-bar button: its 20x20 face, and a 44px-square hit area so a thumb finds it. The faces
// sit 2px apart, so neighbouring hit areas overlap, and a press where they do is the button
// whose face centre is nearer. A press in any of them is that button's and never a road
// gesture. Home's reaches over the treat well, which takes no taps, and pause's ends at
// x=206, clear of the zone well and the state strip.
export interface TopBarButton {
  face: Point;
  hit: Rect;
}

const FACE = 20;
const HIT = 44;

function topBarButton(x: number, y: number): TopBarButton {
  const inset = (HIT - FACE) / 2;
  return { face: { x, y }, hit: { height: HIT, width: HIT, x: x - inset, y: 0 } };
}

export const HOME_BUTTON = topBarButton(130, 10);
export const SOUND_BUTTON = topBarButton(152, 10);
export const PAUSE_BUTTON = topBarButton(174, 10);

// "sound" toggles mute, as the M key and the Settings switch do.
export type TopBarPress = "home" | "pause" | "sound";

export const TOP_BAR_BUTTONS: Readonly<Record<TopBarPress, TopBarButton>> = {
  home: HOME_BUTTON,
  pause: PAUSE_BUTTON,
  sound: SOUND_BUTTON,
};

// The icon sits on the button's face, 2px lower while pressed.
export function buttonIcon(button: TopBarButton, pressed: boolean): Point {
  return { x: button.face.x + 2, y: button.face.y + (pressed ? 3 : 1) };
}

// The button a press at (x, y) lands on, if any: of the hit areas holding it, the one whose
// face centre is nearest across.
export function topBarButtonAt(x: number, y: number): TopBarPress | undefined {
  let found: { distance: number; press: TopBarPress } | undefined;
  for (const [press, button] of Object.entries(TOP_BAR_BUTTONS) as [TopBarPress, TopBarButton][]) {
    if (!containsPoint(button.hit, x, y)) {
      continue;
    }
    const distance = Math.abs(x - (button.face.x + FACE / 2));
    if (found === undefined || distance < found.distance) {
      found = { distance, press };
    }
  }
  return found?.press;
}

// M mutes, and P and Escape are the pause button's. A held key's repeats press nothing.
export function topBarButtonForKey(repeat: boolean, key: string): TopBarPress | undefined {
  if (repeat) {
    return undefined;
  }
  if (isMuteKey(key)) {
    return "sound";
  }
  return isPauseKey(key) ? "pause" : undefined;
}

// What holds the walk still. A card or the hit stop can sit under the pause menu or the
// Home button's question. Help and settings, opened from the menu, cover the whole screen,
// top bar included.
export interface RunPause {
  card: boolean;
  hitStop: boolean;
  menu: "closed" | "confirmHome" | "help" | "open" | "settings";
}

// A card or a menu over the walk takes every press. A hit stop covers nothing.
export function walkCovered(pause: RunPause): boolean {
  return pause.card || pause.menu !== "closed";
}

// Lane moves and treats act only while nothing holds the walk.
export function gameplayAllowed(pause: RunPause): boolean {
  return !walkCovered(pause) && !pause.hitStop;
}

export type TopBarAction = "confirmHome" | "mute" | "openMenu" | "resume";

// What a top-bar button does, pressed by a tap or by its key. Every button works whenever the
// bar is in view: Home asks whether to head home, from the pause menu too, sound and M mute
// or unmute, and pause opens the menu, or resumes while the menu or the question is up. Help
// and settings cover the bar, so a tap there is theirs, and so are P and Escape, which close
// them. M still mutes under help; settings flips its own sound switch on M.
export function topBarAction(
  pause: RunPause,
  via: "key" | "tap",
  button: TopBarPress,
): TopBarAction | undefined {
  if (pause.menu === "help" || pause.menu === "settings") {
    const mutes = pause.menu === "help" && via === "key" && button === "sound";
    return mutes ? "mute" : undefined;
  }
  if (button === "home") {
    return pause.menu === "confirmHome" ? undefined : "confirmHome";
  }
  if (button === "sound") {
    return "mute";
  }
  return pause.menu === "closed" ? "openMenu" : "resume";
}

// The pause button shows play while the walk is paused by the menu or the question, since a
// press then resumes.
export function pauseButtonIcon(pause: RunPause): "icon-pause" | "icon-play" {
  return pause.menu === "closed" ? "icon-pause" : "icon-play";
}
