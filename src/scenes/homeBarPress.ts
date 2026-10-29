import { browserExitPage, exitApp } from "@andornaut/game-kit/pwa/exitApp";
import type { Scene } from "phaser";

import { homeBarAction, homeBarButtonAt } from "../home/homeBar";
import type { HomeBarButton } from "../home/homeLayout";
import { openGuard } from "../input/openGuard";
import { whenArtReady } from "./artReady";
import { openHelp } from "./helpScreen";
import { BAR_MUTED_EVENT, onSceneEvent, openOverlay } from "./overlay";
import { toggleMuted } from "./profileStore";
import { SCENE_KEYS, type SceneKey } from "./sceneKeys";
import type { SettingsData } from "./SettingsScene";
import { listenTargetPress } from "./targetPress";

// Emitted on game.events as the top bar opens help, the Logbook or the settings: the Logbook,
// the settings and the badge celebration close, and the start screen and the Pet shop close any
// detail card or purchase confirm, so the page opens alone over the page beneath, dimmed once.
export const HOME_PAGE_OPENING_EVENT = "home-page-opening";

export type HomePage = "help" | "logbook" | "settings";

const homePageGuard = openGuard();

// Opens page from the top bar, tapped on from, at once: over the Pet shop while it is open, else
// over the start screen, in place of every other overlay and card. The overlays it closes and
// the one it opens change at Phaser's next step, so a second page asked of from before then is
// dropped (openGuard).
export function openHomePage(from: Scene, page: HomePage): void {
  homePageGuard(from.game.events, from, () => {
    from.game.events.emit(HOME_PAGE_OPENING_EVENT);
    const { shop, start } = SCENE_KEYS;
    const resume = from.scene.isActive(shop) || from.scene.isPaused(shop) ? shop : start;
    const under = from.scene.get(resume);
    switch (page) {
      case "help":
        // Help shows art boot may still be loading.
        whenArtReady(under, () => openHelp(under, resume));
        return;
      case "logbook":
        openOverlay(under, SCENE_KEYS.stats, { resume });
        return;
      case "settings": {
        const data: SettingsData = { region: "home", resume };
        openOverlay(under, SCENE_KEYS.settings, data);
        return;
      }
      default:
        page satisfies never;
    }
  });
}

// Leaves the game from the top bar's Exit: the installed app closes its window, and a browser
// tab, or a window that stays open, goes to the site's home page (the kit's exitApp).
export function exitGame(): void {
  exitApp(browserExitPage());
}

// The start screen's top bar, lit over an overlay on a home page, keeps its buttons, Exit among
// them where exit is true (exitShown). The start screen is paused under the overlay, so the
// overlay on top takes the tap and acts as homeBarAction says, on the press's release over the
// same button; close is how it closes itself. clear is what it does as the bar opens a page
// (HOME_PAGE_OPENING_EVENT): close, unless it is the page beneath, which closes its cards.
export function listenHomeBar(
  scene: Scene,
  exit: boolean,
  close: () => void,
  clear: () => void = close,
): void {
  onSceneEvent(scene, scene.game.events, HOME_PAGE_OPENING_EVENT, clear);
  listenTargetPress<HomeBarButton>(scene, {
    onPressed: () => undefined,
    onTap: (button) => pressHomeBar(scene, close, button),
    targetAt: (x, y) => homeBarButtonAt(exit, x, y),
  });
}

function pressHomeBar(scene: Scene, close: () => void, button: HomeBarButton): void {
  const shown = (key: SceneKey) => scene.scene.isActive(key) || scene.scene.isPaused(key);
  const open = { logbook: shown(SCENE_KEYS.stats), settings: shown(SCENE_KEYS.settings) };
  const action = homeBarAction(open, button);
  switch (action) {
    case "close":
      close();
      return;
    case "exit":
      exitGame();
      return;
    case "mute":
      scene.game.events.emit(BAR_MUTED_EVENT, toggleMuted(scene));
      return;
    case "openHelp":
      openHomePage(scene, "help");
      return;
    case "openLogbook":
      openHomePage(scene, "logbook");
      return;
    case "openSettings":
      openHomePage(scene, "settings");
      return;
    default:
      action satisfies never;
  }
}
