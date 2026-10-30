import { containsPoint, type Point } from "@andornaut/game-kit/rect";

import { SCREEN_LAYOUT } from "../data/screen";
import { isMuteKey, isPauseKey } from "../input/keyBindings";
import type { PressMode } from "../input/pointerTracking";
import { type BarButton, WALK_BAR_BUTTONS, type WalkBarButtonId, walkBarLayout } from "./walkHud";

// The walk bar's buttons (walkHud.ts), left to right. A press in a button's hit area is that
// button's and never a road gesture. "sound" toggles mute, as the M key and the Settings switch
// do.
export const TOP_BAR_BUTTONS: Readonly<Record<WalkBarButtonId, BarButton>> = walkBarLayout(
  SCREEN_LAYOUT.topBar,
).buttons;

// Where the button's icon sits on its face.
export function buttonIcon(button: BarButton): Point {
  return { x: button.face.x + 2, y: button.face.y + 1 };
}

// The button a press at (x, y) lands on, if any.
export function topBarButtonAt(x: number, y: number): WalkBarButtonId | undefined {
  return WALK_BAR_BUTTONS.find((press) => containsPoint(TOP_BAR_BUTTONS[press].hit, x, y));
}

// M mutes, and P and Escape are the pause button's. A held key's repeats press nothing.
export function topBarButtonForKey(repeat: boolean, key: string): WalkBarButtonId | undefined {
  if (repeat) {
    return undefined;
  }
  if (isMuteKey(key)) {
    return "sound";
  }
  return isPauseKey(key) ? "pause" : undefined;
}

// What holds the walk still. card: a card or the zone celebration, which can sit under the pause
// menu or the Home question, as the hit stop can. hold: a press on the HUD opened the detail card
// that explains it. menu: the pause menu, the Home question, or help or the settings opened with
// or over the menu. page: the tab is hidden or the window has lost focus.
export interface RunPause {
  card: boolean;
  hitStop: boolean;
  hold: boolean;
  menu: "closed" | "confirmHome" | "help" | "open" | "settings";
  page: "blurred" | "hidden" | "shown";
}

// The walk going on with nothing holding it.
export const NOTHING_PAUSED: RunPause = {
  card: false,
  hitStop: false,
  hold: false,
  menu: "closed",
  page: "shown",
};

// Whether the walk is paused: no scroll, timers, needs or pulls, and the session does not step.
// Every overlay over the walk, an explanation's detail card, and the page out of view or focus
// pause it. A hit stop is part of the walk and steps on.
export function walkPaused(pause: Omit<RunPause, "hitStop">): boolean {
  return pause.card || pause.hold || pause.menu !== "closed" || pause.page !== "shown";
}

// Whether the player paused the walk: the pause menu and what opens from it, or the Home
// question. The music ducks and the walk's timers stop; a card, the celebration or an
// explanation's detail card pauses the walk without either.
export function playerPaused(pause: Pick<RunPause, "menu">): boolean {
  return pause.menu !== "closed";
}

// What the walk's presses do. While any card or overlay is open, only the walk bar's buttons act
// (topBarAction): nothing on the walk explains itself, and a tap elsewhere closes what can close
// or does nothing. A hit stop covers nothing, and an explanation's detail card takes its presses
// itself: the walk's input closes it on the next tap.
export function walkPresses(pause: RunPause): PressMode {
  return pause.card || pause.menu !== "closed" ? "none" : "steer";
}

// Lane moves act only while nothing pauses the walk or holds it in a hit stop.
export function gameplayAllowed(pause: RunPause): boolean {
  return !walkPaused(pause) && !pause.hitStop;
}

export type TopBarAction =
  "closeSettings" | "mute" | "openHelp" | "openMenu" | "openSettings" | "resume";

// What a walk-bar button does, pressed by a tap or by its key. Every button works whenever the
// bar is in view, under every card and overlay that leaves it lit: sound and M mute or unmute,
// Help and Settings open help and the settings, and pause opens the menu, or resumes while the
// menu, the question or the settings are up. Over the settings, Help opens help in their place
// and Settings closes them, as a home page's own top bar button does. Help covers the bar, so a
// tap there is its, and so are P and Escape, which close it; M still mutes under it. The
// settings take P, Escape and M themselves. A tap while an explanation's detail card is up only
// closes it, so it presses no button.
export function topBarAction(
  pause: RunPause,
  via: "key" | "tap",
  button: WalkBarButtonId,
): TopBarAction | undefined {
  if (pause.hold && via === "tap") {
    return undefined;
  }
  if (pause.menu === "help") {
    return via === "key" && button === "sound" ? "mute" : undefined;
  }
  if (pause.menu === "settings" && via === "key") {
    return undefined;
  }
  switch (button) {
    case "sound":
      return "mute";
    case "help":
      return "openHelp";
    case "settings":
      return pause.menu === "settings" ? "closeSettings" : "openSettings";
    case "pause":
      return pause.menu === "closed" ? "openMenu" : "resume";
    default:
      return button satisfies never;
  }
}

export type WalkBackAction = "closeExplanation" | "menu" | "none" | "resume";

// What back does during a walk, innermost first: nothing once the walk is over, before the end
// screen; an explanation's detail card closes; help and the settings close themselves; the Home
// question returns to the pause menu; the pause menu resumes; else, over the walk, a card or the
// zone celebration, the pause menu opens.
export function walkBackAction(over: boolean, pause: RunPause): WalkBackAction {
  if (over) {
    return "none";
  }
  if (pause.hold) {
    return "closeExplanation";
  }
  switch (pause.menu) {
    case "closed":
    case "confirmHome":
      return "menu";
    case "help":
    case "settings":
      return "none";
    case "open":
      return "resume";
    default:
      return pause.menu satisfies never;
  }
}

// The pause button shows play while the walk is paused by the menu or the question, since a
// press then resumes.
export function pauseButtonIcon(pause: RunPause): "icon-pause" | "icon-play" {
  return pause.menu === "closed" ? "icon-pause" : "icon-play";
}
