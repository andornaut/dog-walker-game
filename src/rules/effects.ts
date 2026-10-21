import type {
  DebuffId,
  DogId,
  Effect,
  GameData,
  HeartsEffect,
  MoneyEffect,
  Target,
} from "../data/types";
import { assertNever } from "../lib/assertNever";
import { heartsOf, mapPack, packDogs, placeInPack } from "../state/pack";
import type { ActiveModifier, EffectSource, RunState } from "../state/runState";
import {
  type Cause,
  type Change,
  dollarCauses,
  type HeartChange,
  type ModifierCause,
  type MoneyChange,
} from "./causes";
import { maxHearts } from "./dogs";
import { debuffLasting, lastingFor, longerLasting } from "./durations";
import { changeModified, type ModifiedValue, modifiedValue, statModified } from "./modified";
import { modifiedStat, statParts } from "./modifiers";
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

// The state after some effects, every heart and money change they made, and every value
// modifiers changed, each in order.
interface Applied {
  readonly changes: readonly Change[];
  readonly modified: readonly ModifiedValue[];
  readonly state: RunState;
}

// The modified values of changes, leaving out those no modifier changed.
function changesModified(changes: readonly Change[]): ModifiedValue[] {
  return changes.flatMap((change) => changeModified(change) ?? []);
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
  readonly adjustments: readonly ModifierCause[];
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

// Each amount is rounded to the dollar, and charged once whatever the pack. A cost on a free
// card is waived, naming the modifier that waived it.
function moneyParts(data: RulesData, state: RunState, effect: MoneyEffect): MoneyParts {
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

// A money effect's total after modifiers, unsigned, and its modified value, such as a cost a
// free card waived, or null when no modifier changed it.
export function moneyAmount(
  data: RulesData,
  state: RunState,
  effect: MoneyEffect,
): { readonly amount: Cents; readonly modified: ModifiedValue | null } {
  const { adjustments, amount, base } = moneyParts(data, state, effect);
  return { amount, modified: modifiedValue({ kind: "money" }, base, adjustments) };
}

// What an option's effects would take from the player. An option costing more than the
// player has is disabled.
export function moneyCost(data: RulesData, state: RunState, effects: readonly Effect[]): Cents {
  return cents(
    effects.reduce(
      (total, effect) =>
        effect.kind === "money" && effect.change === "lose"
          ? total + moneyParts(data, state, effect).amount
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
  return { changes, modified: changesModified(changes), state: next };
}

// A card never offers a loss the player cannot afford, so money is not held at $0 here.
function applyMoney(
  data: RulesData,
  context: EffectContext,
  effect: MoneyEffect,
  state: RunState,
): Applied {
  const parts = moneyParts(data, state, effect);
  const intended = effect.change === "gain" ? parts.amount : -parts.amount;
  const change: MoneyChange = {
    amount: cents(intended),
    causes: dollarCauses([
      { amount: parts.base, kind: "effect", source: context.source },
      ...parts.adjustments,
    ]),
    dog: null,
    kind: "money",
  };
  // A cost waived to nothing makes no change, but still names what waived it.
  const modified = changesModified([change]);
  if (intended === 0) {
    return { changes: [], modified, state };
  }
  const money = cents(state.money + intended);
  return { changes: [change], modified, state: { ...state, money } };
}

const unchanged = (state: RunState): Applied => ({ changes: [], modified: [], state });

// How long a debuff applied now lasts, as debuffLasting has it, when debuffSeconds modifiers,
// such as Calm voice's, change it.
function debuffSecondsModified(
  data: RulesData,
  debuff: DebuffId,
  state: RunState,
): ModifiedValue | null {
  const base = read(data.tuning, "seconds", data.debuffs[debuff].seconds);
  const parts = statParts(data.tuning, state.modifiers, "debuffSeconds", base);
  return statModified({ debuff, kind: "debuffSeconds" }, base, parts);
}

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
      const modified = debuffSecondsModified(data, effect.debuff, state);
      return {
        changes: [],
        modified: modified === null ? [] : [modified],
        state: { ...state, debuffs: [...others, applied], debuffsGot },
      };
    }
    case "dodge": {
      const { chance, sizes } = effect;
      return unchanged({
        ...state,
        dodges: [...state.dodges, { chance, sizes, source: context.source }],
      });
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
        immunities: [
          ...others,
          { encounter: effect.encounter, source: context.source, ...refreshed },
        ],
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
      return unchanged({ ...state, skipPass: context.source });
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
      return {
        changes: [...applied.changes, ...next.changes],
        modified: [...applied.modified, ...next.modified],
        state: next.state,
      };
    },
    { changes: [], modified: [], state },
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
