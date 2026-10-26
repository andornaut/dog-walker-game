import type { Textures } from "phaser";

import type { Rect } from "../lib/rect";

// The rect each mask texture was last painted with.
const PAINTED = new WeakMap<Textures.CanvasTexture, Rect>();

function sameRect(a: Rect, b: Rect): boolean {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

// The canvas texture named key, size wide and tall, white over rect and clear elsewhere. It is
// created on first use and repainted whenever rect differs from the one it was painted with,
// so one texture follows a mask whose rect changes. undefined when no canvas can be made.
export function paintRectMask(
  textures: Pick<Textures.TextureManager, "createCanvas" | "exists" | "get">,
  size: { readonly height: number; readonly width: number },
  key: string,
  rect: Rect,
): Textures.CanvasTexture | undefined {
  const mask = textures.exists(key)
    ? (textures.get(key) as Textures.CanvasTexture)
    : textures.createCanvas(key, size.width, size.height);
  if (mask === null) {
    return undefined;
  }
  const painted = PAINTED.get(mask);
  if (painted !== undefined && sameRect(painted, rect)) {
    return mask;
  }
  const context = mask.getContext();
  context.clearRect(0, 0, mask.width, mask.height);
  context.fillStyle = "#ffffff";
  context.fillRect(rect.x, rect.y, rect.width, rect.height);
  mask.refresh();
  PAINTED.set(mask, { height: rect.height, width: rect.width, x: rect.x, y: rect.y });
  return mask;
}
