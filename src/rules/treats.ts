import type { DebuffId, DogId, GameData } from "../data/types";
import { heartsOf } from "../state/pack";
import type { RunState } from "../state/runState";
import type { Cause, HeartChange } from "./causes";
import { maxHearts } from "./dogs";
import { changeHearts } from "./effects";
import { read } from "./units";

// Gives a carried treat to a walking dog: its owner gains hearts.treat, or a pampered dog's
// hearts.pamperedTreatHearts, counted double for a dramatic owner like every heart change,
// with the change and its causes. Nothing happens, and the treat is kept, when no treat is
// carried, the dog is not walking, or its owner is already at their max. A treat given clears
// every debuff the pack has that is curedByTreat; cured lists them.
export function giveTreat(
  data: Pick<GameData, "debuffs" | "dogs" | "tuning">,
  dog: DogId,
  state: RunState,
): {
  readonly change: HeartChange | null;
  readonly cured: readonly DebuffId[];
  readonly state: RunState;
} {
  const hearts = heartsOf(state, dog);
  const max = maxHearts(data.tuning, state.modifiers, data.dogs[dog]);
  if (state.treats <= 0 || hearts === undefined || hearts >= max) {
    return { change: null, cured: [], state };
  }
  const curable = ({ debuff }: { readonly debuff: DebuffId }) => data.debuffs[debuff].curedByTreat;
  const cured = state.debuffs.filter(curable).map(({ debuff }) => debuff);
  const kept = cured.length === 0 ? state.debuffs : state.debuffs.filter((d) => !curable(d));
  const treat = read(data.tuning, "hearts", "treat");
  const { quirk } = data.dogs[dog];
  const pampered: Cause[] =
    quirk === "pampered"
      ? [
          {
            amount: read(data.tuning, "hearts", "pamperedTreatHearts") - treat,
            kind: "quirk",
            quirk,
          },
        ]
      : [];
  const given = [{ amount: treat, kind: "treat" }, ...pampered] as const;
  const treated = { ...state, debuffs: kept, treats: state.treats - 1 };
  return { ...changeHearts(data, given, dog, treated), cured };
}

export type FaceMood = "happy" | "neutral" | "upset";

// How an owner or dog looks at a number of hearts.
export function faceMood(data: Pick<GameData, "tuning">, hearts: number): FaceMood {
  if (hearts >= read(data.tuning, "hearts", "faceHappyFrom")) {
    return "happy";
  }
  return hearts >= read(data.tuning, "hearts", "faceNeutralFrom") ? "neutral" : "upset";
}
