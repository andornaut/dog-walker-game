import type {
  DogId,
  Effect,
  GameData,
  HeartsEffect,
  MoneyEffect,
  NeedId,
  Target,
  TreatsEffect,
} from "../data/types";
import { heartsOf, mapPack, packDogs } from "../state/pack";
import type { EffectSource, RunState } from "../state/runState";
import { assertNever } from "./assertNever";
import {
  type Cause,
  centsCauses,
  type Change,
  type HeartChange,
  modifierCauses,
  type MoneyChange,
} from "./causes";
import { maxHearts } from "./dogs";
import { lastingFor, longerLasting } from "./durations";
import { statParts } from "./modifiers";
import { type Cents, cents, clampHearts, nonNegativeCents, read, readTable } from "./units";

export type RulesData = Pick<GameData, "debuffs" | "dogs" | "tuning">;

export interface EffectContext {
  // The dogs the encounter affected, such as those caught by an area roll.
  readonly affected: readonly DogId[];
  // Returns a number from 0 (inclusive) to 1 (exclusive), like Math.random.
  readonly random: () => number;
  // What the effects came from, named by the changes and modifiers they make.
  readonly source: EffectSource;
}

// The state after some effects, and every heart and money change they made, in order.
export interface Applied {
  readonly changes: readonly Change[];
  readonly state: RunState;
}

// The walking dog whose owner has the fewest hearts, the first in pack order on a tie.
function unhappiest(state: RunState): DogId[] {
  let lowest: { readonly dog: DogId; readonly hearts: number } | undefined;
  for (const dog of packDogs(state)) {
    const hearts = heartsOf(state, dog) ?? 0;
    if (lowest === undefined || hearts < lowest.hearts) {
      lowest = { dog, hearts };
    }
  }
  return lowest === undefined ? [] : [lowest.dog];
}

