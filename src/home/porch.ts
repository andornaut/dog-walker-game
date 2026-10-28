import type { DogId, GameData } from "../data/types";
import { keysOf } from "../lib/records";
import type { SaveStats } from "../save/schema";

// A starter owner waiting at the gate, and whether their dog still waits with them: a dog
// the player has picked has gone to the walker.
interface PorchOwner {
  readonly dog: DogId;
  readonly withDog: boolean;
}

// Until the first walk ends, the starter dogs' owners wait at the gate in roster order; after
// it, nobody does.
export function porchOwners(
  data: Pick<GameData, "dogs">,
  stats: Pick<SaveStats, "lastWalk">,
  picked: readonly DogId[],
): PorchOwner[] {
  if (stats.lastWalk !== null) {
    return [];
  }
  return keysOf(data.dogs)
    .filter((dog) => data.dogs[dog].unlock === "start")
    .map((dog) => ({ dog, withDog: !picked.includes(dog) }));
}
