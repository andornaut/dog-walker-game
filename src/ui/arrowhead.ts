import type { Point } from "../lib/rect";

// The compass step nearest a direction, one of 8: each coordinate -1, 0 or 1.
export function compassStep(dx: number, dy: number): Point {
  const octant = Math.round(Math.atan2(dy, dx) / (Math.PI / 4));
  const angle = (octant * Math.PI) / 4;
  // Adding 0 turns a -0 into 0.
  return { x: Math.round(Math.cos(angle)) + 0, y: Math.round(Math.sin(angle)) + 0 };
}

// The pixels of an arrowhead rows deep, pointing along the compass step nearest (dx, dy), as
// offsets from its tip pixel. Snapped to a compass step, it is symmetric about its own axis on
// the pixel grid: straight, its rows widen by 2 a row back from the tip (1, 3, 5...); diagonal,
// it is the corner of pixels within rows steps back along both of the step's axes.
export function arrowheadPixels(rows: number, dx: number, dy: number): Point[] {
  const step = compassStep(dx, dy);
  const pixels: Point[] = [];
  if (step.x !== 0 && step.y !== 0) {
    for (let back = 0; back < rows + 1; back++) {
      for (let across = 0; across <= back; across++) {
        pixels.push({ x: -step.x * across, y: -step.y * (back - across) });
      }
    }
    return pixels;
  }
  // Perpendicular to the step.
  const side = { x: -step.y, y: step.x };
  for (let back = 0; back < rows; back++) {
    for (let across = -back; across <= back; across++) {
      pixels.push({
        x: -step.x * back + side.x * across,
        y: -step.y * back + side.y * across,
      });
    }
  }
  return pixels;
}
