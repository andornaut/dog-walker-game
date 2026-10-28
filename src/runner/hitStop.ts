import type { CardSource } from "../data/types";
import { SECONDS_EPSILON } from "./fixedStep";

// What a hit stop holds back until it ends: the cards met on the step of the hit, and
// whether that step reached the end of the zone.
export interface HeldStep {
  readonly cards: readonly CardSource[];
  readonly zoneEnded: boolean;
}

// The walk held still after a hit that plays a moment, or while an owner who fired you has
// their moment, for seconds more of simulated time. A firing's stop draws the whole walk
// standing still, as a card does.
export interface HitStop extends HeldStep {
  readonly firing: boolean;
  readonly seconds: number;
}

interface HitStopLengths {
  readonly encounter: number;
  readonly minor: number;
}

// The longest stop a step's hits call for: an encounter hit moment's, a minor obstacle's, or 0.
export function hitStopLength(
  lengths: HitStopLengths,
  hits: { readonly encounters: number; readonly minors: number },
): number {
  return Math.max(hits.encounters > 0 ? lengths.encounter : 0, hits.minors > 0 ? lengths.minor : 0);
}

export function startHitStop(firing: boolean, seconds: number, held: HeldStep): HitStop | null {
  return seconds > SECONDS_EPSILON ? { ...held, firing, seconds } : null;
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
