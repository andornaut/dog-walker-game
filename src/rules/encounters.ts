import type { DogId, EncounterId, GameData } from "../data/types";
import { packDogs } from "../state/pack";
import type { RunState } from "../state/runState";
import { assertNever } from "./assertNever";
import { evaluateCondition } from "./conditions";
import { catchChance } from "./dogs";

// The dogs an encounter affects when the pack meets it. "caught" rolls once per dog.
export function affectedDogs(
  data: Pick<GameData, "dogs" | "encounters" | "tuning">,
  random: () => number,
  state: RunState,
  encounterId: EncounterId,
): DogId[] {
  const pack = packDogs(state);
  const { affects } = data.encounters[encounterId];
  switch (affects.kind) {
    case "all":
      return pack;
    case "caught":
      return pack.filter((id) => random() < catchChance(data.tuning, data.dogs[id]));
    case "trait":
      return pack.filter((id) => data.dogs[id].trait === affects.trait);
    default:
      return assertNever(affects);
  }
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
