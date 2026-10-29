import type { Scene } from "phaser";

import { homeBarAction, type HomeBarButton, homeBarButtonAt } from "../home/homeBar";
import { whenArtReady } from "./artReady";
import { openHelp } from "./helpScreen";
import { openOverlay } from "./overlay";
import { toggleMuted } from "./profileStore";
import { SCENE_KEYS, type SceneKey } from "./sceneKeys";
import type { SettingsData } from "./SettingsScene";
import { listenTargetPress } from "./targetPress";

// Emitted on game.events, with whether sound is now muted, when the top bar's Sound button is
// tapped over an overlay, so the start screen redraws its bar and says so.
export const HOME_MUTED_EVENT = "home-muted";

// The start screen's top bar, lit over an overlay on a home page, keeps its buttons. The start
// screen is paused under the overlay, so the overlay on top takes the tap and acts as
// homeBarAction says: help, the Logbook and the settings open over it and resume it on close,
// and close is how it closes itself.
export function listenHomeBar(scene: Scene, close: () => void): void {
  listenTargetPress<HomeBarButton>(scene, {
    onPressed: () => undefined,
    onTap: (button) => pressHomeBar(scene, close, button),
    targetAt: homeBarButtonAt,
  });
}

function pressHomeBar(scene: Scene, close: () => void, button: HomeBarButton): void {
  const resume = scene.scene.key as SceneKey;
  const shown = (key: SceneKey) => scene.scene.isActive(key) || scene.scene.isPaused(key);
  const open = { logbook: shown(SCENE_KEYS.stats), settings: shown(SCENE_KEYS.settings) };
  const action = homeBarAction(open, button);
  switch (action) {
    case "close":
      close();
      return;
    case "mute":
      scene.game.events.emit(HOME_MUTED_EVENT, toggleMuted(scene));
      return;
    case "openHelp":
      // Help shows art boot may still be loading, as from the start screen.
      whenArtReady(scene, () => openHelp(scene, resume));
      return;
    case "openLogbook":
      // Scenes draw in the game's scene order, and the Logbook and the settings open over each
      // other either way round, so each is moved to just above the scene it opens over.
      scene.scene.moveAbove(resume, SCENE_KEYS.stats);
      openOverlay(scene, SCENE_KEYS.stats, { resume });
      return;
    case "openSettings": {
      const data: SettingsData = { region: "home", resume };
      scene.scene.moveAbove(resume, SCENE_KEYS.settings);
      openOverlay(scene, SCENE_KEYS.settings, data);
      return;
    }
    default:
      action satisfies never;
  }
}
