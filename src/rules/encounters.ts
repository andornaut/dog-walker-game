import type { DogId, Encounter, EncounterId } from "../data/types";
import { packDogs } from "../state/pack";
import type { RunState } from "../state/runState";

// The dogs an encounter affects when the pack meets it: every card hits the whole pack.
export function affectedDogs(state: Pick<RunState, "pack">): DogId[] {
  return packDogs(state);
}

// No card opens when no dog is affected or the pack is immune.
export function opensCard(
  affected: readonly DogId[],
  state: Pick<RunState, "immunities">,
  encounterId: EncounterId,
): boolean {
  return (
    affected.length > 0 && !state.immunities.some(({ encounter }) => encounter === encounterId)
  );
}

// The label shown large as the pack meets an obstacle, before its card; null for a lucky find,
// which plays no hit moment.
export function hitLabel(encounter: Encounter): string | null {
  return encounter.kind === "obstacle" ? encounter.hitLabel : null;
}
