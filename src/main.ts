import { AUTO, Game, Scale } from "phaser";

import { SCREEN_CONFIG } from "./data/screen";
import { CardScene } from "./scenes/CardScene";
import { HudScene } from "./scenes/HudScene";
import { RunScene } from "./scenes/RunScene";

// Scenes render in list order, so the HUD and cards draw over the road.
new Game({
  backgroundColor: "#1d1d1d",
  height: SCREEN_CONFIG.height,
  parent: "game",
  pixelArt: true,
  scale: { autoCenter: Scale.CENTER_BOTH, mode: Scale.FIT },
  scene: [RunScene, HudScene, CardScene],
  type: AUTO,
  width: SCREEN_CONFIG.width,
});
