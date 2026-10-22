import type { DogId, GameData } from "../data/types";
import { heartsOf, packDogs } from "../state/pack";
import type { RunState } from "../state/runState";
import { ownerMaxHearts } from "./dogs";
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
