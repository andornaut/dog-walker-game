import type { DogId, GameData, LiveTuning } from "../data/types";
import { mapPack, packDogs } from "../state/pack";
import type { ActiveModifier, RunState } from "../state/runState";
import { dollarCauses, modifierCauses, type MoneyChange } from "./causes";
import { modifiedStat, statParts } from "./modifiers";
import { currentZone } from "./route";
import { addCents, type Cents, cents, read, roundDollars } from "./units";

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

// The run's modifiers and its debuffs' modifiers together.
export function packModifiers(
  data: Pick<GameData, "debuffs">,
  state: Pick<RunState, "debuffs" | "modifiers">,
): readonly ActiveModifier[] {
  return state.debuffs.length === 0
    ? state.modifiers
    : [...state.modifiers, ...debuffModifiers(data, state)];
}

// The hearts a minor bump costs its dog's owner now: hearts.bump, changed by bumpHearts
// modifiers such as Muddy's.
export function bumpHearts(
  data: Pick<GameData, "debuffs" | "tuning">,
  state: Pick<RunState, "debuffs" | "modifiers">,
): number {
  return modifiedStat(
    data.tuning,
    packModifiers(data, state),
    "bumpHearts",
    read(data.tuning, "hearts", "bump"),
  );
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

export interface Payments {
  readonly changes: readonly MoneyChange[];
  readonly state: RunState;
}

// Each dog's pay for a zone, before the zone's multiplier.
export function payFor(tuning: LiveTuning): Cents {
  return read(tuning, "money", "payPerDog");
}

// At the end of a zone, every dog still walking earns the pay times the zone's pay multiplier,
// rounded to the dollar, banked into the money, one change per dog.
export function payZone(data: Pick<GameData, "tuning" | "world">, state: RunState): Payments {
  const zone = currentZone(data, state);
  const pay = payFor(data.tuning);
  const changes = packDogs(state).map((dog): MoneyChange => {
    const amount = roundDollars(pay * zone.fees);
    const causes = dollarCauses([
      { amount: pay, kind: "pay" },
      ...(zone.fees === 1
        ? []
        : [{ amount: pay * (zone.fees - 1), kind: "zone", zone: zone.name } as const]),
    ]);
    return { amount, causes, dog, kind: "money" };
  });
  const money = changes.reduce((sum, change) => addCents(sum, change.amount), state.money);
  return { changes, state: { ...state, money } };
}

// When every dog the walk set out with gets home after its last zone, the walk pays
// money.fullPackBonusPerDog for each of them into the money, as one change.
export function fullPackBonus(data: Pick<GameData, "tuning">, state: RunState): Payments {
  if (packDogs(state).length !== state.pack.length) {
    return { changes: [], state };
  }
  const amount = cents(read(data.tuning, "money", "fullPackBonusPerDog") * state.pack.length);
  const change: MoneyChange = {
    amount,
    causes: [{ amount, kind: "bonus" }],
    dog: null,
    kind: "money",
  };
  return { changes: [change], state: { ...state, money: addCents(state.money, amount) } };
}

export interface Firing {
  readonly fired: readonly DogId[];
  readonly state: RunState;
}

// Every owner at 0 hearts fires you and their dog leaves, so it earns no pay for the zone.
// Money already banked stays.
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
