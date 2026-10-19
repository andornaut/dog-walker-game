import "./main.css";

import { AUTO, Game, Scale } from "phaser";

import { installCrashScreen } from "./crash/crashScreen";
import { SCREEN_CONFIG } from "./data/screen";
import {
  DEV_OVERLAY_TOGGLE_EVENT,
  DEV_OVERLAY_VISIBLE_KEY,
  DEV_ROAD_FADE_KEY,
  DEV_STATE_EVENT,
  type DevState,
} from "./dev/devOverlay";
import { type DevPanelHost, mountDevPanel } from "./dev/devPanel";
import { pageRunSetup } from "./dev/pageRunSetup";
import { setOnHomeScreen, setupPhoneApp } from "./pwa";
import { BootScene } from "./scenes/BootScene";
import { CardScene } from "./scenes/CardScene";
import { CelebrationScene } from "./scenes/CelebrationScene";
import { DevOverlayScene } from "./scenes/DevOverlayScene";
import { EndScene } from "./scenes/EndScene";
import { HelpScene } from "./scenes/HelpScene";
import { watchHomeScreen } from "./scenes/homeScreen";
import { HudScene } from "./scenes/HudScene";
import { PauseScene } from "./scenes/PauseScene";
import { RunScene } from "./scenes/RunScene";
import { SettingsScene } from "./scenes/SettingsScene";
import { StartScene } from "./scenes/StartScene";
import { StatsScene } from "./scenes/StatsScene";

// Installed first, to catch errors while the game boots. A crash before game is assigned
// throws in onCrash, which the crash screen logs and ignores.
installCrashScreen({
  dev: pageRunSetup().setup.dev,
  onCrash: () => {
    game.pause();
    game.sound.pauseAll();
  },
});

setupPhoneApp();

// The dev panel's view of the game. The panel asks the overlay to show or hide by an event, and
// reads its visibility from the registry, which the backquote toggle also updates, so each
// control sees the other's change. The road fade is a registry flag RunScene reads each frame.
function devPanelHost(game: Game): DevPanelHost {
  let devState: DevState | undefined;
  game.events.on(DEV_STATE_EVENT, (state: DevState) => {
    devState = state;
  });
  return {
    currentSetup: () => devState?.setup ?? pageRunSetup().setup,
    // Unset until the overlay scene has run create, which shows it when the URL has dev=1.
    overlayVisible: () =>
      (game.registry.get(DEV_OVERLAY_VISIBLE_KEY) as boolean | undefined) ??
      pageRunSetup().setup.dev,
    roadFade: () => game.registry.get(DEV_ROAD_FADE_KEY) === true,
    setOverlayVisible: (visible) => {
      game.events.emit(DEV_OVERLAY_TOGGLE_EVENT, visible);
    },
    setRoadFade: (on) => {
      game.registry.set(DEV_ROAD_FADE_KEY, on);
    },
  };
}

// Scenes render in list order: the HUD over the road, cards and the pause menu over the
// HUD, help, settings and stats over those, and the dev overlay, which starts itself, over
// everything. Boot runs first and starts the start screen.
const game = new Game({
  backgroundColor: "#181425",
  height: SCREEN_CONFIG.height,
  parent: "game",
  pixelArt: true,
  scale: { autoCenter: Scale.CENTER_BOTH, mode: Scale.FIT },
  scene: [
    BootScene,
    StartScene,
    RunScene,
    HudScene,
    CardScene,
    PauseScene,
    EndScene,
    HelpScene,
    SettingsScene,
    StatsScene,
    CelebrationScene,
    DevOverlayScene,
  ],
  type: AUTO,
  width: SCREEN_CONFIG.width,
});

mountDevPanel(devPanelHost(game), document.getElementById("dev-panel"));

// With dev=1, the game is reachable from the console and from headless checks.
if (pageRunSetup().setup.dev) {
  Object.assign(globalThis, { dogWalkerGame: game });
}

// The update notice shows on the home screen only.
watchHomeScreen(game, setOnHomeScreen);
