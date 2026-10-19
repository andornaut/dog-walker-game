// Placed by its top-left corner, in screen pixels.
export interface Rect {
  height: number;
  width: number;
  x: number;
  y: number;
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
