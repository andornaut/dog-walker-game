import { isMuteKey, isPauseKey } from "../input/keyBindings";
import { containsPoint, type Point, type Rect } from "../layout/rect";

// A top-bar button: its 20x20 face, and a 44px-square hit area so a thumb finds it. Both hit
// areas reach 4px into the road and meet at x=168 without overlapping; a press in one is
// that button's and never a road gesture.
export interface TopBarButton {
  face: Point;
  hit: Rect;
}

export const SOUND_BUTTON: TopBarButton = {
  face: { x: 146, y: 10 },
  hit: { height: 44, width: 44, x: 124, y: 0 },
};

export const PAUSE_BUTTON: TopBarButton = {
  face: { x: 170, y: 10 },
  hit: { height: 44, width: 44, x: 168, y: 0 },
};

// The icon sits on the button's face, 2px lower while pressed.
export function buttonIcon(button: TopBarButton, pressed: boolean): Point {
  return { x: button.face.x + 2, y: button.face.y + (pressed ? 3 : 1) };
}

export type TopBarPress = "pause" | "sound";

// The button a press at (x, y) lands on, if any.
export function topBarButtonAt(x: number, y: number): TopBarPress | undefined {
  if (containsPoint(SOUND_BUTTON.hit, x, y)) {
    return "sound";
  }
  return containsPoint(PAUSE_BUTTON.hit, x, y) ? "pause" : undefined;
}

// M is the sound button's key, and P and Escape are the pause button's. A held key's repeats
// press nothing.
export function topBarButtonForKey(repeat: boolean, key: string): TopBarPress | undefined {
  if (repeat) {
    return undefined;
  }
  if (isMuteKey(key)) {
    return "sound";
  }
  return isPauseKey(key) ? "pause" : undefined;
}

// What holds the walk still. A card or the hit stop can sit under the pause menu. Help and
// settings, opened from the menu, cover the whole screen, top bar included.
export interface RunPause {
  card: boolean;
  hitStop: boolean;
  menu: "closed" | "help" | "open" | "settings";
}

// Lane moves and treats act only while nothing holds the walk.
export function gameplayAllowed(pause: RunPause): boolean {
  return !pause.card && !pause.hitStop && pause.menu === "closed";
}

export type TopBarAction = "mute" | "openMenu" | "resume";

// What a top-bar button does, pressed by a tap or by its key. Both buttons work whenever the
// bar is in view: sound mutes, and pause opens the menu, or resumes while it is up. Help and
// settings cover the bar, so a tap there is theirs, and so are P and Escape, which close them.
// M still mutes under help; settings flips its own sound switch on M.
export function topBarAction(
  pause: RunPause,
  via: "key" | "tap",
  button: TopBarPress,
): TopBarAction | undefined {
  if (pause.menu === "help" || pause.menu === "settings") {
    const mutes = pause.menu === "help" && via === "key" && button === "sound";
    return mutes ? "mute" : undefined;
  }
  if (button === "sound") {
    return "mute";
  }
  return pause.menu === "open" ? "resume" : "openMenu";
}

// The pause button shows play while the pause menu is up, since a press then resumes.
export function pauseButtonIcon(pause: RunPause): "icon-pause" | "icon-play" {
  return pause.menu === "closed" ? "icon-pause" : "icon-play";
}
