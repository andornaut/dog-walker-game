import type { LaneDirection } from "../layout/lanes";
import type { GestureAction } from "./gestures";

const LANE_CHANGE_KEYS: Partial<Record<string, LaneDirection>> = {
  a: -1,
  arrowleft: -1,
  arrowright: 1,
  d: 1,
  h: -1,
  l: 1,
};

// Arrows, A/D and the vim keys H/L, matched on KeyboardEvent.key in any case.
export function laneDirectionForKey(key: string): LaneDirection | undefined {
  return LANE_CHANGE_KEYS[key.toLowerCase()];
}

// The digit keys 1..cardCount pick that card.
export function cardNumberForKey(cardCount: number, key: string): number | undefined {
  const cardNumber = Number(key);
  return cardNumber >= 1 && cardNumber <= cardCount ? cardNumber : undefined;
}

// During a walk, a lane key moves a lane at once on the key going down. A held key's repeats
// do nothing, so each press acts once.
export function walkKeyAction(key: string, repeat: boolean): GestureAction | undefined {
  if (repeat) {
    return undefined;
  }
  const direction = laneDirectionForKey(key);
  return direction === undefined ? undefined : { direction, kind: "move" };
}

// Escape or P opens the pause menu, and closes it again. Over any other overlay or card it
// closes that, one level at a time, as the phone's back button does.
export function isPauseKey(key: string): boolean {
  return key === "Escape" || key.toLowerCase() === "p";
}

// M, in either case, mutes and unmutes.
export function isMuteKey(key: string): boolean {
  return key.toLowerCase() === "m";
}

// Enter or Space presses the screen's main button.
export function isConfirmKey(key: string): boolean {
  return key === "Enter" || key === " ";
}
