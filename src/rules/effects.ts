import type {
  DogId,
  Effect,
  GameData,
  HeartsEffect,
  MoneyEffect,
  Target,
  TreatsEffect,
} from "../data/types";
import { heartsOf, mapPack, packDogs } from "../state/pack";
import type { RunState } from "../state/runState";
import { assertNever } from "./assertNever";
import { maxHearts } from "./dogs";
import { modifiedStat } from "./modifiers";
import {
  addCents,
  type Cents,
  cents,
  clampHearts,
  nonNegativeCents,
  read,
  readTable,
} from "./units";

export type RulesData = Pick<GameData, "dogs" | "tuning">;

export interface EffectContext {
  // The dogs the encounter affected, such as those caught by an area roll.
  readonly affected: readonly DogId[];
  // Returns a number from 0 (inclusive) to 1 (exclusive), like Math.random.
  readonly random: () => number;
}

export function targetDogs(
  data: RulesData,
  context: EffectContext,
  state: RunState,
  target: Target,
): DogId[] {
  const pack = packDogs(state);
  switch (target.kind) {
    case "affected":
      return pack.filter((id) => context.affected.includes(id));
    case "all":
      return pack;
    case "randomOne": {
      const picked = pack[Math.floor(context.random() * pack.length)];
      return picked === undefined ? [] : [picked];
    }
    case "temperament":
      return pack.filter((id) => data.dogs[id].owner.temperament === target.temperament);
    case "trait":
      return pack.filter((id) => data.dogs[id].trait === target.trait);
    default:
      return assertNever(target);
  }
}

// How many dogs a per-dog amount is counted for. Never draws: one random dog is one dog.
function perDogCount(
  data: RulesData,
  context: Pick<EffectContext, "affected">,
  state: RunState,
  target: Target | undefined,
): number {
  if (target === undefined) {
    return 1;
  }
  if (target.kind === "randomOne") {
    return Math.min(1, packDogs(state).length);
  }
  return targetDogs(data, { ...context, random: () => 0 }, state, target).length;
}

// Per-dog costs include costPerDog modifiers, never below $0 per dog.
function moneyEffectAmount(
  data: RulesData,
  context: Pick<EffectContext, "affected">,
  state: RunState,
  effect: MoneyEffect,
): Cents {
  const amount = read(data.tuning, "money", effect.amount);
  if (effect.perDog === undefined) {
    return amount;
  }
  const count = perDogCount(data, context, state, effect.perDog);
  const perDog =
    effect.change === "lose"
      ? Math.max(0, modifiedStat(data.tuning, state.modifiers, "costPerDog", amount))
      : amount;
  return cents(perDog * count);
}

// What an option's effects would take from the player. An option costing more than the
// player has is disabled.
export function moneyCost(
  data: RulesData,
  context: Pick<EffectContext, "affected">,
  state: RunState,
  effects: readonly Effect[],
): Cents {
  return effects.reduce(
    (total, effect) =>
      effect.kind === "money" && effect.change === "lose"
        ? addCents(total, moneyEffectAmount(data, context, state, effect))
        : total,
    cents(0),
  );
}

export function canAfford(
  data: RulesData,
  context: Pick<EffectContext, "affected">,
  state: RunState,
  effects: readonly Effect[],
): boolean {
  return moneyCost(data, context, state, effects) <= state.money;
}

function applyHearts(
  data: RulesData,
  context: EffectContext,
  effect: HeartsEffect,
  state: RunState,
): RunState {
  const targets = targetDogs(data, context, state, effect.target);
  const pack = mapPack((slot) => {
    if (slot.status !== "walking" || !targets.includes(slot.dog)) {
      return slot;
    }
    const dog = data.dogs[slot.dog];
    const multiplier = readTable(
      data.tuning,
      "multipliers",
      "heartsByTemperament",
      dog.owner.temperament,
    );
    const delta = (effect.traitAmounts?.[dog.trait] ?? effect.amount) * multiplier;
    const max = maxHearts(data.tuning, state.modifiers, dog);
    return { ...slot, hearts: clampHearts(max, (heartsOf(state, slot.dog) ?? 0) + delta) };
  }, state.pack);
  return { ...state, pack };
}

function applyTreats(
  data: RulesData,
  context: EffectContext,
  effect: TreatsEffect,
  state: RunState,
): RunState {
  const gained =
    read(data.tuning, "counts", effect.amount) * perDogCount(data, context, state, effect.perDog);
  const carryMax = read(data.tuning, "counts", "treatCarryMax");
  return { ...state, treats: Math.min(carryMax, state.treats + gained) };
}

function applyEffect(
  data: RulesData,
  context: EffectContext,
  effect: Effect,
  state: RunState,
): RunState {
  switch (effect.kind) {
    case "debuff":
      // Refreshing a debuff the pack has leaves one copy: debuffs never stack.
      return state.debuffs.includes(effect.debuff)
        ? state
        : { ...state, debuffs: [...state.debuffs, effect.debuff] };
    case "hearts":
      return applyHearts(data, context, effect, state);
    case "immune":
      return state.immunities.includes(effect.encounter)
        ? state
        : { ...state, immunities: [...state.immunities, effect.encounter] };
    case "modifier":
      return { ...state, modifiers: [...state.modifiers, effect] };
    case "money": {
      const amount = moneyEffectAmount(data, context, state, effect);
      const money =
        effect.change === "gain"
          ? addCents(state.money, amount)
          : nonNegativeCents(cents(state.money - amount));
      return { ...state, money };
    }
    case "skipOption":
      return {
        ...state,
        skipsLeft: state.skipsLeft + read(data.tuning, "counts", effect.usesPerRun),
      };
    case "treats":
      return applyTreats(data, context, effect, state);
    default:
      return assertNever(effect);
  }
}

// Applies an option's effects in order. Hearts stay within 0 and each dog's max, dramatic
// owners' changes are multiplied, and money never goes below $0.
export function applyEffects(
  data: RulesData,
  context: EffectContext,
  effects: readonly Effect[],
  state: RunState,
): RunState {
  return effects.reduce((next, effect) => applyEffect(data, context, effect, next), state);
}
