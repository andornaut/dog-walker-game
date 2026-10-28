import type {
  DebuffId,
  DogId,
  Effect,
  GameData,
  HeartsEffect,
  MoneyEffect,
  SharedHeartsEffect,
  Target,
} from "../data/types";
import { assertNever } from "../lib/assertNever";
import { type Cents, cents, clampHearts, roundDollars } from "../lib/units";
import { heartsOf, mapPack, packDogs, packOrder, walkingAmong } from "../state/pack";
import type { ActiveModifier, EffectSource, RunState } from "../state/runState";
import {
  type Cause,
  causesTotal,
  type Change,
  dollarCauses,
  type HeartChange,
  type ModifierCause,
  type MoneyChange,
  negatedCauses,
} from "./causes";
import { ownerMaxHearts } from "./dogs";
import { debuffLasting, lastingFor, longerLasting } from "./durations";
import { changeModified, type ModifiedValue, modifiedValue, statModified } from "./modified";
import { modifiedStat } from "./modifiers";
import { read } from "./units";

type RulesData = Pick<GameData, "debuffs" | "dogs" | "encounters" | "tuning">;

export interface EffectContext {
  // The dogs the encounter affected, such as those caught by an area roll.
  readonly affected: readonly DogId[];
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
  context: Pick<EffectContext, "affected">,
  state: RunState,
  target: Target,
): DogId[] {
  const pack = packDogs(state);
  switch (target.kind) {
    case "affected":
      return walkingAmong(state, context.affected);
    case "all":
      return pack;
    case "lead":
      return packOrder(data.dogs, walkingAmong(state, context.affected)).slice(0, 1);
    default:
      return assertNever(target);
  }
}

// A money effect's amount, and how it came about: base is the amount before modifiers, and
// adjustments the cardCost modifiers that cut a cost, or the freeCards modifier that waived it.
// base and adjustments are signed as changes to the money.
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

// Each amount is rounded to the dollar, and charged once whatever the pack. Every money loss is
// a card option's cost. A cost on a free card is waived, naming the modifier that waived it;
// otherwise cardCost modifiers, such as Fanny pack's, scale it, each naming its share of the cut.
function moneyParts(data: RulesData, state: RunState, effect: MoneyEffect): MoneyParts {
  const amount = read(data.tuning, "money", effect.amount);
  if (effect.change === "gain") {
    return { adjustments: [], amount: roundDollars(amount), base: amount };
  }
  const free = freeCardModifier(data, state);
  if (free !== undefined) {
    return {
      adjustments: [{ amount, kind: "modifier", source: free.source }],
      amount: cents(0),
      base: -amount,
    };
  }
  const cost = statModified(
    data.tuning,
    state.modifiers,
    "cardCost",
    { kind: "money" },
    amount,
    roundDollars,
  );
  return {
    adjustments: negatedCauses(cost?.by ?? []),
    amount: cents(cost?.after ?? roundDollars(amount)),
    base: -amount,
  };
}

// What an option's effects would take from the player before modifiers, such as Sweet talker's
// free card or Fanny pack's cut.
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
  if (state.invincible === true && causesTotal(given) < 0) {
    return { change: null, state };
  }
  const forgiven = forgivenCause(data, given, state);
  const causes: Cause[] = forgiven === null ? [...given] : [...given, forgiven];
  const total = causesTotal(causes);
  const unclamped = before + total;
  const after = clampHearts(ownerMaxHearts(data, state, dogId), unclamped);
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
  const loss = -causesTotal(given);
  const forgiver = state.modifiers.find((modifier) => modifier.stat === "forgivenHearts");
  if (loss <= 0 || forgiver === undefined) {
    return null;
  }
  const left =
    modifiedStat(data.tuning, state.modifiers, "forgivenHearts", 0) - state.heartsForgiven;
  const amount = Math.min(loss, Math.max(0, left));
  return amount === 0
    ? null
    : { amount, forgives: true, kind: "modifier", source: forgiver.source };
}

// One owner's part of a hearts effect: the dog and the hearts its owner gets or loses.
interface HeartsShare {
  readonly dog: DogId;
  readonly hearts: number;
}

// Applies each share as a change from the effect's source, in order.
function applyShares(
  data: RulesData,
  context: EffectContext,
  shares: readonly HeartsShare[],
  state: RunState,
): Applied {
  const changes: HeartChange[] = [];
  let next = state;
  for (const { dog, hearts } of shares) {
    const cause: Cause = { amount: hearts, kind: "effect", source: context.source };
    const result = changeHearts(data, [cause], dog, next);
    next = result.state;
    if (result.change !== null) {
      changes.push(result.change);
    }
  }
  return { changes, modified: changesModified(changes), state: next };
}

// A total of hearts split among dogs in formation order: an even share each, and the hearts
// left over one each to the front dogs first. A dog whose share is nothing is left out.
export function shareHearts(
  data: Pick<GameData, "dogs">,
  dogs: readonly DogId[],
  total: number,
): HeartsShare[] {
  const ordered = packOrder(data.dogs, dogs);
  const each = Math.floor(total / ordered.length);
  const left = total - each * ordered.length;
  return ordered.flatMap((dog, place) => {
    const hearts = each + (place < left ? 1 : 0);
    return hearts === 0 ? [] : [{ dog, hearts }];
  });
}

function applyHearts(
  data: RulesData,
  context: EffectContext,
  effect: HeartsEffect,
  state: RunState,
): Applied {
  const shares = targetDogs(data, context, state, effect.target).map((dog) => ({
    dog,
    hearts: effect.amount,
  }));
  return applyShares(data, context, shares, state);
}

// The total is shared by the dogs still walking, whichever the encounter caught.
function applySharedHearts(
  data: RulesData,
  context: EffectContext,
  effect: SharedHeartsEffect,
  state: RunState,
): Applied {
  const total = read(data.tuning, "hearts", effect.amount);
  return applyShares(data, context, shareHearts(data, packDogs(state), total), state);
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
// such as Quick recovery's, change it.
function debuffSecondsModified(
  data: RulesData,
  debuff: DebuffId,
  state: RunState,
): ModifiedValue | null {
  const base = read(data.tuning, "seconds", data.debuffs[debuff].seconds);
  return statModified(
    data.tuning,
    state.modifiers,
    "debuffSeconds",
    { debuff, kind: "debuffSeconds" },
    base,
  );
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
    case "sharedHearts":
      return applySharedHearts(data, context, effect, state);
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
