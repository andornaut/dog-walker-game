import type { DogId, Effect, GameData, HeartsEffect, MoneyEffect, Target } from "../data/types";
import { heartsOf, mapPack, packDogs, placeInPack } from "../state/pack";
import type { ActiveModifier, EffectSource, RunState } from "../state/runState";
import { assertNever } from "./assertNever";
import {
  type Cause,
  type Change,
  dollarCauses,
  type HeartChange,
  type MoneyChange,
} from "./causes";
import { maxHearts } from "./dogs";
import { debuffLasting, lastingFor, longerLasting } from "./durations";
import { modifiedStat } from "./modifiers";
import { type Cents, cents, clampHearts, read, roundDollars } from "./units";

type RulesData = Pick<GameData, "debuffs" | "dogs" | "encounters" | "tuning">;

export interface EffectContext {
  // The dogs the encounter affected, such as those caught by an area roll.
  readonly affected: readonly DogId[];
  // Returns a number from 0 (inclusive) to 1 (exclusive), like Math.random.
  readonly random: () => number;
  // What the effects came from, named by the changes and modifiers they make.
  readonly source: EffectSource;
}

// The state after some effects, and every heart and money change they made, in order.
interface Applied {
  readonly changes: readonly Change[];
  readonly state: RunState;
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
    case "randomOne": {
      const picked = pack[Math.floor(context.random() * pack.length)];
      return picked === undefined ? [] : [picked];
    }
    default:
      return assertNever(target);
  }
}

// A money effect's amount, and how it came about: base is the amount before modifiers, and
// adjustments the freeCards modifier that waived a cost. base and adjustments are signed as
// changes to the money.
interface MoneyParts {
  readonly adjustments: readonly Cause[];
  readonly amount: Cents;
  readonly base: number;
}

// The freeCards modifier that waives this zone's next card's costs, such as Sweet talker's
// for the first card each zone, or undefined once the zone's free cards are used.
function freeCardModifier(
  data: RulesData,
  state: Pick<RunState, "cardsThisZone" | "modifiers">,
): ActiveModifier | undefined {
  const free = modifiedStat(data.tuning, state.modifiers, "freeCards", 0);
  return state.cardsThisZone < free
    ? state.modifiers.find((modifier) => modifier.stat === "freeCards")
    : undefined;
}

// Each amount is rounded to the dollar. A cost on a free card is waived, naming the modifier
// that waived it.
function moneyParts(
  data: RulesData,
  context: Pick<EffectContext, "affected">,
  state: RunState,
  effect: MoneyEffect,
): MoneyParts {
  const amount = read(data.tuning, "money", effect.amount);
  const total = roundDollars(amount);
  if (effect.change === "gain") {
    return { adjustments: [], amount: total, base: amount };
  }
  const free = freeCardModifier(data, state);
  return free === undefined
    ? { adjustments: [], amount: total, base: -amount }
    : {
        adjustments: [{ amount, kind: "modifier", source: free.source }],
        amount: cents(0),
        base: -amount,
      };
}

