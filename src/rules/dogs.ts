import type { Dog, LiveTuning, Modifier } from "../data/types";
import { modifiedStat } from "./modifiers";
import {
  type Cents,
  cents,
  clampHearts,
  type Hearts,
  type Probability,
  readTable,
  type Seconds,
  seconds,
} from "./units";

// The cap on this dog's owner's meter.
export function maxHearts(tuning: LiveTuning, modifiers: readonly Modifier[], dog: Dog): number {
  return modifiedStat(
    tuning,
    modifiers,
    "maxHearts",
    readTable(tuning, "hearts", "maxBySize", dog.size),
  );
}

export function startHearts(tuning: LiveTuning, modifiers: readonly Modifier[], dog: Dog): Hearts {
  const start = modifiedStat(
    tuning,
    modifiers,
    "startHearts",
    readTable(tuning, "hearts", "startByTemperament", dog.owner.temperament),
  );
  return clampHearts(maxHearts(tuning, modifiers, dog), start);
}

export function zoneFee(tuning: LiveTuning, modifiers: readonly Modifier[], dog: Dog): Cents {
  const fee = readTable(tuning, "money", "feeByTemperament", dog.owner.temperament);
  return cents(modifiedStat(tuning, modifiers, "fees", fee));
}

// pullFrequency modifiers scale how often a dog pulls, so they divide the interval.
export function pullIntervalSeconds(
  tuning: LiveTuning,
  modifiers: readonly Modifier[],
  dog: Dog,
): Seconds {
  const frequency = modifiedStat(tuning, modifiers, "pullFrequency", 1);
  return seconds(readTable(tuning, "seconds", "pullIntervalByEnergy", dog.energy) / frequency);
}

export function inputLockSeconds(
  tuning: LiveTuning,
  modifiers: readonly Modifier[],
  dog: Dog,
): Seconds {
  const lock = readTable(tuning, "seconds", "inputLockBySize", dog.size);
  return seconds(modifiedStat(tuning, modifiers, "inputLock", lock));
}

// The chance this dog is caught by an area effect such as a skunk or puddle.
export function catchChance(tuning: LiveTuning, dog: Dog): Probability {
  return readTable(tuning, "probability", "catchBySize", dog.size);
}
