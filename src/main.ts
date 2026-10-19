import "./main.css";

import { AUTO, Game, GameObjects, Scale } from "phaser";

import { installCrashScreen } from "./crash/crashScreen";
import { SCREEN_CONFIG } from "./data/screen";
import { DEV_STATE_EVENT, type DevState } from "./dev/devOverlay";
import { type DevPanelHost, mountDevPanel } from "./dev/devPanel";
import { pageRunSetup } from "./dev/pageRunSetup";
import { setOnHomeScreen, setupPhoneApp } from "./pwa";
import { BootScene } from "./scenes/BootScene";
import { CardScene } from "./scenes/CardScene";
import { DEV_OVERLAY_SCENE_KEY, DevOverlayScene } from "./scenes/DevOverlayScene";
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

// The dev panel's view of the game. The overlay shows or hides by its text object's
// visibility, the same flag DevOverlayScene's backquote toggle flips, so each control sees
// the other's change.
function devPanelHost(game: Game): DevPanelHost {
  let devState: DevState | undefined;
  game.events.on(DEV_STATE_EVENT, (state: DevState) => {
    devState = state;
  });
  // Absent until the scene has booted and run create, which shows it when the URL has dev=1.
  const overlayText = () =>
    game.scene
      .getScene(DEV_OVERLAY_SCENE_KEY)
      ?.children?.list.find((child) => child instanceof GameObjects.Text);
  return {
    currentSetup: () => devState?.setup ?? pageRunSetup().setup,
    overlayVisible: () => overlayText()?.visible ?? pageRunSetup().setup.dev,
    setOverlayVisible: (visible) => {
      overlayText()?.setVisible(visible);
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
