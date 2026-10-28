import type { DogId, GameData, Size } from "../data/types";
import type { Hearts } from "../lib/units";
import type { Pack, PackDogs, PackSlot, RunState } from "./runState";

const SIZE_ORDER: readonly Size[] = ["large", "medium", "small"];

// The pack's order, from the dogs alone, never the order they were picked in: the biggest
// first, ties in roster order. The first is the front dog, which leads the formation and takes
// head-on hits and the pickups only the walker touches.
export function packOrder<Dogs extends readonly DogId[]>(
  roster: GameData["dogs"],
  dogs: Dogs,
): Dogs {
  const ids = Object.keys(roster);
  const sorted = [...dogs].sort(
    (a, b) =>
      SIZE_ORDER.indexOf(roster[a].size) - SIZE_ORDER.indexOf(roster[b].size) ||
      ids.indexOf(a) - ids.indexOf(b),
  );
  // Sorting keeps the dogs, and so a pack's length.
  return sorted as readonly DogId[] as Dogs;
}

// Dogs still walking with at least one heart, in pack order. A loop, as the walk asks for it
// several times a step.
export function packDogs(state: Pick<RunState, "pack">): DogId[] {
  const dogs: DogId[] = [];
  for (const slot of state.pack) {
    if (slot.status === "walking" && slot.hearts > 0) {
      dogs.push(slot.dog);
    }
  }
  return dogs;
}

// Those of dogs still walking (packDogs), in pack order.
export function walkingAmong(state: Pick<RunState, "pack">, dogs: readonly DogId[]): DogId[] {
  return packDogs(state).filter((dog) => dogs.includes(dog));
}

export function heartsOf(state: Pick<RunState, "pack">, dog: DogId): Hearts | undefined {
  const slot = state.pack.find((candidate) => candidate.dog === dog);
  return slot?.status === "walking" ? slot.hearts : undefined;
}

// The index of dog's slot in pack, or -1 when it has none.
export function slotIndexOf(pack: readonly PackSlot[], dog: DogId): number {
  return pack.findIndex((slot) => slot.dog === dog);
}

// map keeps the length, so the result is a pack of the same size.
export function mapPack(update: (slot: PackSlot) => PackSlot, pack: Pack): Pack {
  return pack.map(update) as readonly PackSlot[] as Pack;
}

export function packFor(toSlot: (dog: DogId) => PackSlot, dogs: PackDogs): Pack {
  return dogs.map(toSlot) as readonly PackSlot[] as Pack;
}

// The dogs as a pack a walk can start with, or undefined for none or more than three.
export function packDogsOf(dogs: readonly DogId[]): PackDogs | undefined {
  const [first, second, third] = dogs;
  if (first === undefined || dogs.length > 3) {
    return undefined;
  }
  if (second === undefined) {
    return [first];
  }
  return third === undefined ? [first, second] : [first, second, third];
}
