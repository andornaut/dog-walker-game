import type { Dog, LiveTuning, Modifier, PackSize } from "../data/types";
import { modifiedStat } from "./modifiers";
import { clampHearts, type Hearts, read, readTable } from "./units";

// The hearts a dog's size gives its owner's meter, before the pack's size and any modifiers.
export function sizeHearts(tuning: LiveTuning, dog: Pick<Dog, "size">): number {
  return readTable(tuning, "hearts", "maxBySize", dog.size);
}

// The hearts a walk of packSize dogs adds to every owner's max, before the cap.
export function packSizeBonus(tuning: LiveTuning, packSize: PackSize): number {
  return readTable(tuning, "hearts", "packSizeBonus", packSize);
}

// A max of base hearts after the maxHearts modifiers, held to hearts.maxOwnerHearts.
function cappedMax(tuning: LiveTuning, modifiers: readonly Modifier[], base: number): number {
  return Math.min(
    read(tuning, "hearts", "maxOwnerHearts"),
    modifiedStat(tuning, modifiers, "maxHearts", base),
  );
}

// The cap on this dog's owner's meter on a walk that set out with packSize dogs: by its size
// plus its pack-size bonus, then maxHearts modifiers, then held to hearts.maxOwnerHearts.
export function maxHearts(
  tuning: LiveTuning,
  modifiers: readonly Modifier[],
  packSize: PackSize,
  dog: Pick<Dog, "size">,
): number {
  return cappedMax(tuning, modifiers, sizeHearts(tuning, dog) + packSizeBonus(tuning, packSize));
}

// How many hearts the pack-size bonus raises this dog's owner's max by, once capped.
export function packSizeRaise(
  tuning: LiveTuning,
  modifiers: readonly Modifier[],
  packSize: PackSize,
  dog: Pick<Dog, "size">,
): number {
  return (
    maxHearts(tuning, modifiers, packSize, dog) -
    cappedMax(tuning, modifiers, sizeHearts(tuning, dog))
  );
}

// Every owner starts full.
export function startHearts(
  tuning: LiveTuning,
  modifiers: readonly Modifier[],
  packSize: PackSize,
  dog: Pick<Dog, "size">,
): Hearts {
  const max = maxHearts(tuning, modifiers, packSize, dog);
  return clampHearts(max, max);
}

// A heavy dog slows the pack's lane changes by bigDogAgility: every big dog.
export function isHeavy(dog: Pick<Dog, "size">): boolean {
  return dog.size === "big";
}
