import { AUTO, Game, Scale } from "phaser";

import { HEIGHT, WIDTH } from "./config";
import { RunScene } from "./scenes/RunScene";

new Game({
  backgroundColor: "#1d1d1d",
  height: HEIGHT,
  parent: "game",
  pixelArt: true,
  scale: { autoCenter: Scale.CENTER_BOTH, mode: Scale.FIT },
  scene: [RunScene],
  type: AUTO,
  width: WIDTH,
});
