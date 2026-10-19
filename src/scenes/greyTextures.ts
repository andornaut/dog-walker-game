import type { Scene } from "phaser";

import { remapToGrey } from "../assets/greyRamp";

// A copy of a texture with every colour moved to the grey ramp, made once and kept, with
// the same frames. Returns the original key when the copy cannot be made.
export function greyTextureKey(scene: Scene, key: string): string {
  const greyKey = `${key}-grey`;
  if (scene.textures.exists(greyKey)) {
    return greyKey;
  }
  if (!scene.textures.exists(key)) {
    return key;
  }
  const texture = scene.textures.get(key);
  const source = texture.getSourceImage() as CanvasImageSource & { height: number; width: number };
  const copy = scene.textures.createCanvas(greyKey, source.width, source.height);
  const context = copy?.getContext();
  if (copy === null || context === undefined) {
    return key;
  }
  context.drawImage(source, 0, 0);
  const pixels = context.getImageData(0, 0, source.width, source.height);
  remapToGrey(pixels.data);
  context.putImageData(pixels, 0, 0);
  for (const name of texture.getFrameNames()) {
    const frame = texture.get(name);
    copy.add(name, 0, frame.cutX, frame.cutY, frame.cutWidth, frame.cutHeight);
  }
  copy.refresh();
  return greyKey;
}
