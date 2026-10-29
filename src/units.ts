import type { Unit } from "@andornaut/game-kit/units";

// Money in integer cents.
export type Cents = Unit<"Cents">;
// An owner's happiness meter, always within 0 and its dog's max.
export type Hearts = Unit<"Hearts">;

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
