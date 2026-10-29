import { SCREEN_LAYOUT } from "../data/screen";
import type { OutsideArea } from "../input/outsideTap";
import { containsPoint, type Rect } from "../lib/rect";
import { HOME_LAYOUT } from "./homeLayout";

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

export type HomeBarButton = "help" | "logbook" | "mute" | "settings";

export type HomeBarAction = "close" | "mute" | "openHelp" | "openLogbook" | "openSettings";

const HOME_BAR_BUTTONS: readonly (readonly [HomeBarButton, Rect])[] = [
  ["help", HOME_LAYOUT.help.hit],
  ["logbook", HOME_LAYOUT.logbook.hit],
  ["mute", HOME_LAYOUT.mute.hit],
  ["settings", HOME_LAYOUT.settings.hit],
];

// Every top bar button's tap area.
export const HOME_BAR_HITS: readonly Rect[] = HOME_BAR_BUTTONS.map(([, hit]) => hit);

// Where a tap outside an overlay's panel and covered counts in region: in overlayRegion, off
// the home top bar's buttons, whose tap areas reach a little below the bar.
export function regionOutside(region: OverlayRegion, covered: readonly Rect[]): OutsideArea {
  const bar = region === "home" ? HOME_BAR_HITS : [];
  return { covered: [...covered, ...bar], dim: overlayRegion(region) };
}

// The top bar button a press at (x, y) lands on, if any.
export function homeBarButtonAt(x: number, y: number): HomeBarButton | undefined {
  return HOME_BAR_BUTTONS.find(([, hit]) => containsPoint(hit, x, y))?.[0];
}

// What a top bar button does over an overlay on a home page, given which of the Logbook and the
// settings are open: as on the bare start screen, help, the Logbook and the settings open over
// the overlay on top and close back to it, and Sound mutes or unmutes. While the button's own
// overlay is open, the button closes the overlay on top, back to it or past it, as the walk
// bar's pause button resumes from its menu; each opens at most once.
export function homeBarAction(
  open: { readonly logbook: boolean; readonly settings: boolean },
  button: HomeBarButton,
): HomeBarAction {
  switch (button) {
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