export function targetDogs(
  data: RulesData,
  context: Pick<EffectContext, "affected" | "random">,
  state: RunState,
  target: Target,
): DogId[] {
  const pack = packDogs(state);
  switch (target.kind) {
    case "affected":
      return pack.filter((id) => context.affected.includes(id));
    case "all":
      return pack;
    case "need":
      return pack.filter((id) => data.dogs[id].need === target.need);
    case "randomOne": {
      const picked = pack[Math.floor(context.random() * pack.length)];
      return picked === undefined ? [] : [picked];
    }
    case "temperament":
      return pack.filter((id) => data.dogs[id].owner.temperament === target.temperament);
    case "trait":
      return pack.filter((id) => data.dogs[id].trait === target.trait);
    case "unhappiest":
      return unhappiest(state);
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

// A money effect's amount, and how it came about: base is the amount before modifiers, and
// adjustments are the costPerDog modifiers and the $0 floor on a per-dog cost. base and
// adjustments are signed as changes to the money.
interface MoneyParts {
  readonly adjustments: readonly Cause[];
  readonly amount: Cents;
  readonly base: number;
}

// Per-dog costs include costPerDog modifiers, never below $0 per dog.
function moneyParts(
  data: RulesData,
  context: Pick<EffectContext, "affected">,
  state: RunState,
  effect: MoneyEffect,
): MoneyParts {
  const amount = read(data.tuning, "money", effect.amount);
  const sign = effect.change === "gain" ? 1 : -1;
  const count = perDogCount(data, context, state, effect.perDog);
  if (effect.perDog === undefined || effect.change === "gain") {
    return { adjustments: [], amount: cents(amount * count), base: sign * amount * count };
  }
  const parts = statParts(data.tuning, state.modifiers, "costPerDog", amount);
  const perDog = Math.max(0, parts.value);
  const floor: Cause[] =
    perDog === parts.value
      ? []
      : [{ amount: (parts.value - perDog) * count, bound: "min", kind: "limit" }];
  return {
    adjustments: [...modifierCauses(parts.contributions, -count), ...floor],
    amount: cents(perDog * count),
    base: -amount * count,
  };
}

// A money effect's total for the dogs it counts, after modifiers, unsigned.
export function moneyAmount(
  data: RulesData,
  context: Pick<EffectContext, "affected">,
  state: RunState,
  effect: MoneyEffect,
): Cents {
  return moneyParts(data, context, state, effect).amount;
}

// What an option's effects would take from the player. An option costing more than the
// player has is disabled.
export function moneyCost(
  data: RulesData,
  context: Pick<EffectContext, "affected">,
  state: RunState,
  effects: readonly Effect[],
): Cents {
  return cents(
    effects.reduce(
      (total, effect) =>
        effect.kind === "money" && effect.change === "lose"
          ? total + moneyParts(data, context, state, effect).amount
          : total,
      0,
    ),
  );
}

// Changes one owner's meter by base, the base cause's amount: the owner's temperament
// multiplies it, then the meter is held within 0 and the dog's max. No change is reported
// when the meter does not move.
export function changeHearts(
  data: Pick<GameData, "dogs" | "tuning">,
  base: Cause,
  dogId: DogId,
  state: RunState,
): { readonly change: HeartChange | null; readonly state: RunState } {
  const before = heartsOf(state, dogId);
  if (before === undefined) {
    return { change: null, state };
  }
  const dog = data.dogs[dogId];
  const { temperament } = dog.owner;
  const multiplied =
    base.amount * readTable(data.tuning, "multipliers", "heartsByTemperament", temperament);
  const unclamped = before + multiplied;
  const after = clampHearts(maxHearts(data.tuning, state.modifiers, dog), unclamped);
  if (after === before) {
    return { change: null, state };
  }
  const causes: Cause[] = [base];
  if (multiplied !== base.amount) {
    causes.push({ amount: multiplied - base.amount, kind: "temperament", temperament });
  }
  if (after !== unclamped) {
    causes.push({
      amount: after - unclamped,
      bound: unclamped > after ? "max" : "min",
      kind: "limit",
    });
  }
  const pack = mapPack(
    (slot) => (slot.status === "walking" && slot.dog === dogId ? { ...slot, hearts: after } : slot),
    state.pack,
  );
  return {
    change: { after, before, causes, dog: dogId, kind: "hearts" },
    state: { ...state, pack },
  };
}

function applyHearts(
  data: RulesData,
  context: EffectContext,
  effect: HeartsEffect,
  state: RunState,
): Applied {
  const changes: HeartChange[] = [];
  let next = state;
  for (const dogId of targetDogs(data, context, state, effect.target)) {
    const amount = effect.traitAmounts?.[data.dogs[dogId].trait] ?? effect.amount;
    const base: Cause = { amount, kind: "effect", source: context.source };
    const result = changeHearts(data, base, dogId, next);
    next = result.state;
    if (result.change !== null) {
      changes.push(result.change);
    }
  }
  return { changes, state: next };
}

// Money never goes below $0; a loss cut short there is reported as a limit.
function applyMoney(
  data: RulesData,
  context: EffectContext,
  effect: MoneyEffect,
  state: RunState,
): Applied {
  const parts = moneyParts(data, context, state, effect);
  const intended = effect.change === "gain" ? parts.amount : -parts.amount;
  const money = nonNegativeCents(cents(state.money + intended));
  const delta = money - state.money;
  if (delta === 0) {
    return { changes: [], state };
  }
  const floor: Cause[] =
    delta === intended ? [] : [{ amount: delta - intended, bound: "min", kind: "limit" }];
  const change: MoneyChange = {
    amount: cents(delta),
    causes: centsCauses([
      { amount: parts.base, kind: "effect", source: context.source },
      ...parts.adjustments,
      ...floor,
    ]),
    dog: null,
    kind: "money",
  };
  return { changes: [change], state: { ...state, money } };
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

const unchanged = (state: RunState): Applied => ({ changes: [], state });

// Every walking dog with the need starts it again from 0.
export function fulfilNeed(data: Pick<GameData, "dogs">, need: NeedId, state: RunState): RunState {
  const met = packDogs(state).filter((dog) => data.dogs[dog].need === need);
  if (met.length === 0) {
    return state;
  }
  return {
    ...state,
    needSeconds: { ...state.needSeconds, ...Object.fromEntries(met.map((dog) => [dog, 0])) },
  };
}

function applyEffect(
  data: RulesData,
  context: EffectContext,
  effect: Effect,
  state: RunState,
): Applied {
  switch (effect.kind) {
    case "debuff": {
      // Refreshing a debuff the pack has leaves one copy: debuffs never stack.
      const lasting = lastingFor(data.debuffs[effect.debuff].duration, state);
      const held = state.debuffs.find(({ debuff }) => debuff === effect.debuff);
      const others = state.debuffs.filter(({ debuff }) => debuff !== effect.debuff);
      const refreshed = held === undefined ? lasting : longerLasting(held, lasting);
      return unchanged({ ...state, debuffs: [...others, { debuff: effect.debuff, ...refreshed }] });
    }
    case "fulfilNeed":
      return unchanged(fulfilNeed(data, effect.need, state));
    case "hearts":
      return applyHearts(data, context, effect, state);
    case "immune": {
      const lasting = lastingFor(effect.duration, state);
      const held = state.immunities.find(({ encounter }) => encounter === effect.encounter);
      const others = state.immunities.filter(({ encounter }) => encounter !== effect.encounter);
      const refreshed = held === undefined ? lasting : longerLasting(held, lasting);
      return unchanged({
        ...state,
        immunities: [...others, { encounter: effect.encounter, ...refreshed }],
      });
    }
    case "modifier":
      return unchanged({
        ...state,
        modifiers: [
          ...state.modifiers,
          { ...effect, source: context.source, ...lastingFor(effect.duration, state) },
        ],
      });
    case "money":
      return applyMoney(data, context, effect, state);
    case "skipOption":
      return unchanged({
        ...state,
        skipsLeft: state.skipsLeft + read(data.tuning, "counts", effect.usesPerRun),
      });
    case "treats":
      return unchanged(applyTreats(data, context, effect, state));
    default:
      return assertNever(effect);
  }
}

// Applies effects in order and reports each heart and money change. Hearts stay within 0
// and each dog's max, dramatic owners' changes are multiplied, and money never goes below $0.
export function resolveEffects(
  data: RulesData,
  context: EffectContext,
  effects: readonly Effect[],
  state: RunState,
): Applied {
  return effects.reduce<Applied>(
    (applied, effect) => {
      const next = applyEffect(data, context, effect, applied.state);
      return { changes: [...applied.changes, ...next.changes], state: next.state };
    },
    { changes: [], state },
  );
}

export function applyEffects(
  data: RulesData,
  context: EffectContext,
  effects: readonly Effect[],
  state: RunState,
): RunState {
  return resolveEffects(data, context, effects, state).state;
}
