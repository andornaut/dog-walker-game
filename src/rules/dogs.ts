import type { Dog, DogId, GameData, LiveTuning, Modifier, PackSize } from "../data/types";
import type { RunState } from "../state/runState";
import { modifiedStat } from "./modifiers";
import { clampHearts, type Hearts, read, readTable } from "./units";

// A dog's place in the pack a walk set out with, for the pack-size bonus: how many dogs the
// pack has, and whether the dog leads it.
export interface PackPlace {
  readonly lead: boolean;
  readonly size: PackSize;
}

// The place of dog in a pack of 1 to 3 dogs in pack order (packOrder), its lead first.
export function packPlace(order: readonly DogId[], dog: DogId): PackPlace {
  return { lead: order[0] === dog, size: order.length as PackSize };
}

// The hearts a dog's size gives its owner's meter, before the pack's size and any modifiers.
export function sizeHearts(tuning: LiveTuning, dog: Pick<Dog, "size">): number {
  return readTable(tuning, "hearts", "maxBySize", dog.size);
}

// A dog's place in the pack the walk set out with, fired dogs included, for its owner's max.
export function placeInPack(state: Pick<RunState, "pack">, dog: DogId): PackPlace {
  return packPlace(
    state.pack.map((slot) => slot.dog),
    dog,
  );
}

// The hearts a dog's place adds to its owner's max, before the cap: hearts.packSizeBonus for
// the pack's size to the lead dog's owner, and none to any other.
export function packSizeBonus(tuning: LiveTuning, place: PackPlace): number {
  return place.lead ? readTable(tuning, "hearts", "packSizeBonus", place.size) : 0;
}

// A dog's owner's max before modifiers and the cap: by its size plus its pack-size bonus.
export function baseMaxHearts(
  tuning: LiveTuning,
  place: PackPlace,
  dog: Pick<Dog, "size">,
): number {
  return sizeHearts(tuning, dog) + packSizeBonus(tuning, place);
}

// A max of base hearts after the maxHearts modifiers, held to hearts.maxOwnerHearts.
function cappedMax(tuning: LiveTuning, modifiers: readonly Modifier[], base: number): number {
  return Math.min(
    read(tuning, "hearts", "maxOwnerHearts"),
    modifiedStat(tuning, modifiers, "maxHearts", base),
  );
}

// The cap on this dog's owner's meter at its place in the pack the walk set out with: by its
// size plus its pack-size bonus, then maxHearts modifiers, then held to hearts.maxOwnerHearts.
export function maxHearts(
  tuning: LiveTuning,
  modifiers: readonly Modifier[],
  place: PackPlace,
  dog: Pick<Dog, "size">,
): number {
  return cappedMax(tuning, modifiers, baseMaxHearts(tuning, place, dog));
}

// The cap on this dog's owner's meter on the walk: its maxHearts at its place in the pack the
// walk set out with, fired dogs included.
export function ownerMaxHearts(
  data: Pick<GameData, "dogs" | "tuning">,
  run: Pick<RunState, "modifiers" | "pack">,
  dog: DogId,
): number {
  return maxHearts(data.tuning, run.modifiers, placeInPack(run, dog), data.dogs[dog]);
}

// How many hearts the pack-size bonus raises this dog's owner's max by, once capped.
export function packSizeRaise(
  tuning: LiveTuning,
  modifiers: readonly Modifier[],
  place: PackPlace,
  dog: Pick<Dog, "size">,
): number {
  return (
    maxHearts(tuning, modifiers, place, dog) - cappedMax(tuning, modifiers, sizeHearts(tuning, dog))
  );
}

// Every owner starts full.
export function startHearts(
  tuning: LiveTuning,
  modifiers: readonly Modifier[],
  place: PackPlace,
  dog: Pick<Dog, "size">,
): Hearts {
  const max = maxHearts(tuning, modifiers, place, dog);
  return clampHearts(max, max);
}

// A large dog slows the pack's lane changes by largeDogAgility.
export function isLarge(dog: Pick<Dog, "size">): boolean {
  return dog.size === "large";
}
