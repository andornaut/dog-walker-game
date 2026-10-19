import { AUTO, Game, GameObjects, Scale } from "phaser";

import { SCREEN_CONFIG } from "./data/screen";
import { DEV_STATE_EVENT, type DevState } from "./dev/devOverlay";
import { type DevPanelHost, mountDevPanel } from "./dev/devPanel";
import { pageRunSetup } from "./dev/pageRunSetup";
import { setupPhoneApp } from "./pwa";
import { BootScene } from "./scenes/BootScene";
import { CardScene } from "./scenes/CardScene";
import { DEV_OVERLAY_SCENE_KEY, DevOverlayScene } from "./scenes/DevOverlayScene";
import { EndScene } from "./scenes/EndScene";
import { HelpScene } from "./scenes/HelpScene";
import { HudScene } from "./scenes/HudScene";
import { PauseScene } from "./scenes/PauseScene";
import { RunScene } from "./scenes/RunScene";
import { StartScene } from "./scenes/StartScene";

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
// HUD, help over those, and the dev overlay, which starts itself, over everything. Boot
// runs first and starts the start screen.
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
    DevOverlayScene,
  ],
  type: AUTO,
  width: SCREEN_CONFIG.width,
});

mountDevPanel(devPanelHost(game), document.getElementById("dev-panel"));
