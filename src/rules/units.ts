import {
  type Multiplier,
  multiplier,
  type Pixels,
  pixels,
  type Probability,
  probability,
  type Seconds,
  seconds,
} from "@andornaut/game-kit/units";

import type { LiveTuning, NumberKeys, UnitGroup } from "../data/types";
import { type Cents, dollarsToCents } from "../units";

// What reading a value from each tuning group gives. Hearts values in the tuning are
// amounts and caps, not meters, so they stay plain numbers until clampHearts.
interface UnitOf {
  readonly counts: number;
  readonly hearts: number;
  readonly money: Cents;
  readonly multipliers: Multiplier;
  readonly pixels: Pixels;
  readonly probability: Probability;
  readonly seconds: Seconds;
}

const TO_UNIT: { readonly [G in UnitGroup]: (value: number) => UnitOf[G] } = {
  counts: (value) => value,
  hearts: (value) => value,
  money: dollarsToCents,
  multipliers: multiplier,
  pixels,
  probability,
  seconds,
};

type TableKeys<Group> = {
  [K in keyof Group]: Group[K] extends number ? never : K;
}[keyof Group];

// Reads a tuning value in its group's unit: read(tuning, "money", "tip") is Cents.
export function read<G extends UnitGroup>(
  tuning: LiveTuning,
  group: G,
  key: NumberKeys<LiveTuning[G]>,
): UnitOf[G] {
  const values: Readonly<Record<PropertyKey, unknown>> = tuning[group];
  return TO_UNIT[group](values[key] as number);
}

// Reads one row of a table in a tuning group: readTable(tuning, "seconds",
// "pullIntervalByEnergy", "calm") is Seconds.
export function readTable<G extends UnitGroup, T extends TableKeys<LiveTuning[G]>>(
  tuning: LiveTuning,
  group: G,
  table: T,
  row: keyof LiveTuning[G][T],
): UnitOf[G] {
  const groupValues: Readonly<Record<PropertyKey, unknown>> = tuning[group];
  const rows = groupValues[table] as Readonly<Record<PropertyKey, unknown>> | undefined;
  const value = rows?.[row];
  if (typeof value !== "number") {
    throw new RangeError(`No ${group}.${String(table)}.${String(row)} in the tuning`);
  }
  return TO_UNIT[group](value);
}
