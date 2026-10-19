import type { DogId, GameData } from "../data/types";
import { mapPack, packDogs } from "../state/pack";
import type { ActiveModifier, RunState } from "../state/runState";
import { type Cause, centsCauses, modifierCauses, type MoneyChange } from "./causes";
import { zoneFeeParts } from "./dogs";
import { statParts } from "./modifiers";
import { addCents, cents, nonNegativeCents, read, readTable } from "./units";

// What one tip pickup pays now, with its causes: smaller packs tip more, then upgrades and
// debuffs apply.
export function tipValue(data: Pick<GameData, "debuffs" | "tuning">, state: RunState): MoneyChange {
  const packSize = packDogs(state).length;
  if (packSize === 0) {
    return { amount: cents(0), causes: [], dog: null, kind: "money" };
  }
  const tip = read(data.tuning, "money", "tip");
  const bySize = readTable(
    data.tuning,
    "multipliers",
    "tipByPackSize",
    packSize as keyof GameData["tuning"]["multipliers"]["tipByPackSize"],
  );
  const modifiers: ActiveModifier[] = [
    ...state.modifiers,
    ...state.debuffs.flatMap(({ debuff }) =>
      data.debuffs[debuff].modifiers.map((modifier) => ({
        ...modifier,
        source: { debuff, kind: "debuff" } as const,
      })),
    ),
  ];
  const factor = statParts(data.tuning, modifiers, "tipValue", bySize);
  const causes = centsCauses([
    { amount: tip, kind: "tip" },
    ...(bySize === 1 ? [] : [{ amount: tip * (bySize - 1), kind: "packSize", packSize } as const]),
    ...modifierCauses(factor.contributions, tip),
  ]);
  return { amount: cents(tip * factor.value), causes, dog: null, kind: "money" };
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
    change: { amount: cents(delta), causes: centsCauses(causes), dog: null, kind: "money" },
    state: { ...state, money },
  };
}

export interface Payments {
  readonly changes: readonly MoneyChange[];
  readonly state: RunState;
}

// At the end of a zone, every dog still walking pays its fee, one change per dog.
export function payZoneFees(data: Pick<GameData, "dogs" | "tuning">, state: RunState): Payments {
  const feesEarned = { ...state.feesEarned };
  let money = state.money;
  const changes = packDogs(state).map((id): MoneyChange => {
    const fee = zoneFeeParts(data.tuning, state.modifiers, data.dogs[id]);
    feesEarned[id] = addCents(feesEarned[id] ?? cents(0), fee.value);
    money = addCents(money, fee.value);
    const causes = centsCauses([
      { amount: fee.base, kind: "fee" },
      ...modifierCauses(fee.contributions),
    ]);
    return { amount: fee.value, causes, dog: id, kind: "money" };
  });
  return { changes, state: { ...state, feesEarned, money } };
}

export interface Firing {
  // One clawback per fired owner whose fees took money back.
  readonly changes: readonly MoneyChange[];
  readonly fired: readonly DogId[];
  readonly state: RunState;
}

// Every owner at 0 hearts fires you: their dog leaves, and they take back every fee it
// earned this run. Tips stay, and money never goes below $0.
export function fireOwnersAtZero(state: RunState): Firing {
  const fired = state.pack.flatMap((slot) =>
    slot.status === "walking" && slot.hearts === 0 ? [slot.dog] : [],
  );
  const feesEarned = { ...state.feesEarned };
  let money = state.money;
  const changes: MoneyChange[] = [];
  for (const dog of fired) {
    const clawback = -(feesEarned[dog] ?? 0);
    const after = nonNegativeCents(cents(money + clawback));
    const delta = after - money;
    if (delta !== 0) {
      const causes: Cause[] = [{ amount: clawback, kind: "clawback" }];
      if (delta !== clawback) {
        causes.push({ amount: delta - clawback, bound: "min", kind: "limit" });
      }
      changes.push({ amount: cents(delta), causes, dog, kind: "money" });
    }
    money = after;
    delete feesEarned[dog];
  }
  const pack = mapPack(
    (slot) =>
      fired.includes(slot.dog)
        ? { dog: slot.dog, status: "fired", zoneIndex: state.zoneIndex }
        : slot,
    state.pack,
  );
  return { changes, fired, state: { ...state, feesEarned, money, pack } };
}
