import type { DogId, GameData, NeedId, NeedSpotId } from "../data/types";
import { applyEffectsNow, type ChoiceData, type ChoiceOutcome } from "../rules/choices";
import { needUrgentSeconds } from "../rules/dogs";
import { fulfilNeed } from "../rules/effects";
import { read } from "../rules/units";
import { packDogs } from "../state/pack";
import type { CardSource, RunState } from "../state/runState";
import { chance, type Random } from "./random";

// Each dog's need fills while the walk moves: urgent after its energy's needUrgentByEnergy
// seconds, gone wrong needGoneWrong seconds later, when it starts again. Steering into a spot
// meets the need of every dog that has it.

export type NeedData = ChoiceData & Pick<GameData, "needs" | "needSpots">;

export function isNeedSpot(data: Pick<GameData, "needSpots">, kind: string): kind is NeedSpotId {
  return Object.hasOwn(data.needSpots, kind);
}

export function needSpotOf(data: Pick<GameData, "needSpots">, kind: string): NeedSpotId | null {
  return isNeedSpot(data, kind) ? kind : null;
}

// How full the dog's need is: 0 just met, 1 when it turns urgent.
export function needFill(
  data: Pick<GameData, "dogs" | "tuning">,
  run: Pick<RunState, "needSeconds">,
  dog: DogId,
): number {
  return (run.needSeconds[dog] ?? 0) / needUrgentSeconds(data.tuning, data.dogs[dog]);
}

export function isNeedUrgent(
  data: Pick<GameData, "dogs" | "tuning">,
  run: Pick<RunState, "needSeconds">,
  dog: DogId,
): boolean {
  return needFill(data, run, dog) >= 1;
}

// Seconds of walking until the next dog's need turns urgent or goes wrong.
export function nextNeedMoment(data: Pick<GameData, "dogs" | "tuning">, run: RunState): number {
  const wrong = read(data.tuning, "seconds", "needGoneWrong");
  return packDogs(run).reduce((next, dog) => {
    const walked = run.needSeconds[dog] ?? 0;
    const urgent = needUrgentSeconds(data.tuning, data.dogs[dog]);
    const moment = walked < urgent ? urgent - walked : urgent + wrong - walked;
    return Math.min(next, moment);
  }, Infinity);
}

// A need met at a spot, or gone wrong. outcome is null when it opened a card instead.
export type NeedMoment =
  | {
      readonly dogs: readonly DogId[];
      readonly kind: "met";
      readonly need: NeedId;
      readonly outcome: ChoiceOutcome | null;
      readonly spot: NeedSpotId;
    }
  | {
      readonly dog: DogId;
      readonly kind: "goneWrong";
      readonly need: NeedId;
      readonly outcome: ChoiceOutcome | null;
    };

// cards are the payoff and trouble cards to open, in order; urgent the dogs whose need turned
// urgent this step.
export interface NeedStep {
  readonly cards: readonly CardSource[];
  readonly moments: readonly NeedMoment[];
  readonly run: RunState;
  readonly urgent: readonly DogId[];
}

// The spot meets every walking dog with its need, which starts again from 0. They get the
// need's met effects, or at probability.needPayoffCard its payoff card instead. A spot no
// dog needs does nothing and draws nothing.
export function meetNeedAt(
  data: NeedData,
  random: Random,
  spot: NeedSpotId,
  run: RunState,
): {
  readonly card: CardSource | null;
  readonly moment: NeedMoment | null;
  readonly run: RunState;
} {
  const { need } = data.needSpots[spot];
  const dogs = packDogs(run).filter((dog) => data.dogs[dog].need === need);
  if (dogs.length === 0 || run.phase.kind === "ended") {
    return { card: null, moment: null, run };
  }
  const met = fulfilNeed(data, need, run);
  const { met: effects, payoff } = data.needs[need];
  if (chance(random, read(data.tuning, "probability", "needPayoffCard"))) {
    return {
      card: { affected: dogs, card: payoff, kind: "need" },
      moment: { dogs, kind: "met", need, outcome: null, spot },
      run: met,
    };
  }
  const outcome = applyEffectsNow(data, random, met, { kind: "needMet", spot }, effects, dogs);
  return { card: null, moment: { dogs, kind: "met", need, outcome, spot }, run: outcome.state };
}

// The need goes wrong and starts again: its trouble card, or its effects on the dog.
function goWrong(
  data: NeedData,
  random: Random,
  dog: DogId,
  run: RunState,
): { readonly card: CardSource | null; readonly moment: NeedMoment; readonly run: RunState } {
  const { need } = data.dogs[dog];
  const reset: RunState = { ...run, needSeconds: { ...run.needSeconds, [dog]: 0 } };
  const wrong = data.needs[need].goneWrong;
  if (wrong.kind === "card") {
    return {
      card: { affected: [dog], card: wrong.card, kind: "need" },
      moment: { dog, kind: "goneWrong", need, outcome: null },
      run: reset,
    };
  }
  const source = { kind: "needGoneWrong", need } as const;
  const outcome = applyEffectsNow(data, random, reset, source, wrong.effects, [dog]);
  return { card: null, moment: { dog, kind: "goneWrong", need, outcome }, run: outcome.state };
}

// One step: the spots the pack steered into this step meet their needs, then every walking
// dog's need fills by the step while the walk moves, turning urgent or going wrong. A dog's
// need goes wrong at most once a step. Fills nothing unless walking with no hit stop.
export function stepNeeds(
  data: NeedData,
  random: Random,
  stepSeconds: number,
  moving: boolean,
  spots: readonly NeedSpotId[],
  run: RunState,
): NeedStep {
  const cards: CardSource[] = [];
  const moments: NeedMoment[] = [];
  const urgent: DogId[] = [];
  let next = run;
  for (const spot of spots) {
    const met = meetNeedAt(data, random, spot, next);
    next = met.run;
    if (met.card !== null) {
      cards.push(met.card);
    }
    if (met.moment !== null) {
      moments.push(met.moment);
    }
  }
  if (!moving || next.phase.kind !== "walking") {
    return { cards, moments, run: next, urgent };
  }
  const wrongAfter = read(data.tuning, "seconds", "needGoneWrong");
  for (const dog of packDogs(next)) {
    const before = next.needSeconds[dog] ?? 0;
    const walked = before + stepSeconds;
    const urgentAt = needUrgentSeconds(data.tuning, data.dogs[dog]);
    if (before < urgentAt && walked >= urgentAt) {
      urgent.push(dog);
    }
    if (walked >= urgentAt + wrongAfter && next.phase.kind === "walking") {
      const wrong = goWrong(data, random, dog, next);
      next = wrong.run;
      moments.push(wrong.moment);
      if (wrong.card !== null) {
        cards.push(wrong.card);
      }
    } else {
      next = { ...next, needSeconds: { ...next.needSeconds, [dog]: walked } };
    }
  }
  return { cards, moments, run: next, urgent };
}
