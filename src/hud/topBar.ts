import { isMuteKey, isPauseKey } from "../input/keyBindings";
import { containsPoint, type Point, type Rect } from "../layout/rect";

// The run's top bar, as ui-top-bar draws it: the money, treat and zone wells. The zone's
// name is right-aligned at zone.nameRight.
export const TOP_BAR = {
  money: { height: 26, width: 88, x: 4, y: 8 },
  treats: { height: 26, width: 32, x: 96, y: 8 },
  zone: { height: 29, nameRight: 352, width: 144, x: 212, y: 5 },
} as const;

// A top-bar button: its 20x20 face, and a 44px-square hit area so a thumb finds it. Both hit
// areas reach 4px into the band and meet at x=162 without overlapping; a press in one is
// that button's and never a road gesture. Home's reaches over the treat well, which takes
// no taps.
export interface TopBarButton {
  face: Point;
  hit: Rect;
}

export const HOME_BUTTON: TopBarButton = {
  face: { x: 130, y: 10 },
  hit: { height: 44, width: 44, x: 118, y: 0 },
};

export const PAUSE_BUTTON: TopBarButton = {
  face: { x: 174, y: 10 },
  hit: { height: 44, width: 44, x: 162, y: 0 },
};

// The icon sits on the button's face, 2px lower while pressed.
export function buttonIcon(button: TopBarButton, pressed: boolean): Point {
  return { x: button.face.x + 2, y: button.face.y + (pressed ? 3 : 1) };
}

// "sound" is the M key's: sound has no button on the run's bar, and mutes from Settings.
export type TopBarPress = "home" | "pause" | "sound";

// The button a press at (x, y) lands on, if any.
export function topBarButtonAt(x: number, y: number): TopBarPress | undefined {
  if (containsPoint(HOME_BUTTON.hit, x, y)) {
    return "home";
  }
  return containsPoint(PAUSE_BUTTON.hit, x, y) ? "pause" : undefined;
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

// What a top-bar button does, pressed by a tap or by its key. Both buttons work whenever the
// bar is in view: Home asks whether to head home, from the pause menu too, and pause opens
// the menu, or resumes while the menu or the question is up. M mutes. Help and settings
// cover the bar, so a tap there is theirs, and so are P and Escape, which close them. M still
// mutes under help; settings flips its own sound switch on M.
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
