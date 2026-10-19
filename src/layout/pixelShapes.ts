// A horizontal run of pixels on one row.
export interface PixelSpan {
  width: number;
  x: number;
  y: number;
}

export interface PixelBounds {
  bottom: number;
  left: number;
  right: number;
  top: number;
}

// A sprite's shadow is a little narrower than the sprite, and never a dot.
export function shadowRadiusX(spriteWidth: number): number {
  return Math.max(3, spriteWidth / 2 - 2);
}

// The pixels whose centres fall inside the ellipse, as one span per row.
export function pixelEllipseSpans(
  centerX: number,
  centerY: number,
  radiusX: number,
  radiusY: number,
): PixelSpan[] {
  const spans: PixelSpan[] = [];
  const rows = Math.ceil(radiusY) + 1;
  const columns = Math.ceil(radiusX) + 1;
  for (let dy = -rows; dy <= rows; dy++) {
    let first: number | undefined;
    let last = 0;
    for (let dx = -columns; dx <= columns; dx++) {
      const nx = (dx + 0.5) / radiusX;
      const ny = (dy + 0.5) / radiusY;
      if (nx * nx + ny * ny <= 1) {
        first ??= dx;
        last = dx;
      }
    }
    if (first !== undefined) {
      spans.push({
        width: last - first + 1,
        x: Math.floor(centerX + first),
        y: Math.floor(centerY + dy),
      });
    }
  }
  return spans;
}

// Bresenham's line: every pixel from one end to the other, each touching the last.
export function pixelLinePoints(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
): [number, number][] {
  let x = Math.round(fromX);
  let y = Math.round(fromY);
  const endX = Math.round(toX);
  const endY = Math.round(toY);
  const dx = Math.abs(endX - x);
  const dy = -Math.abs(endY - y);
  const stepX = x < endX ? 1 : -1;
  const stepY = y < endY ? 1 : -1;
  let error = dx + dy;
  const points: [number, number][] = [];
  for (;;) {
    points.push([x, y]);
    if (x === endX && y === endY) {
      return points;
    }
    const doubled = 2 * error;
    if (doubled >= dy) {
      error += dy;
      x += stepX;
    }
    if (doubled <= dx) {
      error += dx;
      y += stepY;
    }
  }
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
