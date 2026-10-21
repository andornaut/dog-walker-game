import type { LiveTuning, NumberKeys, UnitGroup } from "../data/types";

declare const unit: unique symbol;
type Unit<Name extends string> = number & { readonly [unit]: Name };

// Money in integer cents.
export type Cents = Unit<"Cents">;
// An owner's happiness meter, always within 0 and its dog's max.
export type Hearts = Unit<"Hearts">;
export type Multiplier = Unit<"Multiplier">;
// Pixels, or pixels per second for a speed.
export type Pixels = Unit<"Pixels">;
// A chance from 0 to 1.
export type Probability = Unit<"Probability">;
export type Seconds = Unit<"Seconds">;

export function cents(value: number): Cents {
  return Math.round(value) as Cents;
}

// Money charged or paid is whole dollars: an amount a multiplier changed, such as a fee in a
// zone that pays x1.25, is rounded to the nearest dollar, a half dollar away from $0 so a gain
// and a loss of the same amount round alike.
export function roundDollars(value: number): Cents {
  return cents(Math.sign(value) * Math.round(Math.abs(value) / 100) * 100);
}

// Value files write money in dollars.
export function dollarsToCents(dollars: number): Cents {
  return cents(dollars * 100);
}

export function addCents(a: Cents, b: Cents): Cents {
  return (a + b) as Cents;
}

// The only way to make Hearts.
export function clampHearts(max: number, value: number): Hearts {
  return Math.min(max, Math.max(0, value)) as Hearts;
}

export function multiplier(value: number): Multiplier {
  return value as Multiplier;
}

export function pixels(value: number): Pixels {
  return value as Pixels;
}

export function probability(value: number): Probability {
  if (!(value >= 0 && value <= 1)) {
    throw new RangeError(`A probability must be from 0 to 1, not ${value}`);
  }
  return value as Probability;
}

export function seconds(value: number): Seconds {
  return value as Seconds;
}

// What reading a value from each tuning group gives. Hearts values in the tuning are
// amounts and caps, not meters, so they stay plain numbers until clampHearts.
export interface UnitOf {
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
