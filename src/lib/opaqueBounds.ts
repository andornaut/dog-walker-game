export interface PixelBounds {
  bottom: number;
  left: number;
  right: number;
  top: number;
}

// The smallest box around the opaque pixels, with right and bottom one past the last
// opaque column and row. Undefined when nothing is opaque.
export function opaqueBounds(
  width: number,
  height: number,
  isOpaque: (x: number, y: number) => boolean,
): PixelBounds | undefined {
  let bounds: PixelBounds | undefined;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (isOpaque(x, y)) {
        bounds = {
          bottom: Math.max(bounds?.bottom ?? 0, y + 1),
          left: Math.min(bounds?.left ?? x, x),
          right: Math.max(bounds?.right ?? 0, x + 1),
          top: Math.min(bounds?.top ?? y, y),
        };
      }
    }
  }
  return bounds;
}

// opaqueBounds over RGBA bytes, as canvas ImageData holds them: a pixel is opaque when its
// alpha byte is not 0.
export function opaqueBoundsOfRgba(
  width: number,
  height: number,
  rgba: ArrayLike<number>,
): PixelBounds | undefined {
  return opaqueBounds(width, height, (x, y) => (rgba[(y * width + x) * 4 + 3] ?? 0) > 0);
}
