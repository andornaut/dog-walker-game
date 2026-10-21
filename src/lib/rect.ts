// A position in screen pixels.
export interface Point {
  readonly x: number;
  readonly y: number;
}

// Placed by its top-left corner, in screen pixels.
export interface Rect {
  height: number;
  width: number;
  x: number;
  y: number;
}

// The left and top edges are inside the rect, the right and bottom edges outside.
export function containsPoint(rect: Rect, x: number, y: number): boolean {
  return x >= rect.x && x < rect.x + rect.width && y >= rect.y && y < rect.y + rect.height;
}

// Whether two rects share any pixel.
export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

// The rect shrunk by the same amount on every side.
export function insetRect(amount: number, rect: Rect): Rect {
  return {
    height: rect.height - 2 * amount,
    width: rect.width - 2 * amount,
    x: rect.x + amount,
    y: rect.y + amount,
  };
}
