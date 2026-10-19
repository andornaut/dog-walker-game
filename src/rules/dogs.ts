import type { Dog, LiveTuning, Modifier } from "../data/types";
import { type Contribution, modifiedStat, statParts } from "./modifiers";
import {
  type Cents,
  cents,
  clampHearts,
  type Hearts,
  type Probability,
  read,
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

export interface FeeParts<M extends Modifier> {
  // The owner's fee before any modifier.
  readonly base: Cents;
  readonly contributions: readonly Contribution<M>[];
  // What the dog's quirk adds before the modifiers: a show dog's showDogFee, else 0.
  readonly quirk: Cents;
  readonly value: Cents;
}

// The fee a dog pays per zone: its owner's fee and a show dog's extra, changed by fees
// modifiers.
export function zoneFeeParts<M extends Modifier>(
  tuning: LiveTuning,
  modifiers: readonly M[],
  dog: Dog,
): FeeParts<M> {
  const base = readTable(tuning, "money", "feeByTemperament", dog.owner.temperament);
  const quirk = dog.quirk === "showDog" ? read(tuning, "money", "showDogFee") : cents(0);
  const parts = statParts(tuning, modifiers, "fees", base + quirk);
  return { base, contributions: parts.contributions, quirk, value: cents(parts.value) };
}

export function zoneFee(tuning: LiveTuning, modifiers: readonly Modifier[], dog: Dog): Cents {
  return zoneFeeParts(tuning, modifiers, dog).value;
}

// How long the dog walks before its need turns urgent.
export function needUrgentSeconds(tuning: LiveTuning, dog: Pick<Dog, "energy">): Seconds {
  return readTable(tuning, "seconds", "needUrgentByEnergy", dog.energy);
}

// How long lane input locks after the dog pulls: by its size, and never for an acrobatic dog.
export function inputLockSeconds(
  tuning: LiveTuning,
  modifiers: readonly Modifier[],
  dog: Dog,
): Seconds {
  if (dog.quirk === "acrobatic") {
    return seconds(0);
  }
  const lock = readTable(tuning, "seconds", "inputLockBySize", dog.size);
  return seconds(modifiedStat(tuning, modifiers, "inputLock", lock));
}

// The chance this dog is caught by an area effect such as a skunk or puddle.
export function catchChance(tuning: LiveTuning, dog: Dog): Probability {
  return readTable(tuning, "probability", "catchBySize", dog.size);
}
