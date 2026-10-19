import type { CardOption, DogId, GameData, QuipMoment, UpgradeId } from "../data/types";
import { packDogs } from "../state/pack";
import type { CardSource, RunState, UpgradeOffer } from "../state/runState";
import { assertNever } from "./assertNever";
import { applyEffects, moneyCost } from "./effects";
import { effectText } from "./effectText";
import { fireOwnersAtZero } from "./run";
import { type Cents, cents, type Hearts } from "./units";

export type ChoiceData = Pick<
  GameData,
  "debuffs" | "dogs" | "encounters" | "forcedStops" | "tuning" | "upgrades"
>;

export type OptionAvailability =
  { readonly enabled: false; readonly reason: "not enough money" } | { readonly enabled: true };

export interface OptionView {
  readonly availability: OptionAvailability;
  readonly cost: Cents;
  // The option's position in the source's data; pass it to chooseOption.
  readonly index: number;
  readonly label: string;
  readonly text: string;
}

// The most options a card shows.
export const MAX_CARD_OPTIONS = 3;

// What a card scene draws. skip is true when poop bags offer a free Skip option; on a card
// that would then show more than MAX_CARD_OPTIONS, Skip takes the most expensive option's place.
export interface CardView {
  readonly affected: readonly DogId[];
  readonly options: readonly OptionView[];
  readonly skip: boolean;
  readonly source: CardSource;
  readonly title: string;
}

// An option's index in the source's data (OptionView.index), or the Skip option.
export type Choice = number | "skip";

export interface HeartChange {
  readonly after: Hearts;
  readonly before: Hearts;
  readonly dog: DogId;
}

// The owner of dog reacts with a line from quips[temperament][moment].
export interface QuipCue {
  readonly dog: DogId;
  readonly moment: QuipMoment;
}

// Everything a scene needs to animate a choice without recomputing rules.
export interface ChoiceOutcome {
  readonly fired: readonly DogId[];
  readonly heartChanges: readonly HeartChange[];
  // Includes fees taken back by owners who fired you.
  readonly moneyDelta: Cents;
  readonly quips: readonly QuipCue[];
  readonly state: RunState;
}

function cardContent(
  data: ChoiceData,
  source: CardSource,
): { readonly options: readonly CardOption[]; readonly title: string } {
  switch (source.kind) {
    case "encounter":
      return {
        options: data.encounters[source.encounter].options,
        title: data.encounters[source.encounter].name,
      };
    case "forcedStop":
      return {
        options: data.forcedStops[source.stop].options,
        title: data.forcedStops[source.stop].name,
      };
    case "upgradeOffer":
      return {
        options: source.offered.map((id) => ({
          effects: data.upgrades[id].effects,
          name: data.upgrades[id].name,
        })),
        title: "Pick an upgrade",
      };
    default:
      return assertNever(source);
  }
}

// An encounter affects the dogs it caught; a forced stop or upgrade affects the pack.
function affectedBy(state: RunState, source: CardSource): DogId[] {
  const pack = packDogs(state);
  return source.kind === "encounter" ? pack.filter((dog) => source.affected.includes(dog)) : pack;
}

// The card for a source, with each option's text, cost and whether the player can pick it.
// An option with no cost is always enabled, so every card keeps its free option.
export function cardFor(data: ChoiceData, state: RunState, source: CardSource): CardView {
  const { options, title } = cardContent(data, source);
  const affected = affectedBy(state, source);
  const skip =
    source.kind === "encounter" &&
    data.encounters[source.encounter].kind === "obstacle" &&
    state.skipsLeft > 0;
  const views = options.map((option, index): OptionView => {
    const cost = moneyCost(data, { affected }, state, option.effects);
    return {
      availability:
        cost <= state.money ? { enabled: true } : { enabled: false, reason: "not enough money" },
      cost,
      index,
      label: option.name,
      text: effectText(data, option.effects),
    };
  });
  return {
    affected,
    options: skip && views.length >= MAX_CARD_OPTIONS ? withoutMostExpensive(views) : views,
    skip,
    source,
    title,
  };
}

