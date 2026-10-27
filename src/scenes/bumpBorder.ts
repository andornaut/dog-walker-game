import type { GameObjects, Scene, Time } from "phaser";

import { SCREEN_CONFIG } from "../data/screen";
import { BUMP_FLASH, bumpBorder } from "../layout/bumpFlash";
import { fillRect } from "../ui/phaser/draw";
import { PALETTE } from "../ui/phaser/palette";

const SCREEN = { height: SCREEN_CONFIG.height, width: SCREEN_CONFIG.width, x: 0, y: 0 };

// A bump's border round the whole screen, drawn by the HUD over its own parts so the road's
// nudge leaves it still: the bump's colour at the edge and the ink keyline inside it, for
// BUMP_FLASH.ms. A newer bump redraws it in its colour and restarts its time.
export class BumpBorder {
  private readonly graphics: GameObjects.Graphics;
  private readonly scene: Scene;
  private timer: Time.TimerEvent | undefined;

  constructor(scene: Scene, depth: number) {
    this.scene = scene;
    this.graphics = scene.add.graphics().setDepth(depth);
  }

  flash(colour: number): void {
    const { band, keyline } = bumpBorder(SCREEN);
    const g = this.graphics.clear();
    band.forEach((rect) => fillRect(g, colour, rect));
    keyline.forEach((rect) => fillRect(g, PALETTE.ink, rect));
    this.timer?.remove();
    this.timer = this.scene.time.delayedCall(BUMP_FLASH.ms, () => g.clear());
  }
}
