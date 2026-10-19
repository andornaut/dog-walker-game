import { AUTO, Game, Scale } from "phaser";

import { SCREEN_CONFIG } from "./data/screen";
import { BootScene } from "./scenes/BootScene";
import { CardScene } from "./scenes/CardScene";
import { EndScene } from "./scenes/EndScene";
import { HelpScene } from "./scenes/HelpScene";
import { HudScene } from "./scenes/HudScene";
import { PauseScene } from "./scenes/PauseScene";
import { RunScene } from "./scenes/RunScene";
import { StartScene } from "./scenes/StartScene";

// Scenes render in list order: the HUD over the road, cards and the pause menu over the
// HUD, and help over everything. Boot runs first and starts the start screen.
new Game({
  backgroundColor: "#181425",
  height: SCREEN_CONFIG.height,
  parent: "game",
  pixelArt: true,
  scale: { autoCenter: Scale.CENTER_BOTH, mode: Scale.FIT },
  scene: [BootScene, StartScene, RunScene, HudScene, CardScene, PauseScene, EndScene, HelpScene],
  type: AUTO,
  width: SCREEN_CONFIG.width,
});
