import type { DogId, GameData } from "../data/types";
import { heartsOf, mapPack } from "../state/pack";
import type { RunState } from "../state/runState";
import { maxHearts } from "./dogs";
import { clampHearts, read, readTable } from "./units";

// Gives a carried treat to a walking dog: its owner gains hearts.treat, counted double for a
// dramatic owner like every heart change. Nothing happens, and the treat is kept, when no
// treat is carried, the dog is not walking, or its owner is already at their max.
export function giveTreat(
  data: Pick<GameData, "dogs" | "tuning">,
  dog: DogId,
  state: RunState,
): RunState {
  const hearts = heartsOf(state, dog);
  const profile = data.dogs[dog];
  const max = maxHearts(data.tuning, state.modifiers, profile);
  if (state.treats <= 0 || hearts === undefined || hearts >= max) {
    return state;
  }
  const gain =
    read(data.tuning, "hearts", "treat") *
    readTable(data.tuning, "multipliers", "heartsByTemperament", profile.owner.temperament);
  const pack = mapPack(
    (slot) =>
      slot.dog === dog && slot.status === "walking"
        ? { ...slot, hearts: clampHearts(max, hearts + gain) }
        : slot,
    state.pack,
  );
  return { ...state, pack, treats: state.treats - 1 };
}

export type FaceMood = "happy" | "neutral" | "upset";

// How an owner or dog looks at a number of hearts.
export function faceMood(data: Pick<GameData, "tuning">, hearts: number): FaceMood {
  if (hearts >= read(data.tuning, "hearts", "faceHappyFrom")) {
    return "happy";
  }
  return hearts >= read(data.tuning, "hearts", "faceNeutralFrom") ? "neutral" : "upset";
}
