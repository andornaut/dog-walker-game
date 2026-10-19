import type { DogId, Encounter, EncounterId, GameData } from "../data/types";
import { packDogs } from "../state/pack";
import type { RunState } from "../state/runState";
import { assertNever } from "./assertNever";
import { evaluateCondition } from "./conditions";

// The dogs an encounter affects when the pack meets it: an area effect catches the dogs of
// the sizes it lists.
export function affectedDogs(
  data: Pick<GameData, "dogs" | "encounters">,
  state: RunState,
  encounterId: EncounterId,
): DogId[] {
  const pack = packDogs(state);
  const { affects } = data.encounters[encounterId];
  switch (affects.kind) {
    case "all":
      return pack;
    case "caught":
      return pack.filter((id) => affects.catches.includes(data.dogs[id].size));
    case "trait":
      return pack.filter((id) => data.dogs[id].trait === affects.trait);
    default:
      return assertNever(affects);
  }
}

// The dogs that hop over an area effect: those of a size it does not catch. None for any
// other encounter.
export function hoppingDogs(
  data: Pick<GameData, "dogs" | "encounters">,
  state: RunState,
  encounterId: EncounterId,
): DogId[] {
  const { affects } = data.encounters[encounterId];
  return affects.kind === "caught"
    ? packDogs(state).filter((id) => !affects.catches.includes(data.dogs[id].size))
    : [];
}

// No card opens when no dog is affected, the pack is immune, or noCardWhen holds.
export function opensCard(
  data: Pick<GameData, "dogs" | "encounters">,
  affected: readonly DogId[],
  state: RunState,
  encounterId: EncounterId,
): boolean {
  const { noCardWhen } = data.encounters[encounterId];
  return (
    affected.length > 0 &&
    !state.immunities.some(({ encounter }) => encounter === encounterId) &&
    !(noCardWhen !== undefined && evaluateCondition(data.dogs, noCardWhen, packDogs(state)))
  );
}

// The label shown large as the pack meets an encounter, before its card: every obstacle's, and
// a lucky card's that has one. null for an encounter that plays no hit moment.
export function hitLabel(encounter: Encounter): string | null {
  if (encounter.kind === "obstacle") {
    return encounter.hitLabel;
  }
  return "hitLabel" in encounter ? (encounter.hitLabel ?? null) : null;
}
