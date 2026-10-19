import type { Scene } from "phaser";

import { remapToGrey } from "../assets/greyRamp";

// A copy of a texture with every colour moved to the grey ramp, made once and kept, with
// the same frames. Returns the original key when the copy cannot be made. Only the region
// the texture's frames cover is copied, since in a build its source is a shared atlas page.
export function greyTextureKey(scene: Scene, key: string): string {
  const greyKey = `${key}-grey`;
  if (scene.textures.exists(greyKey)) {
    return greyKey;
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
  const copy = scene.textures.createCanvas(greyKey, width, height);
  const context = copy?.getContext();
  if (copy === null || context === undefined) {
    return key;
  }
  context.drawImage(source, left, top, width, height, 0, 0, width, height);
  const pixels = context.getImageData(0, 0, width, height);
  remapToGrey(pixels.data);
  context.putImageData(pixels, 0, 0);
  for (const name of texture.getFrameNames()) {
    const frame = texture.get(name);
    copy.add(name, 0, frame.cutX - left, frame.cutY - top, frame.cutWidth, frame.cutHeight);
  }
  copy.refresh();
  return greyKey;
}
