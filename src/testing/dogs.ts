import type { Dog, DogId, LiveTuning } from "../data/types";
import { readTable } from "../rules/units";

interface DogData {
  readonly dogs: Readonly<Record<DogId, Dog>>;
  readonly tuning: LiveTuning;
}

// How many hearts one heart gained or lost during a run moves this dog's owner, by their
// temperament, so a test reads the owner's temperament from the data instead of pinning it.
export function heartsFactor(data: DogData, dog: DogId): number {
  const { temperament } = data.dogs[dog].owner;
  return readTable(data.tuning, "multipliers", "heartsByTemperament", temperament);
}

// The hearts this dog's owner starts a run with, by their temperament, before any modifier.
export function temperamentStart(data: DogData, dog: DogId): number {
  const { temperament } = data.dogs[dog].owner;
  return readTable(data.tuning, "hearts", "startByTemperament", temperament);
}

// A dog's hearts after a change of `amount` hearts during a run, scaled by its owner's
// temperament; a test picks hearts that keep the result within 0 and the dog's max.
export function heartsAfter(data: DogData, dog: DogId, before: number, amount: number): number {
  return before + amount * heartsFactor(data, dog);
}
