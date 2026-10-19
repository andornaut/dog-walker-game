import type { Point } from "../layout/rect";

// A press held this long without moving more than slopPx opens the item's detail card
// instead of tapping it.
export const HOLD = { holdMs: 400, slopPx: 10 } as const;

// A finger on a holdable item. holding: still a candidate for a hold. held: the hold has
// fired, so the release does nothing. moved: it left the slop, so it can only tap.
export interface HoldPress {
  readonly start: Point;
  readonly startedMs: number;
  readonly state: "held" | "holding" | "moved";
}

export function startHold(start: Point, startedMs: number): HoldPress {
  return { start, startedMs, state: "holding" };
}

// A press that moves past the slop stops being a hold.
export function moveHold(press: HoldPress, to: Point): HoldPress {
  if (press.state !== "holding") {
    return press;
  }
  const far = Math.hypot(to.x - press.start.x, to.y - press.start.y) > HOLD.slopPx;
  return far ? { ...press, state: "moved" } : press;
}

// Each frame: fire tells the caller to open the card, once, when the hold time is up.
export function tickHold(press: HoldPress, nowMs: number): { fire: boolean; press: HoldPress } {
  if (press.state === "holding" && nowMs - press.startedMs >= HOLD.holdMs) {
    return { fire: true, press: { ...press, state: "held" } };
  }
  return { fire: false, press };
}

// What a release does. A press that reached the hold time between frames still holds, so a
// long press never also counts as a tap.
export function releaseHold(press: HoldPress, nowMs: number): "hold" | "none" | "tap" {
  switch (press.state) {
    case "held":
      return "none";
    case "moved":
      return "tap";
    case "holding":
      return nowMs - press.startedMs >= HOLD.holdMs ? "hold" : "tap";
    default:
      return press.state satisfies never;
  }
}
