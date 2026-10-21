import type { Scene } from "phaser";

import {
  disabledTextureKey as greyCopyKey,
  silhouetteTextureKey as flatCopyKey,
} from "../assets/phaser/greyTextures";
import { PALETTE } from "../ui/phaser/palette";
import { GREYED } from "../ui/selection";

// The grey copy of a disabled tile's art, GREYED.copyDarker steps down the neutral ramp.
export function disabledTextureKey(scene: Scene, key: string): string {
  return greyCopyKey(scene, GREYED.copyDarker, key);
}

// A locked item's flat copy of its art, in GREYED's silhouette colour.
export function silhouetteTextureKey(scene: Scene, key: string): string {
  return flatCopyKey(scene, PALETTE[GREYED.silhouette], key);
}
