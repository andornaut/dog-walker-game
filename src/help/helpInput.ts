import { type GestureConfig, swipeDirection } from "../input/gestures";
import { laneDirectionForKey } from "../input/keyBindings";
import { helpActionAt, type Point } from "./helpLayout";
import type { HelpAction } from "./helpPaging";

export const HELP_GESTURES: Pick<GestureConfig, "swipeMinDistance" | "tapMaxDistance"> = {
  swipeMinDistance: 40,
  tapMaxDistance: 10,
};

// The lane keys turn pages: arrows, A/D and H/L. Enter and Space press Next; Escape closes.
export function helpActionForKey(key: string): HelpAction | undefined {
  if (key === "Escape") {
    return { kind: "close" };
  }
  if (key === "Enter" || key === " ") {
    return { kind: "advance" };
  }
  const direction = laneDirectionForKey(key);
  if (direction === undefined) {
    return undefined;
  }
  return direction === 1 ? { kind: "next" } : { kind: "previous" };
}

// Read on release. A swipe left brings in the next page, as if dragging the page aside;
// a tap acts on the button or dot where it started.
export function helpActionForPointer(
  pageCount: number,
  start: Point,
  end: Point,
): HelpAction | undefined {
  const swipe = swipeDirection(HELP_GESTURES.swipeMinDistance, start, end);
  if (swipe !== undefined) {
    return swipe === -1 ? { kind: "next" } : { kind: "previous" };
  }
  if (Math.hypot(end.x - start.x, end.y - start.y) > HELP_GESTURES.tapMaxDistance) {
    return undefined;
  }
  return helpActionAt(pageCount, start);
}
