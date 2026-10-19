import type { Scene } from "phaser";

import { remapDarker } from "../assets/darkRamp";
import type { Rect } from "../layout/rect";
import { addDim } from "./draw";

// What an overlay dims is redrawn this many steps down each colour's ramp.
const DIM_STEPS = 2;

// Dims rect under an overlay the style guide's way: the frozen view read back from the next
// frame and redrawn DIM_STEPS down each colour's ramp, never blended with black. The overlay's
// own objects drawn in that frame are darkened in the read-back too, but this image sits under
// them, so call it before adding them. Where the renderer gives no snapshot to remap, the ink
// layer stands in. Each scene keeps its own texture, so two overlays can dim at once.
export function addRampDim(scene: Scene, rect: Rect): void {
  const shade = addDim(scene, rect).setVisible(false);
  const dim = scene.add.image(rect.x, rect.y, "__DEFAULT").setOrigin(0).setVisible(false);
  const key = `${scene.scene.key}-dim`;
  const fallback = () => shade.setVisible(true);
  scene.game.renderer.snapshotArea(rect.x, rect.y, rect.width, rect.height, (snapshot) => {
    if (!dim.active) {
      return;
    }
    if (!(snapshot instanceof HTMLImageElement)) {
      fallback();
      return;
    }
    if (scene.textures.exists(key)) {
      scene.textures.remove(key);
    }
    const texture = scene.textures.createCanvas(key, rect.width, rect.height);
    const context = texture?.getContext();
    if (texture === null || context === undefined) {
      fallback();
      return;
    }
    context.drawImage(snapshot, 0, 0);
    const pixels = context.getImageData(0, 0, rect.width, rect.height);
    remapDarker(DIM_STEPS, pixels.data);
    context.putImageData(pixels, 0, 0);
    texture.refresh();
    dim.setTexture(key).setVisible(true);
  });
}
