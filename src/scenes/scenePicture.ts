import type { GameObjects, Scene } from "phaser";

import { type PictureStrip, stripViewports } from "../help/helpPictures";
import type { Rect } from "../lib/rect";

// A scene drawn as a still picture of the screen inside frame: a camera per strip shows its
// screen rows, top to bottom. A scene shown this way takes no input.
export interface ScenePicture {
  readonly frame: Rect;
  readonly strips: readonly PictureStrip[];
}

// Points the scene's cameras at the picture's strips: the main camera at the first, a camera
// added for each one after.
export function showAsPicture(scene: Scene, picture: ScenePicture): void {
  stripViewports(picture.frame, picture.strips).forEach((viewport, i) => {
    const strip = picture.strips[i];
    if (strip === undefined) {
      return;
    }
    const camera = i === 0 ? scene.cameras.main : scene.cameras.add();
    camera
      .setViewport(viewport.x, viewport.y, viewport.width, viewport.height)
      .setScroll(0, strip.screenY);
  });
}

// Holds the scene still as it is: its updates, tweens, timers and animations stop, while it
// keeps drawing. frames sets the frame an animation shows, by its key, instead of the one it
// is on.
export function freezeScene(scene: Scene, frames: Readonly<Record<string, number>> = {}): void {
  for (const child of scene.children.list) {
    if (!("anims" in child)) {
      continue;
    }
    const sprite = child as GameObjects.Sprite;
    const animation = sprite.anims.currentAnim;
    if (animation === null) {
      continue;
    }
    const index = frames[animation.key];
    sprite.anims.pause(index === undefined ? undefined : animation.frames[index]);
  }
  scene.scene.pause();
}
