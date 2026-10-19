import type { Point, Rect } from "../layout/rect";

// Pixels as RGBA bytes, row by row from the top-left.
export interface RgbaImage {
  data: Uint8Array;
  height: number;
  width: number;
}

export function blankImage(width: number, height: number): RgbaImage {
  return { data: new Uint8Array(width * height * 4), height, width };
}

const clamp = (value: number, max: number) => Math.min(max, Math.max(0, value));

// Copies the from rect of source to target with its top-left at, then repeats its edge
// pixels extrude pixels outward on every side.
export function blitExtruded(
  source: RgbaImage,
  from: Rect,
  extrude: number,
  target: RgbaImage,
  at: Point,
): void {
  for (let dy = -extrude; dy < from.height + extrude; dy++) {
    const sourceY = from.y + clamp(dy, from.height - 1);
    for (let dx = -extrude; dx < from.width + extrude; dx++) {
      const sourceX = from.x + clamp(dx, from.width - 1);
      const read = (sourceY * source.width + sourceX) * 4;
      const write = ((at.y + dy) * target.width + at.x + dx) * 4;
      target.data.set(source.data.subarray(read, read + 4), write);
    }
  }
}
