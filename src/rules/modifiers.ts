import type { Effect, LiveTuning, Modifier, ModifierEffect, Stat } from "../data/types";
import { assertNever } from "./assertNever";
import { read } from "./units";

// An "add" value is in its stat's unit (cents for money stats); a "multiply" value is a factor.
export function modifierValue(tuning: LiveTuning, modifier: Modifier): number {
  if (modifier.operation === "multiply") {
    return read(tuning, "multipliers", modifier.by);
  }
  switch (modifier.stat) {
    case "costPerDog":
    case "startMoney":
      return read(tuning, "money", modifier.by);
    case "maxHearts":
    case "startHearts":
      return read(tuning, "hearts", modifier.by);
    case "treatReach":
      return read(tuning, "counts", modifier.by);
    default:
      return assertNever(modifier);
  }
}

// A stat after its modifiers: the "add" values are summed onto base, then the "multiply"
// values scale the result.
export function modifiedStat(
  tuning: LiveTuning,
  modifiers: readonly Modifier[],
  stat: Stat,
  base: number,
): number {
  const matching = modifiers.filter((modifier) => modifier.stat === stat);
  const added = matching
    .filter((modifier) => modifier.operation === "add")
    .reduce((sum, modifier) => sum + modifierValue(tuning, modifier), base);
  return matching
    .filter((modifier) => modifier.operation === "multiply")
    .reduce((product, modifier) => product * modifierValue(tuning, modifier), added);
}

// The modifiers among a card's or a gear item's effects.
export function modifiersOf(effects: readonly Effect[]): ModifierEffect[] {
  return effects.filter((effect): effect is ModifierEffect => effect.kind === "modifier");
}
