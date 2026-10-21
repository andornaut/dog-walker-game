import type { DogId } from "../data/types";
import { type HeldStep, type HitStop, startHitStop } from "./hitStop";

// What a firing leaves the walk with: the stop it holds the walk in, and what is still queued
// outside it.
export interface FiringHold {
  readonly queued: HeldStep;
  readonly stop: HitStop | null;
}

// An owner who fires you holds the walk still for seconds while their moment plays, the same
// way a hit stop does: the queued cards and a pending zone end wait inside the stop and open
// when it ends. A stop already running keeps the longer of the two and holds what both hold.
// No firing, or no length, changes nothing.
export function holdForFiring(
  seconds: number,
  fired: readonly DogId[],
  queued: HeldStep,
  current: HitStop | null,
): FiringHold {
  if (fired.length === 0) {
    return { queued, stop: current };
  }
  const stop = startHitStop(true, Math.max(seconds, current?.seconds ?? 0), {
    cards: [...(current?.cards ?? []), ...queued.cards],
    zoneEnded: (current?.zoneEnded ?? false) || queued.zoneEnded,
  });
  if (stop === null) {
    return { queued, stop: current };
  }
  return { queued: { cards: [], zoneEnded: false }, stop };
}
