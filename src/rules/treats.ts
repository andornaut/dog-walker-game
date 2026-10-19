import type { DogId, GameData } from "../data/types";
import { heartsOf } from "../state/pack";
import type { RunState } from "../state/runState";
import type { Cause, HeartChange } from "./causes";
import { maxHearts } from "./dogs";
import { changeHearts } from "./effects";
import { read } from "./units";

// Gives a carried treat to a walking dog: its owner gains hearts.treat, counted double for a
// dramatic owner like every heart change, with the change and its causes. Nothing happens,
// and the treat is kept, when no treat is carried, the dog is not walking, or its owner is
// already at their max.
export function giveTreat(
  data: Pick<GameData, "dogs" | "tuning">,
  dog: DogId,
  state: RunState,
): { readonly change: HeartChange | null; readonly state: RunState } {
  const hearts = heartsOf(state, dog);
  const max = maxHearts(data.tuning, state.modifiers, data.dogs[dog]);
  if (state.treats <= 0 || hearts === undefined || hearts >= max) {
    return { change: null, state };
  }
  const base: Cause = { amount: read(data.tuning, "hearts", "treat"), kind: "treat" };
  return changeHearts(data, base, dog, { ...state, treats: state.treats - 1 });
}

export type FaceMood = "happy" | "neutral" | "upset";

// How an owner or dog looks at a number of hearts.
export function faceMood(data: Pick<GameData, "tuning">, hearts: number): FaceMood {
  if (hearts >= read(data.tuning, "hearts", "faceHappyFrom")) {
    return "happy";
  }
  return hearts >= read(data.tuning, "hearts", "faceNeutralFrom") ? "neutral" : "upset";
}
