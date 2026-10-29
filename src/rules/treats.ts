import type { DogId, GameData } from "../data/types";
import { addCents } from "../lib/units";
import { heartsOf, packDogs } from "../state/pack";
import type { RunState } from "../state/runState";
import type { HeartChange, MoneyChange } from "./causes";
import { ownerMaxHearts } from "./dogs";
import { changeHearts } from "./effects";
import { storeSpareTreat } from "./spareTreats";
import { read } from "./units";

export type FaceMood = "happy" | "neutral" | "upset";

// How an owner or dog looks at a number of hearts out of max: happy at max, whatever the max;
// below it, upset below faceNeutralFrom, neutral at faceNeutralFrom or more than faceHappyWithin
// below max, and happy otherwise.
export function faceMood(data: Pick<GameData, "tuning">, max: number, hearts: number): FaceMood {
  if (hearts >= max) {
    return "happy";
  }
  const neutralFrom = read(data.tuning, "hearts", "faceNeutralFrom");
  if (hearts < neutralFrom) {
    return "upset";
  }
  const happyFrom = max - read(data.tuning, "hearts", "faceHappyWithin");
  return hearts === neutralFrom || hearts < happyFrom ? "neutral" : "happy";
}

// The dog whose owner gains a treat the touched dog grabbed: the touched dog's own owner, or
// with that owner at their max, the owner below their max with the fewest hearts, ties to the
// dog nearer the front. With every owner at their max, the touched dog's, who gains nothing.
export function treatRecipient(
  data: Pick<GameData, "dogs" | "tuning">,
  run: Pick<RunState, "modifiers" | "pack">,
  touched: DogId,
): DogId {
  const below = (dog: DogId, hearts: number) => hearts < ownerMaxHearts(data, run, dog);
  const own = heartsOf(run, touched);
  if (own !== undefined && below(touched, own)) {
    return touched;
  }
  let recipient = touched;
  let fewest = Infinity;
  for (const dog of packDogs(run)) {
    const hearts = heartsOf(run, dog);
    if (hearts !== undefined && hearts < fewest && below(dog, hearts)) {
      recipient = dog;
      fewest = hearts;
    }
  }
  return recipient;
}

// Whether every walking owner is at their max, so a treat raises no one's hearts.
export function everyOwnerAtMax(
  data: Pick<GameData, "dogs" | "tuning">,
  run: Pick<RunState, "modifiers" | "pack">,
): boolean {
  return packDogs(run).every((dog) => (heartsOf(run, dog) ?? 0) >= ownerMaxHearts(data, run, dog));
}

// A treat grabbed: dog is the dog whose owner it goes to (treatRecipient), and change the hearts
// that owner gained, or null with every walking owner at their max. Then the pack holds it as a
// spare treat (stored) when it has room (storeSpareTreat), and otherwise it pays money.treatCash
// as cash: a gain of its own kind, its base cause the treat, so it is never a tip.
export interface TreatGrabbed {
  readonly cash: MoneyChange | null;
  readonly change: HeartChange | null;
  readonly dog: DogId;
  readonly state: RunState;
  readonly stored: boolean;
}

// What a treat the touched dog grabbed does to run (TreatGrabbed).
export function grabTreat(
  data: Pick<GameData, "dogs" | "tuning">,
  touched: DogId,
  run: RunState,
): TreatGrabbed {
  const dog = treatRecipient(data, run, touched);
  if (!everyOwnerAtMax(data, run)) {
    const amount = read(data.tuning, "hearts", "treat");
    const fed = changeHearts(data, [{ amount, kind: "treat" }], dog, run);
    return { cash: null, change: fed.change, dog, state: fed.state, stored: false };
  }
  const stored = storeSpareTreat(data, run);
  if (stored !== null) {
    return { cash: null, change: null, dog, state: stored, stored: true };
  }
  const amount = read(data.tuning, "money", "treatCash");
  const cash: MoneyChange = {
    amount,
    causes: [{ amount, kind: "treat" }],
    dog: null,
    kind: "money",
  };
  return {
    cash,
    change: null,
    dog,
    state: { ...run, money: addCents(run.money, amount) },
    stored: false,
  };
}
