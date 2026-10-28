import type { GameObjects, Scene, Time, Tweens } from "phaser";

import { SCREEN_CONFIG } from "../data/screen";
import { BUMP_FLASH, bumpBorder } from "../layout/bumpFlash";
import { fillRect } from "../ui/phaser/draw";
import { PALETTE } from "../ui/phaser/palette";
import { HUD_DEPTH } from "./hudDepth";

const SCREEN = { height: SCREEN_CONFIG.height, width: SCREEN_CONFIG.width, x: 0, y: 0 };

// A bump's flash, drawn by the HUD so the road's nudge leaves it still: a border round the
// whole screen over the HUD's parts, the bump's colour at the edge and the ink keyline inside
// it, for BUMP_FLASH.ms, and a tint of the bump's colour over the whole screen under the HUD's
// parts, from BUMP_FLASH.tintAlpha down to none over the same time. A newer bump redraws both
// in its colour and restarts their time.
export class BumpBorder {
  private fade: Tweens.Tween | undefined;
  private readonly graphics: GameObjects.Graphics;
  private readonly scene: Scene;
  private readonly tint: GameObjects.Graphics;
  private timer: Time.TimerEvent | undefined;

  constructor(scene: Scene) {
    this.scene = scene;
    this.graphics = scene.add.graphics().setDepth(HUD_DEPTH.bumpBorder);
    this.tint = scene.add.graphics().setDepth(HUD_DEPTH.bumpTint);
  }

  flash(colour: number): void {
    const { band, keyline } = bumpBorder(SCREEN);
    const g = this.graphics.clear();
    band.forEach((rect) => fillRect(g, colour, rect));
    keyline.forEach((rect) => fillRect(g, PALETTE.ink, rect));
    this.timer?.remove();
    this.timer = this.scene.time.delayedCall(BUMP_FLASH.ms, () => g.clear());
    fillRect(this.tint.clear(), colour, SCREEN);
    this.fade?.remove();
    this.fade = this.scene.tweens.add({
      alpha: { from: BUMP_FLASH.tintAlpha, to: 0 },
      duration: BUMP_FLASH.ms,
      targets: this.tint,
    });
  }
}
