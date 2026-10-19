import type { LaneDirection } from "../layout/lanes";

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
