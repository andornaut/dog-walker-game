import { containsPoint, type Rect } from "@andornaut/game-kit/rect";

import { SCREEN_LAYOUT } from "../data/screen";
import type { OutsideArea } from "../input/outsideTap";
import { HOME_LAYOUT, type HomeBarButton, homeBarButtons } from "./homeLayout";

// Where an overlay sits: on a home page (the start screen, the Pet shop, the Logbook), or on a
// walk.
export type OverlayRegion = "home" | "walk";

// What an overlay dims, and where a tap outside its panel counts: everything under the top bar,
// which stays lit with its buttons working, as the walk's pause menu leaves the walk bar lit.
export function overlayRegion(region: OverlayRegion): Rect {
  if (region === "walk") {
    return SCREEN_LAYOUT.walkView;
  }
  const { screen } = SCREEN_LAYOUT;
  const top = HOME_LAYOUT.topBar.height;
  return { height: screen.y + screen.height - top, width: screen.width, x: screen.x, y: top };
}

export type HomeBarAction = "close" | "exit" | "mute" | "openHelp" | "openLogbook" | "openSettings";

// Every top bar button's tap area, Exit's among them where exit is true (homeBarButtons).
export function homeBarHits(exit: boolean): Rect[] {
  return homeBarButtons(exit).map(([, { hit }]) => hit);
}

// Where a tap outside an overlay's panel and covered counts in region: in overlayRegion, off
// the home top bar's buttons as shown (exit: whether Exit is among them), whose tap areas reach
// a little below the bar.
export function regionOutside(
  exit: boolean,
  region: OverlayRegion,
  covered: readonly Rect[],
): OutsideArea {
  const bar = region === "home" ? homeBarHits(exit) : [];
  return { covered: [...covered, ...bar], dim: overlayRegion(region) };
}

// The top bar button a press at (x, y) lands on, if any, with Exit among the buttons where exit
// is true.
export function homeBarButtonAt(exit: boolean, x: number, y: number): HomeBarButton | undefined {
  return homeBarButtons(exit).find(([, { hit }]) => containsPoint(hit, x, y))?.[0];
}

// What a top bar button does over an overlay on a home page, given which of the Logbook and the
// settings is open: Sound mutes or unmutes, Exit leaves the game, and help, the Logbook and the
// settings open as on the bare start screen or the Pet shop, in place of any other overlay
// (openHomePage). While the button's own page is open, the button closes it, as the walk bar's
// pause button resumes from its menu.
export function homeBarAction(
  open: { readonly logbook: boolean; readonly settings: boolean },
  button: HomeBarButton,
): HomeBarAction {
  switch (button) {
    case "exit":
      return "exit";
    case "help":
      return "openHelp";
    case "logbook":
      return open.logbook ? "close" : "openLogbook";
    case "mute":
      return "mute";
    case "settings":
      return open.settings ? "close" : "openSettings";
    default:
      return button satisfies never;
  }
}

// What back does on the bare start screen, which hears it only with no page or question over
// it: closes the open detail card, or with none, asks Quit?.
export function homeBackAction(detailOpen: boolean): "askQuit" | "closeDetail" {
  return detailOpen ? "closeDetail" : "askQuit";
}