// Drops the costliest option, the first one if several tie, keeping the others in order.
function withoutMostExpensive(options: readonly OptionView[]): OptionView[] {
  const costliest = options.reduce((most, option) => (option.cost > most.cost ? option : most));
  return options.filter((option) => option !== costliest);
}

// Opens a card: an upgrade offer waits in the upgrade phase, anything else in the card phase.
export function openCard(source: CardSource, state: RunState): RunState {
  return {
    ...state,
    phase:
      source.kind === "upgradeOffer"
        ? { kind: "upgrade", offered: source.offered }
        : { kind: "card", source },
  };
}

// Three upgrades drawn from those not yet picked this run.
export function offerUpgrades(
  data: Pick<GameData, "upgrades">,
  random: () => number,
  state: RunState,
): UpgradeOffer {
  const pool = (Object.keys(data.upgrades) as UpgradeId[]).filter(
    (id) => !state.upgradesPicked.includes(id),
  );
  const offered: UpgradeId[] = [];
  while (offered.length < 3 && pool.length > 0) {
    const [picked] = pool.splice(Math.floor(random() * pool.length), 1);
    if (picked !== undefined) {
      offered.push(picked);
    }
  }
  const [first, second, third] = offered;
  if (first === undefined || second === undefined || third === undefined) {
    throw new Error("Fewer than 3 upgrades are left in the pool");
  }
  return [first, second, third];
}

function walkingHearts(state: RunState): Map<DogId, Hearts> {
  return new Map(
    state.pack.flatMap((slot) =>
      slot.status === "walking" ? [[slot.dog, slot.hearts] as const] : [],
    ),
  );
}

// Applies the chosen option. Owners at 0 hearts fire you and take back their dog's fees;
// with no dogs left the run ends. Throws for a disabled option or an ended run.
export function chooseOption(
  data: ChoiceData,
  random: () => number,
  state: RunState,
  card: CardView,
  choice: Choice,
): ChoiceOutcome {
  if (state.phase.kind === "ended") {
    throw new Error("The run has ended");
  }
  const view = cardFor(data, state, card.source);
  if (choice === "skip") {
    if (!view.skip) {
      throw new Error("This card has no Skip option");
    }
    const skipped: RunState = {
      ...state,
      phase: { kind: "walking" },
      skipsLeft: state.skipsLeft - 1,
    };
    return { fired: [], heartChanges: [], moneyDelta: cents(0), quips: [], state: skipped };
  }
  const option = view.options.find(({ index }) => index === choice);
  const content = cardContent(data, card.source).options[choice];
  if (option === undefined || content === undefined) {
    throw new RangeError(`Option ${choice} is not on the ${view.title} card`);
  }
  if (!option.availability.enabled) {
    throw new Error(`${option.label} is disabled: ${option.availability.reason}`);
  }

  const applied = applyEffects(data, { affected: view.affected, random }, content.effects, state);
  const upgrade = card.source.kind === "upgradeOffer" ? card.source.offered[choice] : undefined;
  const picked =
    upgrade === undefined
      ? applied
      : { ...applied, upgradesPicked: [...applied.upgradesPicked, upgrade] };
  const { fired, state: afterFiring } = fireOwnersAtZero(picked);
  const next: RunState = {
    ...afterFiring,
    phase:
      packDogs(afterFiring).length === 0
        ? { kind: "ended", reason: "noDogs" }
        : { kind: "walking" },
  };

  const before = walkingHearts(state);
  const heartChanges = [...walkingHearts(applied)].flatMap(([dog, after]) => {
    const previous = before.get(dog);
    return previous === undefined || previous === after ? [] : [{ after, before: previous, dog }];
  });
  const quips = [
    ...heartChanges
      .filter(({ dog }) => !fired.includes(dog))
      .map(({ after, before: previous, dog }): QuipCue => ({
        dog,
        moment: after > previous ? "happier" : "upset",
      })),
    ...fired.map((dog): QuipCue => ({ dog, moment: "fired" })),
  ];
  return {
    fired,
    heartChanges,
    moneyDelta: cents(next.money - state.money),
    quips,
    state: next,
  };
}
