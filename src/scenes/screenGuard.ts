import { guardSceneInput } from "@andornaut/game-kit/input/phaser/guardSceneInput";
import type { Scene } from "phaser";

import { gameData } from "../data";
import { tapGuardMs } from "../input/tapGuard";

// Turns the scene's pointer and keyboard input off until seconds.screenTapGuard has passed since
// the frame drawn() is called on, its first drawn frame (the kit's guardSceneInput). A page tap
// waits too: listenOutsideTap reads the scene's input.
export function guardScreenInput(scene: Scene): { drawn: () => void } {
  return guardSceneInput(tapGuardMs(gameData.tuning), scene);
}
