import type { Effect, LiveTuning, Modifier, ModifierEffect, Stat } from "../data/types";
import { assertNever } from "../lib/assertNever";
import { read } from "./units";

// An "add" value is in its stat's unit (cents for money stats); a "multiply" value is a factor.
export function modifierValue(tuning: LiveTuning, modifier: Modifier): number {
  if (modifier.operation === "multiply" || modifier.stat === "agility") {
    return read(tuning, "multipliers", modifier.by);
  }
  switch (modifier.stat) {
    case "tipValue":
      return read(tuning, "money", modifier.by);
    case "forgivenHearts":
    case "maxHearts":
      return read(tuning, "hearts", modifier.by);
    case "freeCards":
    case "tipReach":
    case "treatReach":
      return read(tuning, "counts", modifier.by);
    default:
      return assertNever(modifier);
  }
}

// How much one modifier changed a stat.
export interface Contribution<M extends Modifier> {
  readonly amount: number;
  readonly modifier: M;
}

export interface StatParts<M extends Modifier> {
  // In the order applied; a modifier that changed nothing is left out.
  readonly contributions: readonly Contribution<M>[];
  readonly value: number;
}

// A stat after its modifiers, with what each one contributed: the "add" values are summed
// onto base, then the "multiply" values scale the result in turn.
export function statParts<M extends Modifier>(
  tuning: LiveTuning,
  modifiers: readonly M[],
  stat: Stat,
  base: number,
): StatParts<M> {
  const matching = modifiers.filter((modifier) => modifier.stat === stat);
  const ordered = [
    ...matching.filter((modifier) => modifier.operation === "add"),
    ...matching.filter((modifier) => modifier.operation === "multiply"),
  ];
  const contributions: Contribution<M>[] = [];
  let value = base;
  for (const modifier of ordered) {
    const next =
      modifier.operation === "add"
        ? value + modifierValue(tuning, modifier)
        : value * modifierValue(tuning, modifier);
    if (next !== value) {
      contributions.push({ amount: next - value, modifier });
    }
    value = next;
  }
  return { contributions, value };
}

export function modifiedStat(
  tuning: LiveTuning,
  modifiers: readonly Modifier[],
  stat: Stat,
  base: number,
): number {
  // statParts' value, in the same order of operations, without building its parts.
  let value = base;
  for (const modifier of modifiers) {
    if (modifier.stat === stat && modifier.operation === "add") {
      value = value + modifierValue(tuning, modifier);
    }
  }
  for (const modifier of modifiers) {
    if (modifier.stat === stat && modifier.operation === "multiply") {
      value = value * modifierValue(tuning, modifier);
    }
  }
  return value;
}

// The modifiers among a card's or a gear item's effects.
export function modifiersOf(effects: readonly Effect[]): ModifierEffect[] {
  return effects.filter((effect): effect is ModifierEffect => effect.kind === "modifier");
}
