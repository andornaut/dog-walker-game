import type { Scene } from "phaser";

import { disabledTextureKey as greyCopyKey } from "../assets/phaser/greyTextures";
import { GREYED } from "../ui/selection";

// The grey copy of a disabled tile's art, GREYED.copyDarker steps down the neutral ramp.
export function disabledTextureKey(scene: Scene, key: string): string {
  return greyCopyKey(scene, GREYED.copyDarker, key);
}
