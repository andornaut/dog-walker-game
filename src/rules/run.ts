import type { DogId, GameData } from "../data/types";
import { mapPack, packDogs } from "../state/pack";
import type { ActiveModifier, RunState } from "../state/runState";
import { type Cause, dollarCauses, modifierCauses, type MoneyChange } from "./causes";
import { zoneFeeParts } from "./dogs";
import { statParts } from "./modifiers";
import { currentZone } from "./route";
import { addCents, cents, nonNegativeCents, read, roundDollars } from "./units";

// The modifiers the pack's debuffs apply, such as Stinky's on tipSpawns.
export function debuffModifiers(
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

// What one tip pickup pays now, with its causes: money.tip, then upgrades and debuffs apply.
export function tipValue(data: Pick<GameData, "debuffs" | "tuning">, state: RunState): MoneyChange {
  if (packDogs(state).length === 0) {
    return { amount: cents(0), causes: [], dog: null, kind: "money" };
  }
  const tip = read(data.tuning, "money", "tip");
  const modifiers = [...state.modifiers, ...debuffModifiers(data, state)];
  const value = statParts(data.tuning, modifiers, "tipValue", tip);
  const causes = dollarCauses([
    { amount: tip, kind: "tip" },
    ...modifierCauses(value.contributions),
  ]);
  return { amount: roundDollars(value.value), causes, dog: null, kind: "money" };
}

export interface Payment {
  readonly change: MoneyChange | null;
  readonly state: RunState;
}

// Bumping a minor obstacle drops money.minorBump in tips, once for the whole pack. Money never
// goes below $0; a drop cut short there is reported as a limit, and no drop at all as null.
export function minorBump(data: Pick<GameData, "tuning">, state: RunState): Payment {
  const drop = -read(data.tuning, "money", "minorBump");
  const money = nonNegativeCents(cents(state.money + drop));
  const delta = money - state.money;
  if (delta === 0) {
    return { change: null, state };
  }
  const causes: Cause[] = [{ amount: drop, kind: "bump" }];
  if (delta !== drop) {
    causes.push({ amount: delta - drop, bound: "min", kind: "limit" });
  }
  return {
    change: { amount: cents(delta), causes: dollarCauses(causes), dog: null, kind: "money" },
    state: { ...state, money },
  };
}

export interface Payments {
  readonly changes: readonly MoneyChange[];
  readonly state: RunState;
}

// At the end of a zone, every dog still walking pays its fee times the zone's fee multiplier,
// rounded to the dollar, one change per dog.
export function payZoneFees(
  data: Pick<GameData, "dogs" | "tuning" | "world">,
  state: RunState,
): Payments {
  let money = state.money;
  const zone = currentZone(data, state);
  const changes = packDogs(state).map((id): MoneyChange => {
    const fee = zoneFeeParts(data.tuning, state.modifiers, data.dogs[id]);
    const amount = roundDollars(fee.value * zone.fees);
    money = addCents(money, amount);
    const { quirk } = data.dogs[id];
    const causes = dollarCauses([
      { amount: fee.base, kind: "fee" },
      ...(fee.quirk === 0 ? [] : [{ amount: fee.quirk, kind: "quirk", quirk } as const]),
      ...modifierCauses(fee.contributions),
      ...(zone.fees === 1
        ? []
        : [{ amount: fee.value * (zone.fees - 1), kind: "zone", zone: zone.name } as const]),
    ]);
    return { amount, causes, dog: id, kind: "money" };
  });
  return { changes, state: { ...state, money } };
}

export interface Firing {
  readonly fired: readonly DogId[];
  readonly state: RunState;
}

// Every owner at 0 hearts fires you and their dog leaves. Money doesn't change: the zone they
// fire you in pays nothing for their dog, and earlier zones' fees and all tips stay.
export function fireOwnersAtZero(state: RunState): Firing {
  const fired = state.pack.flatMap((slot) =>
    slot.status === "walking" && slot.hearts === 0 ? [slot.dog] : [],
  );
  const pack = mapPack(
    (slot) =>
      fired.includes(slot.dog)
        ? { dog: slot.dog, status: "fired", zoneIndex: state.zoneIndex }
        : slot,
    state.pack,
  );
  return { fired, state: { ...state, pack } };
}
