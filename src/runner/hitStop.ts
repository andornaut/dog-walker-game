import type { CardSource } from "../state/runState";

// What a hit stop holds back until it ends: the cards met on the step of the hit, and
// whether that step reached the end of the zone.
export interface HeldStep {
  readonly cards: readonly CardSource[];
  readonly zoneEnded: boolean;
}

// The walk held still after an obstacle hit, for seconds more of simulated time.
export interface HitStop extends HeldStep {
  readonly seconds: number;
}

export interface HitStopLengths {
  readonly encounter: number;
  readonly minor: number;
}

// Fixed steps do not sum exactly to a tuned length (60 steps of 1/60 s fall short of 1 s by
// a rounding error), so a remainder this small ends the stop.
const SECONDS_EPSILON = 1e-6;

// The longest stop a step's hits call for: an obstacle encounter's, a minor obstacle's, or 0.
export function hitStopLength(
  lengths: HitStopLengths,
  hits: { readonly encounters: number; readonly minors: number },
): number {
  return Math.max(hits.encounters > 0 ? lengths.encounter : 0, hits.minors > 0 ? lengths.minor : 0);
}

export function startHitStop(seconds: number, held: HeldStep): HitStop | null {
  return seconds > SECONDS_EPSILON ? { ...held, seconds } : null;
}

// One step spent in a stop: the stop with that much less left, or, once nothing is left,
// what it held.
export function tickHitStop(
  stepSeconds: number,
  stop: HitStop,
): { readonly released: HeldStep } | { readonly stop: HitStop } {
  const seconds = stop.seconds - stepSeconds;
  if (seconds <= SECONDS_EPSILON) {
    return { released: { cards: stop.cards, zoneEnded: stop.zoneEnded } };
  }
  return { stop: { ...stop, seconds } };
}
