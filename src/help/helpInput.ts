import type { Point } from "@andornaut/game-kit/rect";

import { gameData } from "../data";
import { exceedsTapDistance, swipeDirection } from "../input/gestures";
import { isConfirmKey, isPauseKey, laneDirectionForKey } from "../input/keyBindings";
import { read } from "../rules/units";
import { helpActionAt } from "./helpLayout";
import type { HelpAction } from "./helpPaging";

// A swipe turns a page once it travels this far.
const SWIPE_MIN_DISTANCE = 40;

// The lane keys turn pages: arrows, A/D and H/L. Enter and Space press Next; Escape or P closes.
// A key's auto-repeat turns pages but never presses Next or closes, so a held Enter cannot
// run through the pages and out of the help.
export function helpActionForKey(repeat: boolean, key: string): HelpAction | undefined {
  if (isPauseKey(key)) {
    return repeat ? undefined : { kind: "close" };
  }
  if (isConfirmKey(key)) {
    return repeat ? undefined : { kind: "advance" };
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
  const swipe = swipeDirection(SWIPE_MIN_DISTANCE, start, end);
  if (swipe !== undefined) {
    return swipe === -1 ? { kind: "next" } : { kind: "previous" };
  }
  if (exceedsTapDistance(read(gameData.tuning, "pixels", "tapMaxDistance"), start, end)) {
    return undefined;
  }
  return helpActionAt(pageCount, start);
}
