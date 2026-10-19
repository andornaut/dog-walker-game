import type { DogId } from "../data/types";
import type { Hearts } from "../rules/units";
import type { Pack, PackDogs, PackSlot, RunState } from "./runState";

// Dogs still walking with at least one heart, in pack order.
export function packDogs(state: Pick<RunState, "pack">): DogId[] {
  return state.pack.flatMap((slot) =>
    slot.status === "walking" && slot.hearts > 0 ? [slot.dog] : [],
  );
}

export function heartsOf(state: Pick<RunState, "pack">, dog: DogId): Hearts | undefined {
  const slot = state.pack.find((candidate) => candidate.dog === dog);
  return slot?.status === "walking" ? slot.hearts : undefined;
}

// map keeps the length, so the result is a pack of the same size.
export function mapPack(update: (slot: PackSlot) => PackSlot, pack: Pack): Pack {
  return pack.map(update) as readonly PackSlot[] as Pack;
}

export function packFor(toSlot: (dog: DogId) => PackSlot, dogs: PackDogs): Pack {
  return dogs.map(toSlot) as readonly PackSlot[] as Pack;
}