// What an option's effects would take from the player before a free card waives it, such as
// Sweet talker's.
export function baseMoneyCost(data: Pick<GameData, "tuning">, effects: readonly Effect[]): Cents {
  return cents(
    effects.reduce(
      (total, effect) =>
        effect.kind === "money" && effect.change === "lose"
          ? total + roundDollars(read(data.tuning, "money", effect.amount))
          : total,
      0,
    ),
  );
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

// Changes one owner's meter by the sum of causes, held within 0 and the dog's max. A loss is
// cut by the hearts forgivenHearts modifiers, such as Second chance's, still forgive this zone, and
// a forgiven loss is reported even when the meter does not move, so its forgiving shows. No
// other change is reported when the meter does not move, nor a loss in an invincible run.
export function changeHearts(
  data: Pick<GameData, "dogs" | "tuning">,
  given: readonly [Cause, ...Cause[]],
  dogId: DogId,
  state: RunState,
): { readonly change: HeartChange | null; readonly state: RunState } {
  const before = heartsOf(state, dogId);
  if (before === undefined) {
    return { change: null, state };
  }
  if (state.invincible === true && given.reduce((sum, cause) => sum + cause.amount, 0) < 0) {
    return { change: null, state };
  }
  const forgiven = forgivenCause(data, given, state);
  const causes: Cause[] = forgiven === null ? [...given] : [...given, forgiven];
  const total = causes.reduce((sum, cause) => sum + cause.amount, 0);
  const unclamped = before + total;
  const after = clampHearts(
    maxHearts(data.tuning, state.modifiers, placeInPack(state, dogId), data.dogs[dogId]),
    unclamped,
  );
  if (after === before && forgiven === null) {
    return { change: null, state };
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
  const heartsForgiven = state.heartsForgiven + (forgiven?.amount ?? 0);
  return {
    change: { after, before, causes, dog: dogId, kind: "hearts" },
    state: { ...state, heartsForgiven, pack },
  };
}

// The part of a loss forgiven, as a cause naming the forgiving modifier's source, or null for a
// gain or once this zone's forgiving is used up.
function forgivenCause(
  data: Pick<GameData, "tuning">,
  given: readonly Cause[],
  state: Pick<RunState, "heartsForgiven" | "modifiers">,
): Cause | null {
  const loss = -given.reduce((sum, cause) => sum + cause.amount, 0);
  const forgiver = state.modifiers.find((modifier) => modifier.stat === "forgivenHearts");
  if (loss <= 0 || forgiver === undefined) {
    return null;
  }
  const left =
    modifiedStat(data.tuning, state.modifiers, "forgivenHearts", 0) - state.heartsForgiven;
  const amount = Math.min(loss, Math.max(0, left));
  return amount === 0 ? null : { amount, kind: "modifier", source: forgiver.source };
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
    const cause: Cause = { amount: effect.amount, kind: "effect", source: context.source };
    const result = changeHearts(data, [cause], dogId, next);
    next = result.state;
    if (result.change !== null) {
      changes.push(result.change);
    }
  }
  return { changes, state: next };
}

// A card never offers a loss the player cannot afford, so money is not held at $0 here.
function applyMoney(
  data: RulesData,
  context: EffectContext,
  effect: MoneyEffect,
  state: RunState,
): Applied {
  const parts = moneyParts(data, context, state, effect);
  const intended = effect.change === "gain" ? parts.amount : -parts.amount;
  if (intended === 0) {
    return { changes: [], state };
  }
  const money = cents(state.money + intended);
  const change: MoneyChange = {
    amount: cents(intended),
    causes: dollarCauses([
      { amount: parts.base, kind: "effect", source: context.source },
      ...parts.adjustments,
    ]),
    dog: null,
    kind: "money",
  };
  return { changes: [change], state: { ...state, money } };
}

const unchanged = (state: RunState): Applied => ({ changes: [], state });

function applyEffect(
  data: RulesData,
  context: EffectContext,
  effect: Effect,
  state: RunState,
): Applied {
  switch (effect.kind) {
    case "debuff": {
      // Applying a debuff the pack has restarts its time: debuffs never stack. Each one
      // applied counts toward the debuff badges.
      const { seconds } = data.debuffs[effect.debuff];
      const applied = { debuff: effect.debuff, ...debuffLasting(data.tuning, seconds, state) };

      const others = state.debuffs.filter(({ debuff }) => debuff !== effect.debuff);
      const debuffsGot = {
        ...state.debuffsGot,
        [effect.debuff]: (state.debuffsGot[effect.debuff] ?? 0) + 1,
      };
      return unchanged({ ...state, debuffs: [...others, applied], debuffsGot });
    }
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
      return unchanged({ ...state, skipPass: true });
    default:
      return assertNever(effect);
  }
}

// Applies effects in order and reports each heart and money change. Hearts stay within 0
// and each dog's max, and money never goes below $0.
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
