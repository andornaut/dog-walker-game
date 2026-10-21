import { SCREEN_CONFIG } from "../data/screen";
import { isMuteKey, isPauseKey } from "../input/keyBindings";
import { containsPoint, type Point } from "../layout/rect";
import { screenLayout } from "../layout/screenLayout";
import { type BarButton, WALK_BAR_BUTTONS, type WalkBarButtonId, walkBarLayout } from "./walkHud";

// The walk bar's buttons (walkHud.ts), left to right. A press in a button's hit area is that
// button's and never a road gesture. "sound" toggles mute, as the M key and the Settings switch
// do.
export type TopBarButton = BarButton;
export type TopBarPress = WalkBarButtonId;

export const TOP_BAR_BUTTONS: Readonly<Record<TopBarPress, TopBarButton>> = walkBarLayout(
  screenLayout(SCREEN_CONFIG).topBar,
).buttons;

// The icon sits on the button's face, 2px lower while pressed.
export function buttonIcon(button: TopBarButton, pressed: boolean): Point {
  return { x: button.face.x + 2, y: button.face.y + (pressed ? 3 : 1) };
}

// The button a press at (x, y) lands on, if any.
export function topBarButtonAt(x: number, y: number): TopBarPress | undefined {
  return WALK_BAR_BUTTONS.find((press) => containsPoint(TOP_BAR_BUTTONS[press].hit, x, y));
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

// What holds the walk still. card: a card or the zone celebration, which can sit under the
// pause menu or the Home button's question, as the hit stop can. hold: a press held on the HUD
// shows what it explains. Help and settings cover the whole screen, walk bar included. page:
// the tab is hidden or the window has lost focus.
export interface RunPause {
  card: boolean;
  hitStop: boolean;
  hold: boolean;
  menu: "closed" | "confirmHome" | "help" | "open" | "settings";
  page: "blurred" | "hidden" | "shown";
}

// Whether the walk is paused: no scroll, timers, needs or pulls, and the session does not step.
// Every overlay over the walk, a press held to explain, and the page out of view or focus pause
// it. A hit stop is part of the walk and steps on.
export function walkPaused(pause: Omit<RunPause, "hitStop">): boolean {
  return pause.card || pause.hold || pause.menu !== "closed" || pause.page !== "shown";
}

// Whether the player paused the walk: the pause menu and what opens from it, or the Home
// question. The music ducks and the walk's timers stop; a card, the celebration or a held
// explanation pauses the walk without either.
export function playerPaused(pause: Pick<RunPause, "menu">): boolean {
  return pause.menu !== "closed";
}

// A card or a menu over the walk takes every press. A hit stop covers nothing.
export function walkCovered(pause: RunPause): boolean {
  return pause.card || pause.menu !== "closed";
}

// Whether the walk drops its presses: under a card or a menu. A held explanation keeps its
// press, whose release resumes the walk.
export function pressesHeld(pause: RunPause): boolean {
  return walkCovered(pause);
}

// Lane moves act only while nothing pauses the walk or holds it in a hit stop.
export function gameplayAllowed(pause: RunPause): boolean {
  return !walkPaused(pause) && !pause.hitStop;
}

export type TopBarAction =
  "confirmHome" | "mute" | "openHelp" | "openMenu" | "openSettings" | "resume";

// What a walk-bar button does, pressed by a tap or by its key. Every button works whenever the
// bar is in view: Home asks whether to head home, from the pause menu too, sound and M mute or
// unmute, Help and Settings open help and the settings, and pause opens the menu, or resumes while the menu or
// the question is up. Help and settings cover the bar, so a tap there is theirs, and so are P
// and Escape, which close them. M still mutes under help; settings flips its own sound switch
// on M.
export function topBarAction(
  pause: RunPause,
  via: "key" | "tap",
  button: TopBarPress,
): TopBarAction | undefined {
  if (pause.menu === "help" || pause.menu === "settings") {
    const mutes = pause.menu === "help" && via === "key" && button === "sound";
    return mutes ? "mute" : undefined;
  }
  switch (button) {
    case "home":
      return pause.menu === "confirmHome" ? undefined : "confirmHome";
    case "sound":
      return "mute";
    case "help":
      return "openHelp";
    case "settings":
      return "openSettings";
    case "pause":
      return pause.menu === "closed" ? "openMenu" : "resume";
    default:
      return button satisfies never;
  }
}

// The pause button shows play while the walk is paused by the menu or the question, since a
// press then resumes.
export function pauseButtonIcon(pause: RunPause): "icon-pause" | "icon-play" {
  return pause.menu === "closed" ? "icon-pause" : "icon-play";
}
