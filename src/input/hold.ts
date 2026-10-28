import type { LiveTuning } from "../data/types";
import type { Point } from "../lib/rect";
import { read } from "../rules/units";
import { exceedsTapDistance } from "./gestures";

// A press held holdMs without moving more than slopPx holds instead of tapping. A rule with
// an infinite slopPx holds however far the press moves.
export interface HoldRule {
  readonly holdMs: number;
  readonly slopPx: number;
}

// Every hold lasts seconds.holdSeconds, read at the press; each rule sets only its slop.
export function holdRule(tuning: LiveTuning, slopPx: number): HoldRule {
  return { holdMs: read(tuning, "seconds", "holdSeconds") * 1000, slopPx };
}

// The home screen's and Pet shop's tiles: a hold opens the item's detail card.
export const TILE_SLOP_PX = 10;

// A finger on a holdable item. holding: still a candidate for a hold. held: the hold has
// fired, so the release does nothing. moved: it left the slop, so it can only tap.
export interface HoldPress {
  readonly rule: HoldRule;
  readonly start: Point;
  readonly startedMs: number;
  readonly state: "held" | "holding" | "moved";
}

export function startHold(rule: HoldRule, start: Point, startedMs: number): HoldPress {
  return { rule, start, startedMs, state: "holding" };
}

// A press that moves past the slop stops being a hold.
export function moveHold(to: Point, press: HoldPress): HoldPress {
  if (press.state !== "holding") {
    return press;
  }
  return exceedsTapDistance(press.rule.slopPx, press.start, to)
    ? { ...press, state: "moved" }
    : press;
}

// Each frame: fire tells the caller to act on the hold, once, when the hold time is up.
export function tickHold(nowMs: number, press: HoldPress): { fire: boolean; press: HoldPress } {
  if (press.state === "holding" && nowMs - press.startedMs >= press.rule.holdMs) {
    return { fire: true, press: { ...press, state: "held" } };
  }
  return { fire: false, press };
}

// What a release does. A press that reached the hold time between frames still holds, so a
// long press never also counts as a tap.
export function releaseHold(nowMs: number, press: HoldPress): "hold" | "none" | "tap" {
  switch (press.state) {
    case "held":
      return "none";
    case "moved":
      return "tap";
    case "holding":
      return nowMs - press.startedMs >= press.rule.holdMs ? "hold" : "tap";
    default:
      return press.state satisfies never;
  }
}
