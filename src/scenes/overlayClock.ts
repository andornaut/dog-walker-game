import type { Scene } from "phaser";

import { TAP_BURST_SCENE_KEY } from "./sceneKeys";

// Calls back after delayMs on the tap burst layer's clock, which keeps running while scene is
// paused under an overlay, unless scene shuts down first: for a press's dip that plays on under
// the page or card the press opened.
export function afterMsUnderOverlay(scene: Scene, delayMs: number, callback: () => void): void {
  const drop = () => timer.remove();
  const timer = scene.scene.get(TAP_BURST_SCENE_KEY).time.delayedCall(delayMs, () => {
    scene.events.off("shutdown", drop);
    callback();
  });
  scene.events.once("shutdown", drop);
}
