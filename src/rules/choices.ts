import type {
  CardOption,
  DogId,
  EncounterId,
  GameData,
  QuipMoment,
  UpgradeId,
} from "../data/types";
import { packDogs } from "../state/pack";
import type { CardSource, EffectSource, RunState, UpgradeOffer } from "../state/runState";
import { countChase } from "./achievements";
import { assertNever } from "./assertNever";
import {
  amountText,
  type CauseData,
  causeName,
  type Change,
  type HeartChange,
  type MoneyChange,
} from "./causes";
import { type EffectContext, moneyCost, resolveEffects } from "./effects";
import { effectText } from "./effectText";
import { fireOwnersAtZero } from "./run";
import { type Cents, cents, type Hearts } from "./units";

export type ChoiceData = CauseData & Pick<GameData, "dogs" | "tuning">;

export type OptionAvailability =
  { readonly enabled: false; readonly reason: "not enough money" } | { readonly enabled: true };

// One line of an option's enlarged view: one cause of one change the option would make,
// such as the base cost or a modifier. dog is the owner whose meter changes, or null for the
// money.
export interface BreakdownLine {
  readonly dog: DogId | null;
  readonly name: string;
  readonly text: string;
}

export interface OptionView {
  // Key of the option's illustration in the art manifest's images.
  readonly art: string;
  readonly availability: OptionAvailability;
  // Every change the option would make, cause by cause. An option that targets a random
  // owner is shown for the first owner in the pack.
  readonly breakdown: readonly BreakdownLine[];
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

// The owner of dog reacts with one of the lines in quips[dog][moment].
export interface QuipCue {
  readonly dog: DogId;
  readonly moment: QuipMoment;
}

// One of the owner's lines for the cue, drawn at random.
export function quipLine(
  data: Pick<GameData, "quips">,
  random: () => number,
  cue: QuipCue,
): string {
  const lines = data.quips[cue.dog][cue.moment];
  return lines[Math.floor(random() * lines.length)] ?? lines[0];
}

// Everything a scene needs to animate a choice or an instant encounter without recomputing
// rules.
export interface ChoiceOutcome {
  readonly fired: readonly DogId[];
  // One per owner per effect that moved their meter, in order.
  readonly heartChanges: readonly HeartChange[];
  // One per money effect that moved the money, then one per clawback by an owner who fired you.
  readonly moneyChanges: readonly MoneyChange[];
  // The total of moneyChanges.
  readonly moneyDelta: Cents;
  readonly quips: readonly QuipCue[];
  readonly state: RunState;
  readonly treatsDelta: number;
}

interface SourcedOption {
  readonly option: CardOption;
  readonly source: EffectSource;
}

// The options of an encounter that opens a card. Throws for an instant encounter.
function encounterOptions(
  data: Pick<GameData, "encounters">,
  id: EncounterId,
): readonly CardOption[] {
  const { name, resolution } = data.encounters[id];
  if (resolution.kind !== "card") {
    throw new Error(`${name} opens no card: it applies on contact`);
  }
  return resolution.options;
}

function cardContent(
  data: ChoiceData,
  source: CardSource,
): { readonly options: readonly SourcedOption[]; readonly title: string } {
  switch (source.kind) {
    case "encounter":
      return {
        options: encounterOptions(data, source.encounter).map((option, index) => ({
          option,
          source: { encounter: source.encounter, kind: "encounter", option: index },
        })),
        title: data.encounters[source.encounter].name,
      };
    case "forcedStop":
      return {
        options: data.forcedStops[source.stop].options.map((option, index) => ({
          option,
          source: { kind: "forcedStop", option: index, stop: source.stop },
        })),
        title: data.forcedStops[source.stop].name,
      };
    case "upgradeOffer":
      return {
        options: source.offered.map((upgrade) => ({
          option: data.upgrades[upgrade],
          source: { kind: "upgrade", upgrade },
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

function walkingHearts(state: RunState): Map<DogId, Hearts> {
  return new Map(
    state.pack.flatMap((slot) =>
      slot.status === "walking" ? [[slot.dog, slot.hearts] as const] : [],
    ),
  );
}

// Applies effects, then owners at 0 hearts fire you and take back their dog's fees; with no
// dogs left the run ends.
function outcomeOf(
  data: ChoiceData,
  context: EffectContext,
  effects: CardOption["effects"],
  state: RunState,
  picked: UpgradeId | undefined,
): ChoiceOutcome {
  const applied = resolveEffects(data, context, effects, state);
  const withPick =
    picked === undefined
      ? applied.state
      : { ...applied.state, upgradesPicked: [...applied.state.upgradesPicked, picked] };
  const firing = fireOwnersAtZero(withPick);
  const next: RunState = {
    ...firing.state,
    phase:
      packDogs(firing.state).length === 0
        ? { kind: "ended", reason: "noDogs" }
        : { kind: "walking" },
  };
  const isHearts = (change: Change): change is HeartChange => change.kind === "hearts";
  const isMoney = (change: Change): change is MoneyChange => change.kind === "money";

  const before = walkingHearts(state);
  const quips = [
    ...[...walkingHearts(applied.state)].flatMap(([dog, after]): QuipCue[] => {
      const previous = before.get(dog);
      return previous === undefined || previous === after || firing.fired.includes(dog)
        ? []
        : [{ dog, moment: after > previous ? "happier" : "upset" }];
    }),
    ...firing.fired.map((dog): QuipCue => ({ dog, moment: "fired" })),
  ];
  return {
    fired: firing.fired,
    heartChanges: applied.changes.filter(isHearts),
    moneyChanges: [...applied.changes.filter(isMoney), ...firing.changes],
    moneyDelta: cents(next.money - state.money),
    quips,
    state: next,
    treatsDelta: next.treats - state.treats,
  };
}

// The changes an option would make, cause by cause.
function breakdownOf(data: ChoiceData, changes: readonly Change[]): BreakdownLine[] {
  return changes.flatMap((change) =>
    change.causes.map((cause) => ({
      dog: change.dog,
      name: causeName(data, change, cause),
      text: amountText(change.kind, cause.amount),
    })),
  );
}

// The card for a source, with each option's text, cost, breakdown and whether the player can
// pick it. An option with no cost is always enabled, so every card keeps its free option.
// Throws for an instant encounter, which opens no card.
export function cardFor(data: ChoiceData, state: RunState, source: CardSource): CardView {
  const { options, title } = cardContent(data, source);
  const affected = affectedBy(state, source);
  const skip =
    source.kind === "encounter" &&
    data.encounters[source.encounter].kind === "obstacle" &&
    state.skipsLeft > 0;
  const views = options.map(({ option, source: effectSource }, index): OptionView => {
    const cost = moneyCost(data, { affected }, state, option.effects);
    const preview = outcomeOf(
      data,
      { affected, random: () => 0, source: effectSource },
      option.effects,
      state,
      undefined,
    );
    return {
      art: option.art,
      availability:
        cost <= state.money ? { enabled: true } : { enabled: false, reason: "not enough money" },
      breakdown: breakdownOf(data, [...preview.heartChanges, ...preview.moneyChanges]),
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

// Three upgrades drawn at random from those not yet picked this run, with at most one
// trade-off: a second trade-off drawn is set aside and another card drawn instead.
export function offerUpgrades(
  data: Pick<GameData, "upgrades">,
  random: () => number,
  state: RunState,
): UpgradeOffer {
  const pool = (Object.keys(data.upgrades) as UpgradeId[]).filter(
    (id) => !state.upgradesPicked.includes(id),
  );
  const isTradeOff = (id: UpgradeId) => data.upgrades[id].kind === "tradeOff";
  const offered: UpgradeId[] = [];
  while (offered.length < 3 && pool.length > 0) {
    const [picked] = pool.splice(Math.floor(random() * pool.length), 1);
    if (picked !== undefined && !(isTradeOff(picked) && offered.some(isTradeOff))) {
      offered.push(picked);
    }
  }
  const [first, second, third] = offered;
  if (first === undefined || second === undefined || third === undefined) {
    throw new Error("Fewer than 3 upgrades are left in the pool");
  }
  return [first, second, third];
}

// Applies the chosen option. Owners at 0 hearts fire you and take back their dog's fees;
// with no dogs left the run ends. An option that lets the chasers chase counts a chase.
// Throws for a disabled option or an ended run.
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
    return {
      fired: [],
      heartChanges: [],
      moneyChanges: [],
      moneyDelta: cents(0),
      quips: [],
      state: skipped,
      treatsDelta: 0,
    };
  }
  const option = view.options.find(({ index }) => index === choice);
  const content = cardContent(data, card.source).options[choice];
  if (option === undefined || content === undefined) {
    throw new RangeError(`Option ${choice} is not on the ${view.title} card`);
  }
  if (!option.availability.enabled) {
    throw new Error(`${option.label} is disabled: ${option.availability.reason}`);
  }
  const upgrade = card.source.kind === "upgradeOffer" ? card.source.offered[choice] : undefined;
  const outcome = outcomeOf(
    data,
    { affected: view.affected, random, source: content.source },
    content.option.effects,
    state,
    upgrade,
  );
  return { ...outcome, state: countChase(content.option, outcome.state) };
}

// Applies an instant encounter's effects on contact, to the dogs it caught, with the same
// outcome events as a card choice. Throws for an encounter that opens a card or an ended run.
export function applyInstantEncounter(
  data: ChoiceData,
  random: () => number,
  state: RunState,
  encounter: EncounterId,
  caught: readonly DogId[],
): ChoiceOutcome {
  const { name, resolution } = data.encounters[encounter];
  if (resolution.kind !== "instant") {
    throw new Error(`${name} opens a card: use chooseOption`);
  }
  if (state.phase.kind === "ended") {
    throw new Error("The run has ended");
  }
  const affected = packDogs(state).filter((dog) => caught.includes(dog));
  const outcome = outcomeOf(
    data,
    { affected, random, source: { encounter, kind: "instant" } },
    resolution.effects,
    state,
    undefined,
  );
  if (outcome.treatsDelta <= 0) {
    return outcome;
  }
  // Treats move no meter, so the owners who gained them say a happier line for them.
  const quipping = outcome.quips.map(({ dog }) => dog);
  const gained = packDogs(outcome.state).filter(
    (dog) => affected.includes(dog) && !quipping.includes(dog),
  );
  return {
    ...outcome,
    quips: [...outcome.quips, ...gained.map((dog): QuipCue => ({ dog, moment: "happier" }))],
  };
}
