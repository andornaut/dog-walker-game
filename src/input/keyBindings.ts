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

// During a walk, the digit keys 1..slotCount give that dog slot a treat. Zero-based.
export function dogSlotForKey(slotCount: number, key: string): number | undefined {
  const slotNumber = cardNumberForKey(slotCount, key);
  return slotNumber === undefined ? undefined : slotNumber - 1;
}

// Escape or P opens the pause menu, and closes it again.
export function isPauseKey(key: string): boolean {
  return key === "Escape" || key.toLowerCase() === "p";
}

// Enter or Space presses the screen's main button.
export function isConfirmKey(key: string): boolean {
  return key === "Enter" || key === " ";
}
