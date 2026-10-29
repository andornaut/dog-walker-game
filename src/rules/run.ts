import type { DogId, GameData, LiveTuning } from "../data/types";
import { mapPack, packDogs } from "../state/pack";
import type { ActiveModifier, EndReason, RunState } from "../state/runState";
import { addCents, type Cents, cents, roundDollars } from "../units";
import {
  type Cause,
  causesTotal,
  dollarCauses,
  modifierCauses,
  type MoneyChange,
  negatedCauses,
} from "./causes";
import { type StatParts, statParts } from "./modifiers";
import { read } from "./units";

// The modifiers the pack's debuffs apply, such as Stinky's on tipValue.
function debuffModifiers(
  data: Pick<GameData, "debuffs">,
  state: Pick<RunState, "debuffs">,
): ActiveModifier[] {
  return state.debuffs.flatMap(({ debuff }) =>
    data.debuffs[debuff].modifiers.map((modifier) => ({
      ...modifier,
      source: { debuff, kind: "debuff" } as const,
    })),
  );
}

// The run's modifiers and its debuffs' modifiers together.
export function packModifiers(
  data: Pick<GameData, "debuffs">,
  state: Pick<RunState, "debuffs" | "modifiers">,
): readonly ActiveModifier[] {
  return state.debuffs.length === 0
    ? state.modifiers
    : [...state.modifiers, ...debuffModifiers(data, state)];
}

// The hearts a minor bump costs its dog's owner now, with what each modifier added: hearts.bump,
// changed by bumpHearts modifiers.
export function bumpParts(
  data: Pick<GameData, "debuffs" | "tuning">,
  state: Pick<RunState, "debuffs" | "modifiers">,
): StatParts<ActiveModifier> {
  return statParts(
    data.tuning,
    packModifiers(data, state),
    "bumpHearts",
    read(data.tuning, "hearts", "bump"),
  );
}

// What a minor bump also takes from the cash now, on top of its hearts, as a change with its
// causes, while a debuff makes bumps cost cash: the debuff's bumpMoney, such as Spotlight's,
// changed by bumpMoney modifiers, in whole dollars, or all the cash there is when that is less.
// Null while no debuff makes bumps cost cash, or with no cash.
export function bumpCash(
  data: Pick<GameData, "debuffs" | "tuning">,
  state: Pick<RunState, "debuffs" | "modifiers" | "money">,
): MoneyChange | null {
  const key = state.debuffs
    .map(({ debuff }) => data.debuffs[debuff].bumpMoney)
    .find((bumpMoney) => bumpMoney !== undefined);
  if (key === undefined || state.money <= 0) {
    return null;
  }
  const base = read(data.tuning, "money", key);
  const parts = statParts(data.tuning, packModifiers(data, state), "bumpMoney", base);
  const causes = dollarCauses([
    { amount: -base, kind: "bump" },
    ...negatedCauses(modifierCauses(parts.contributions)),
  ]);
  const cost = -causesTotal(causes);
  const taken = Math.min(cost, state.money);
  const limit: Cause[] =
    taken < cost ? [{ amount: cost - taken, bound: "min", kind: "limit" }] : [];
  return { amount: cents(-taken), causes: [...causes, ...limit], dog: null, kind: "money" };
}

// What one tip pickup pays now, with its causes: money.tip, then upgrades and debuffs apply.
export function tipValue(data: Pick<GameData, "debuffs" | "tuning">, state: RunState): MoneyChange {
  if (packDogs(state).length === 0) {
    return { amount: cents(0), causes: [], dog: null, kind: "money" };
  }
  const tip = read(data.tuning, "money", "tip");
  const value = statParts(data.tuning, packModifiers(data, state), "tipValue", tip);
  const causes = dollarCauses([
    { amount: tip, kind: "tip" },
    ...modifierCauses(value.contributions),
  ]);
  return { amount: roundDollars(value.value), causes, dog: null, kind: "money" };
}

interface Payments {
  readonly changes: readonly MoneyChange[];
  readonly state: RunState;
}

// Each dog's pay for a zone, the same in every zone.
export function payFor(tuning: LiveTuning): Cents {
  return read(tuning, "money", "payPerDog");
}

// At the end of a zone, every dog still walking earns the pay, banked into the money, one change
// per dog. The money then is the zone's end money, the most an early end keeps (walkEarnings).
export function payZone(data: Pick<GameData, "tuning">, state: RunState): Payments {
  const pay = payFor(data.tuning);
  const changes = packDogs(state).map((dog): MoneyChange => ({
    amount: pay,
    causes: [{ amount: pay, kind: "pay" }],
    dog,
    kind: "money",
  }));
  const paid = changes.reduce((sum, change) => addCents(sum, change.amount), cents(0));
  const money = addCents(state.money, paid);
  return { changes, state: { ...state, money, zoneEndMoney: money } };
}

// How a walk ended, or would end now if it has not: by heading home, as an interrupted walk does.
export function endReasonOf(run: Pick<RunState, "phase">): EndReason {
  return run.phase.kind === "ended" ? run.phase.reason : "wentHome";
}

// What a walk ending for reason banks, and the cash it carried and lost. A finished walk banks
// all its money. One that ends early, heading home or with every owner having fired you, banks
// its last zone's end money, or all its money when card costs have spent below it, and loses
// what the current zone earned since.
export function walkEarnings(
  reason: EndReason,
  run: Pick<RunState, "money" | "zoneEndMoney">,
): { readonly banked: Cents; readonly lost: Cents } {
  const banked = reason === "finished" ? run.money : cents(Math.min(run.money, run.zoneEndMoney));
  return { banked, lost: cents(run.money - banked) };
}

// When every dog the walk set out with gets home after its last zone, the walk pays
// money.walkBonus into the money, as one change.
export function fullPackBonus(data: Pick<GameData, "tuning">, state: RunState): Payments {
  if (packDogs(state).length !== state.pack.length) {
    return { changes: [], state };
  }
  const amount = cents(read(data.tuning, "money", "walkBonus"));
  const change: MoneyChange = {
    amount,
    causes: [{ amount, kind: "bonus" }],
    dog: null,
    kind: "money",
  };
  return { changes: [change], state: { ...state, money: addCents(state.money, amount) } };
}

interface Firing {
  readonly fired: readonly DogId[];
  readonly state: RunState;
}

// Every owner at 0 hearts fires you and their dog leaves, so it earns no pay for the zone.
// Pay already banked stays.
export function fireOwnersAtZero(state: RunState): Firing {
  const fired = state.pack.flatMap((slot) =>
    slot.status === "walking" && slot.hearts === 0 ? [slot.dog] : [],
  );
  if (fired.length === 0) {
    return { fired, state };
  }
  const pack = mapPack(
    (slot) =>
      fired.includes(slot.dog)
        ? { dog: slot.dog, status: "fired", zoneIndex: state.zoneIndex }
        : slot,
    state.pack,
  );
  return { fired, state: { ...state, pack } };
}
