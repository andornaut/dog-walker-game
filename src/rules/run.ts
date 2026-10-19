import type { DogId, GameData } from "../data/types";
import { mapPack, packDogs } from "../state/pack";
import type { RunState } from "../state/runState";
import { zoneFee } from "./dogs";
import { modifiedStat } from "./modifiers";
import {
  addCents,
  type Cents,
  cents,
  multiplier,
  nonNegativeCents,
  read,
  readTable,
  scaleCents,
} from "./units";

// What one tip pickup pays now: smaller packs tip more, then upgrades and debuffs apply.
export function tipValue(data: Pick<GameData, "debuffs" | "tuning">, state: RunState): Cents {
  const packSize = packDogs(state).length;
  if (packSize === 0) {
    return cents(0);
  }
  const bySize = readTable(
    data.tuning,
    "multipliers",
    "tipByPackSize",
    packSize as keyof GameData["tuning"]["multipliers"]["tipByPackSize"],
  );
  const modifiers = [
    ...state.modifiers,
    ...state.debuffs.flatMap((id) => data.debuffs[id].modifiers),
  ];
  const factor = multiplier(modifiedStat(data.tuning, modifiers, "tipValue", bySize));
  return scaleCents(factor, read(data.tuning, "money", "tip"));
}

// At the end of a zone, every dog still walking pays its fee.
export function payZoneFees(data: Pick<GameData, "dogs" | "tuning">, state: RunState): RunState {
  const feesEarned = { ...state.feesEarned };
  let money = state.money;
  for (const id of packDogs(state)) {
    const fee = zoneFee(data.tuning, state.modifiers, data.dogs[id]);
    feesEarned[id] = addCents(feesEarned[id] ?? cents(0), fee);
    money = addCents(money, fee);
  }
  return { ...state, feesEarned, money };
}

export interface Firing {
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
  for (const dog of fired) {
    money = nonNegativeCents(cents(money - (feesEarned[dog] ?? 0)));
    delete feesEarned[dog];
  }
  const pack = mapPack(
    (slot) =>
      fired.includes(slot.dog)
        ? { dog: slot.dog, status: "fired", zoneIndex: state.zoneIndex }
        : slot,
    state.pack,
  );
  return { fired, state: { ...state, feesEarned, money, pack } };
}
