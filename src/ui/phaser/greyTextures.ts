import type { Scene } from "phaser";

import { remapToGrey } from "../../assets/greyRamp";
import { NEUTRAL_RAMP } from "./palette";

// A copy of a texture with remap applied to its pixels, made once and kept under
// key-suffix, with the same frames. Returns the original key when the copy cannot be made.
// Only the region the texture's frames cover is copied, since in a build its source is a
// shared atlas page. A trimmed frame keeps its trim.
function remappedTextureKey(
  scene: Scene,
  suffix: string,
  remap: (pixels: Uint8ClampedArray) => void,
  key: string,
): string {
  const copyKey = `${key}-${suffix}`;
  if (scene.textures.exists(copyKey)) {
    return copyKey;
  }
  if (!scene.textures.exists(key)) {
    return key;
  }
  const texture = scene.textures.get(key);
  const frames = texture.getFrameNames(true).map((name) => texture.get(name));
  const left = Math.min(...frames.map(({ cutX }) => cutX));
  const top = Math.min(...frames.map(({ cutY }) => cutY));
  const width = Math.max(...frames.map(({ cutWidth, cutX }) => cutX + cutWidth)) - left;
  const height = Math.max(...frames.map(({ cutHeight, cutY }) => cutY + cutHeight)) - top;
  const source = texture.getSourceImage() as CanvasImageSource;
  const copy = scene.textures.createCanvas(copyKey, width, height);
  const context = copy?.getContext();
  if (copy === null || context === undefined) {
    return key;
  }
  context.drawImage(source, left, top, width, height, 0, 0, width, height);
  const pixels = context.getImageData(0, 0, width, height);
  remap(pixels.data);
  context.putImageData(pixels, 0, 0);
  for (const name of texture.getFrameNames()) {
    const frame = texture.get(name);
    const { cutHeight, cutWidth, cutX, cutY, realHeight, realWidth } = frame;
    const added = copy.add(name, 0, cutX - left, cutY - top, cutWidth, cutHeight);
    if (cutWidth !== realWidth || cutHeight !== realHeight) {
      added?.setTrim(realWidth, realHeight, frame.x, frame.y, cutWidth, cutHeight);
    }
  }
  copy.refresh();
  return copyKey;
}

// Every colour moved to the neutral ramp, as a disabled card draws.
export function greyTextureKey(scene: Scene, key: string): string {
  return remappedTextureKey(scene, "grey", (pixels) => remapToGrey(NEUTRAL_RAMP, 0, pixels), key);
}

// The grey copy steps further down the neutral ramp, as art inside a disabled tile draws. The
// copy is kept per key, so a scene passes the same steps every time.
export function disabledTextureKey(scene: Scene, steps: number, key: string): string {
  return remappedTextureKey(
    scene,
    "disabled",
    (pixels) => remapToGrey(NEUTRAL_RAMP, steps, pixels),
    key,
  );
}
