import type { RgbaImage } from "@andornaut/game-kit/art/rgbaImage";
import type { Rect } from "@andornaut/game-kit/rect";

// The smallest rect inside within that holds every pixel of image with any opacity, or
// undefined when all of within is clear.
export function opaqueRect(image: RgbaImage, within: Rect): Rect | undefined {
  let [left, top, right, bottom] = [Infinity, Infinity, -Infinity, -Infinity];
  for (let y = within.y; y < within.y + within.height; y++) {
    for (let x = within.x; x < within.x + within.width; x++) {
      if (image.data[(y * image.width + x) * 4 + 3] !== 0) {
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
    }
  }
  return left > right
    ? undefined
    : { height: bottom - top + 1, width: right - left + 1, x: left, y: top };
}
