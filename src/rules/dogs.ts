import type { Dog, LiveTuning, Modifier } from "../data/types";
import { modifiedStat } from "./modifiers";
import { clampHearts, type Hearts, readTable } from "./units";

// The cap on this dog's owner's meter: by its size, then maxHearts modifiers.
export function maxHearts(
  tuning: LiveTuning,
  modifiers: readonly Modifier[],
  dog: Pick<Dog, "size">,
): number {
  return modifiedStat(
    tuning,
    modifiers,
    "maxHearts",
    readTable(tuning, "hearts", "maxBySize", dog.size),
  );
}

// Every owner starts full.
export function startHearts(
  tuning: LiveTuning,
  modifiers: readonly Modifier[],
  dog: Pick<Dog, "size">,
): Hearts {
  const max = maxHearts(tuning, modifiers, dog);
  return clampHearts(max, max);
}

// A heavy dog slows the pack's lane changes by bigDogAgility: every big dog.
export function isHeavy(dog: Pick<Dog, "size">): boolean {
  return dog.size === "big";
}
