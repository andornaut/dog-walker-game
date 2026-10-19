import { isMuteKey, isPauseKey } from "../input/keyBindings";
import { containsPoint, type Point, type Rect } from "../layout/rect";

// The run's top bar, as ui-top-bar draws it: the money, treat and zone wells. The zone's
// name is right-aligned at zone.nameRight.
export const TOP_BAR = {
  money: { height: 26, width: 88, x: 4, y: 8 },
  treats: { height: 26, width: 32, x: 96, y: 8 },
  zone: { height: 29, nameRight: 352, width: 144, x: 212, y: 5 },
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
