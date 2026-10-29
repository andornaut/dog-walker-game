import { Scene } from "phaser";

import { TAP_BURST_SCENE_KEY } from "./sceneKeys";

// Every tap burst (addTapBurst) plays here, over every other scene but the dev overlay. It starts
// with the game, is never paused or stopped and takes no input, so a burst plays out whatever the
// tapped scene does next: pauses under an overlay it opens, closes, or starts another scene. Its
// camera is the default one, so a burst sits at the tap's screen position.
export class TapBurstScene extends Scene {
  constructor() {
    super({ active: true, key: TAP_BURST_SCENE_KEY });
  }

  create(): void {
    this.input.enabled = false;
  }
}
