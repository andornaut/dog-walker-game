import type { Condition, Dog, DogId } from "../data/types";
import { assertNever } from "./assertNever";

export function evaluateCondition(
  dogs: Readonly<Record<DogId, Dog>>,
  condition: Condition,
  pack: readonly DogId[],
): boolean {
  switch (condition.kind) {
    case "packHasSize":
      return pack.some((id) => dogs[id].size === condition.size);
    case "packHasTrait":
      return pack.some((id) => dogs[id].trait === condition.trait);
    default:
      return assertNever(condition);
  }
}
