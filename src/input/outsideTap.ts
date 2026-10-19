import { containsPoint, type Point, type Rect } from "../layout/rect";
import { exceedsTapDistance } from "./gestures";

// Where a tap outside an overlay's panel counts: inside the dimmed area, off the panel and
// off every control drawn outside it, such as a close control in the screen's corner.
export interface OutsideArea {
  readonly covered: readonly Rect[];
  readonly dim: Rect;
}

export interface OutsidePress {
  readonly start: Point;
  readonly tapping: boolean;
}

export function isOutside(area: OutsideArea, point: Point): boolean {
  return (
    containsPoint(area.dim, point.x, point.y) &&
    !area.covered.some((rect) => containsPoint(rect, point.x, point.y))
  );
}

// A press that lands outside, or undefined for one that lands anywhere else.
export function outsidePressDown(area: OutsideArea, point: Point): OutsidePress | undefined {
  return isOutside(area, point) ? { start: point, tapping: true } : undefined;
}

// A press that travels past tapMaxDistance is a drag, and stays one.
export function outsidePressMove(
  tapMaxDistance: number,
  point: Point,
  press: OutsidePress,
): OutsidePress {
  const tapping = press.tapping && !exceedsTapDistance(tapMaxDistance, press.start, point);
  return { ...press, tapping };
}

// A tap outside: a press that landed outside, never travelled past tapMaxDistance, and is
// released outside. cancelled: the browser called the press off.
export function outsideTapped(
  area: OutsideArea,
  tapMaxDistance: number,
  cancelled: boolean,
  press: OutsidePress | undefined,
  point: Point,
): boolean {
  return (
    !cancelled &&
    press !== undefined &&
    outsidePressMove(tapMaxDistance, point, press).tapping &&
    isOutside(area, point)
  );
}
