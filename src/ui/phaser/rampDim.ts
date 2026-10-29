import { Core, type GameObjects, type Scene, Scenes } from "phaser";

import { remapDarker } from "../../assets/darkRamp";
import type { Rect } from "../../lib/rect";
import { addDim } from "./draw";

// What an overlay dims is redrawn this many steps down each colour's ramp.
const DIM_STEPS = 2;

// The part of a scene rect its main camera shows, in the scene's coordinates and on the game's
// canvas, or undefined when the camera shows none of it.
function shownPart(scene: Scene, rect: Rect): { canvas: Rect; world: Rect } | undefined {
  const camera = scene.cameras.main;
  const dx = camera.x - camera.scrollX;
  const dy = camera.y - camera.scrollY;
  const left = Math.max(rect.x + dx, camera.x);
  const top = Math.max(rect.y + dy, camera.y);
  const right = Math.min(rect.x + rect.width + dx, camera.x + camera.width);
  const bottom = Math.min(rect.y + rect.height + dy, camera.y + camera.height);
  if (right <= left || bottom <= top) {
    return undefined;
  }
  const canvas = { height: bottom - top, width: right - left, x: left, y: top };
  return { canvas, world: { ...canvas, x: left - dx, y: top - dy } };
}

// Dims rect under an overlay the style guide's way: the frozen view read back from the next
// frame and redrawn DIM_STEPS down each colour's ramp, never blended with black. The overlay
// scene's cameras are hidden for that frame, so the read-back holds only the scenes beneath it,
// never the overlay's own objects, which may later hide or move. Only the part the scene's
// camera shows is read back. Where the renderer gives no snapshot to remap, the ink layer stands
// in. Each scene keeps its own texture, so two overlays can dim at once. onDrawn, if given, is
// called as the overlay's first drawn frame begins, unless the scene shuts down first. Returns
// the objects it adds, for a scene that redraws to keep (clearScene).
export function addRampDim(
  scene: Scene,
  rect: Rect,
  onDrawn?: () => void,
): readonly GameObjects.GameObject[] {
  const drawn = () => {
    if (onDrawn !== undefined) {
      onceBeforeRender(scene, onDrawn);
    }
  };
  const shown = shownPart(scene, rect);
  if (shown === undefined) {
    drawn();
    return [];
  }
  const { canvas, world } = shown;
  const shade = addDim(scene, world).setVisible(false);
  const dim = scene.add.image(world.x, world.y, "__DEFAULT").setOrigin(0).setVisible(false);
  const key = `${scene.scene.key}-dim`;
  const fallback = () => shade.setVisible(true);
  // The renderer reads the snapshot back in its post-render step, before the game's
  // POST_RENDER event, so the cameras show again from the following frame.
  const shownCameras = scene.cameras.cameras.filter((camera) => camera.visible);
  shownCameras.forEach((camera) => camera.setVisible(false));
  scene.game.events.once(Core.Events.POST_RENDER, () => {
    shownCameras.forEach((camera) => camera.setVisible(true));
    drawn();
  });
  scene.game.renderer.snapshotArea(canvas.x, canvas.y, canvas.width, canvas.height, (snapshot) => {
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
    const texture = scene.textures.createCanvas(key, canvas.width, canvas.height);
    const context = texture?.getContext();
    if (texture === null || context === undefined) {
      fallback();
      return;
    }
    context.drawImage(snapshot, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    remapDarker(DIM_STEPS, pixels.data);
    context.putImageData(pixels, 0, 0);
    texture.refresh();
    dim.setTexture(key).setVisible(true);
  });
  return [shade, dim];
}

// Calls then once, before the game's next frame is rendered, unless scene shuts down first.
export function onceBeforeRender(scene: Scene, then: () => void): void {
  const { events } = scene.game;
  const forget = () => events.off(Core.Events.PRE_RENDER, then);
  events.once(Core.Events.PRE_RENDER, then);
  scene.events.once(Scenes.Events.SHUTDOWN, forget);
}
