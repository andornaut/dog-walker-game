import { type GameObjects, Math as PhaserMath, type Scene, TintModes } from "phaser";

import { BUMP_FLASH } from "../../layout/bumpFlash";
import { type FlashCue, HIT_ART, type HitEffect, type MotionStep } from "../../layout/hitEffects";
import { playEffect } from "../sprites";
import { tagFrame } from "../uiKit";
import type { StruckBody } from "./itemViews";

const WHITE = 0xffffff;

// Each effect over depth: played once, or its held frame shown for holdMs.
export function playHitEffects(
  scene: Scene,
  moment: { readonly depth: number; readonly holdMs: number },
  effects: readonly HitEffect[],
): void {
  for (const { above, at, frame, key } of effects) {
    const depth = moment.depth + above;
    if (frame === null) {
      playEffect(scene, key, HIT_ART.tag, at, depth);
      continue;
    }
    const held = tagFrame(scene, key, HIT_ART.tag, frame);
    if (held !== undefined) {
      const image = scene.add.image(Math.round(at.x), Math.round(at.y), key, held).setDepth(depth);
      scene.time.delayedCall(moment.holdMs, () => image.destroy());
    }
  }
}

// The sprite filled white while each cue has it on.
export function flashWhite(
  scene: Scene,
  sprite: GameObjects.Sprite,
  cues: readonly FlashCue[],
): void {
  for (const { ms, on } of cues) {
    scene.time.delayedCall(ms, () => {
      if (!sprite.active) {
        return;
      }
      if (on) {
        sprite.setTint(WHITE).setTintMode(TintModes.FILL);
      } else {
        sprite.clearTint();
      }
    });
  }
}

// The struck obstacle's motion, one step after another: its angle on the sprite, its offset
// on the body's offset, which the road adds where it draws it.
export function moveObstacle(scene: Scene, body: StruckBody, steps: readonly MotionStep[]): void {
  let delay = 0;
  for (const { angle, dx, dy, ease, ms } of steps) {
    const timing = { delay, duration: ms, ease: ease ?? "Sine.easeInOut" };
    if (angle !== undefined) {
      scene.tweens.add({ ...timing, angle, targets: body.sprite });
    }
    const offset = { ...(dx === undefined ? {} : { dx }), ...(dy === undefined ? {} : { dy }) };
    if (Object.keys(offset).length > 0) {
      scene.tweens.add({ ...timing, ...offset, targets: body.offset });
    }
    delay += ms;
  }
}

// Shakes the scene's camera by a bump's nudge; another scene's camera, the HUD's, keeps still.
export function shakeRoad(scene: Scene): void {
  const camera = scene.cameras.main;
  const intensity = new PhaserMath.Vector2(
    BUMP_FLASH.nudgePx / camera.width,
    BUMP_FLASH.nudgePx / camera.height,
  );
  camera.shake(BUMP_FLASH.nudgeMs, intensity);
}
