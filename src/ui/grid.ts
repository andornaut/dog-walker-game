import { containsPoint, type Point, type Rect } from "@andornaut/game-kit/rect";

export interface GridSpec {
  cellHeight: number;
  cellWidth: number;
  columns: number;
  gapX: number;
  gapY: number;
}

// count cells filled row by row from the top-left corner.
export function gridRects(spec: GridSpec, count: number, origin: Point): Rect[] {
  const { cellHeight, cellWidth, columns, gapX, gapY } = spec;
  return Array.from({ length: count }, (_, i) => ({
    height: cellHeight,
    width: cellWidth,
    x: origin.x + (i % columns) * (cellWidth + gapX),
    y: origin.y + Math.floor(i / columns) * (cellHeight + gapY),
  }));
}

// The index of the first rect holding the point, or undefined.
export function rectIndexAt(rects: readonly Rect[], x: number, y: number): number | undefined {
  const index = rects.findIndex((rect) => containsPoint(rect, x, y));
  return index < 0 ? undefined : index;
}
