import type { DogId, EncounterId, GameData, MoneyEffect, NeedId, NeedSpotId } from "../data/types";
import { applyEffectsNow, type ChoiceData, type ChoiceOutcome } from "../rules/choices";
import { needUrgentSeconds } from "../rules/dogs";
import { addCents, read } from "../rules/units";
import { packDogs } from "../state/pack";
import type { CardSource, RunState } from "../state/runState";
import { chance, type Random } from "./random";

// Each dog's need fills while the walk moves: urgent after its energy's needUrgentByEnergy
// seconds, gone wrong needGoneWrong seconds later, when it starts again. A nervous dog walking
// alone fills nervousAloneUrgency times as fast. Steering into a spot meets the need of every
// dog that has it, except a nervous dog's at a spot that is another dog.

export type NeedData = ChoiceData & Pick<GameData, "needs" | "needSpots">;

export function isNeedSpot(data: Pick<GameData, "needSpots">, kind: string): kind is NeedSpotId {
  return Object.hasOwn(data.needSpots, kind);
}

export function needSpotOf(data: Pick<GameData, "needSpots">, kind: string): NeedSpotId | null {
  return isNeedSpot(data, kind) ? kind : null;
}

const OTHER_DOG: EncounterId = "otherDog";

// Whether a road item of this kind is another dog: the Other dog encounter, standing or loose,
// or a need spot marked otherDog.
export function isOtherDog(data: Pick<GameData, "needSpots">, kind: string): boolean {
  const spot = needSpotOf(data, kind);
  return kind === OTHER_DOG || (spot !== null && data.needSpots[spot].otherDog === true);
}

// Whether the spot meets the dog's need: it is the dog's need, and the spot is not another dog
// to a nervous dog.
export function spotMeets(
  data: Pick<GameData, "dogs" | "needSpots">,
  spot: NeedSpotId,
  dog: DogId,
): boolean {
  const { need, quirk } = data.dogs[dog];
  const { need: spotNeed, otherDog } = data.needSpots[spot];
  return need === spotNeed && !(quirk === "nervous" && otherDog === true);
}

// Whether the dog is nervous and the only dog walking: walked alone, or the others fired.
export function isNervousAlone(
  data: Pick<GameData, "dogs">,
  run: Pick<RunState, "pack">,
  dog: DogId,
): boolean {
  const walking = packDogs(run);
  return data.dogs[dog].quirk === "nervous" && walking.length === 1 && walking.includes(dog);
}

// How many seconds the dog's need fills per second walked.
export function needFillRate(
  data: Pick<GameData, "dogs" | "tuning">,
  run: Pick<RunState, "pack">,
  dog: DogId,
): number {
  return isNervousAlone(data, run, dog)
    ? read(data.tuning, "multipliers", "nervousAloneUrgency")
    : 1;
}

// The acrobatic dogs whose need a spot that is another dog just met, who flourish.
export function flourishesAt(
  data: Pick<GameData, "dogs" | "needSpots">,
  moment: NeedMoment,
): DogId[] {
  if (moment.kind !== "met" || data.needSpots[moment.spot].otherDog !== true) {
    return [];
  }
  return moment.dogs.filter((dog) => data.dogs[dog].quirk === "acrobatic");
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
    return Math.min(next, moment / needFillRate(data, run, dog));
  }, Infinity);
}

// A need met at a spot, or gone wrong. outcome is what applied at once: null when a card opened
// instead, unless a crowd pleaser's tip came with it.
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

// The spot meets every walking dog whose need it meets (spotMeets), which starts again from 0.
// Those whose need was urgent get the need's met effects, or at probability.needPayoffCard its
// payoff card instead, and a crowd pleaser among them tips money.crowdPleaserTip either way;
// the others get nothing more. Without an urgent need to meet, it draws nothing.
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
  if (run.phase.kind === "ended") {
    return { card: null, moment: null, run };
  }
  const reached = packDogs(run).filter((dog) => spotMeets(data, spot, dog));
  const dogs = reached.filter((dog) => isNeedUrgent(data, run, dog));
  const met: RunState =
    reached.length === 0
      ? run
      : {
          ...run,
          needSeconds: {
            ...run.needSeconds,
            ...Object.fromEntries(reached.map((dog) => [dog, 0])),
          },
        };
  if (dogs.length === 0) {
    return { card: null, moment: null, run: met };
  }
  const tip = crowdTip(data, random, dogs, met);
  const tipped = tip?.state ?? met;
  const { met: effects, payoff } = data.needs[need];
  if (chance(random, read(data.tuning, "probability", "needPayoffCard"))) {
    return {
      card: { affected: dogs, card: payoff, kind: "need" },
      moment: { dogs, kind: "met", need, outcome: tip, spot },
      run: tipped,
    };
  }
  const metOutcome = applyEffectsNow(
    data,
    random,
    tipped,
    { kind: "needMet", spot },
    effects,
    dogs,
  );
  const outcome = tip === null ? metOutcome : joinOutcomes(tip, metOutcome);
  return { card: null, moment: { dogs, kind: "met", need, outcome, spot }, run: outcome.state };
}

const CROWD_TIP: MoneyEffect = { amount: "crowdPleaserTip", change: "gain", kind: "money" };

// A crowd pleaser among the dogs whose need was met draws money.crowdPleaserTip, once.
function crowdTip(
  data: NeedData,
  random: Random,
  dogs: readonly DogId[],
  run: RunState,
): ChoiceOutcome | null {
  const pleaser = dogs.find((dog) => data.dogs[dog].quirk === "crowdPleaser");
  if (pleaser === undefined) {
    return null;
  }
  const source = { kind: "quirk", quirk: "crowdPleaser" } as const;
  return applyEffectsNow(data, random, run, source, [CROWD_TIP], [pleaser]);
}

// Two outcomes in a row as one: the second's state, and both their events in order.
function joinOutcomes(first: ChoiceOutcome, second: ChoiceOutcome): ChoiceOutcome {
  return {
    fired: [...first.fired, ...second.fired],
    heartChanges: [...first.heartChanges, ...second.heartChanges],
    moneyChanges: [...first.moneyChanges, ...second.moneyChanges],
    moneyDelta: addCents(first.moneyDelta, second.moneyDelta),
    quips: [...first.quips, ...second.quips],
    state: second.state,
    treatsDelta: first.treatsDelta + second.treatsDelta,
  };
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
    const walked = before + stepSeconds * needFillRate(data, next, dog);
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
