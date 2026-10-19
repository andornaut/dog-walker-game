import { cardZoneKey } from "../assets/spriteKeys";
import type {
  CardOption,
  Difficulty,
  DogId,
  Effect,
  EncounterId,
  GameData,
  QuipMoment,
  UpgradeDuration,
  UpgradeId,
  ZoneId,
} from "../data/types";
import { packDogs } from "../state/pack";
import type { CardSource, EffectSource, RunState, UpgradeOffer } from "../state/runState";
import { fillNames } from "../text/lines";
import { countChase } from "./achievements";
import { assertNever } from "./assertNever";
import {
  amountText,
  type CauseData,
  causeName,
  type Change,
  firedByText,
  type HeartChange,
  type MoneyChange,
} from "./causes";
import {
  type EffectContext,
  heartsAmount,
  moneyAmount,
  moneyCost,
  quirkFactor,
  quirkScaledDogs,
  resolveEffects,
  targetDogs,
} from "./effects";
import { cardEffectText, type CardTextContext, sentenceList } from "./effectText";
import { currentZoneId, forkPaths, type PathSide, pathSide, zoneById } from "./route";
import { fireOwnersAtZero } from "./run";
import { encounterLook } from "./skins";
import { type Cents, cents, type Hearts } from "./units";

export type ChoiceData = CauseData & Pick<GameData, "dogs" | "needs" | "tuning" | "world">;

// What a card's view needs: ChoiceData, and the titles of the cards whose data names none.
export type CardData = ChoiceData & Pick<GameData, "runText">;

// A fork's path: the zone it leads to and what a path card shows of it.
export interface PathView {
  readonly difficulty: Difficulty;
  readonly difficultyName: string;
  readonly fees: number;
  readonly side: PathSide;
  readonly zone: ZoneId;
}

export type OptionAvailability =
  { readonly enabled: false; readonly reason: "not enough money" } | { readonly enabled: true };

// One line of an option's enlarged view: one cause of one change the option would make,
// such as the base cost or a modifier. dog is the owner whose meter changes, or null for the
// money. text is the amount, empty on the line saying an owner fires you.
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
  // The dogs whose owners would fire you, as breakdown shows them.
  readonly fires: readonly DogId[];
  // The option's position in the source's data; pass it to chooseOption.
  readonly index: number;
  readonly label: string;
  // Set on an upgrade card only: how long it lasts, which its plaque shows for a price.
  readonly duration?: UpgradeDuration;
  // Set on a fork's path cards only.
  readonly path?: PathView;
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
  // One per money effect that moved the money, in order.
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

type EffectCardSource = Exclude<CardSource, { readonly kind: "fork" }>;

// A card's options and its base title; null for an upgrade offer, whose data names none.
function cardContent(
  data: ChoiceData,
  source: EffectCardSource,
): { readonly options: readonly SourcedOption[]; readonly title: string | null } {
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
    case "need": {
      const { name, options } = data.needCards[source.card];
      const dogs = source.affected.map((dog) => data.dogs[dog].name).join(" and ");
      return {
        options: options.map((option, index) => ({
          option,
          source: { card: source.card, kind: "needCard", option: index },
        })),
        title: name.replace("{dog}", dogs),
      };
    }
    case "upgradeOffer":
      return {
        options: source.offered.map((upgrade) => ({
          option: data.upgrades[upgrade],
          source: { kind: "upgrade", upgrade },
        })),
        title: null,
      };
    default:
      return assertNever(source);
  }
}

// An encounter affects the dogs it caught; a forced stop or upgrade affects the pack.
function affectedBy(state: RunState, source: CardSource): DogId[] {
  const pack = packDogs(state);
  return source.kind === "encounter" || source.kind === "need"
    ? pack.filter((dog) => source.affected.includes(dog))
    : pack;
}

function walkingHearts(state: RunState): Map<DogId, Hearts> {
  return new Map(
    state.pack.flatMap((slot) =>
      slot.status === "walking" ? [[slot.dog, slot.hearts] as const] : [],
    ),
  );
}

// Applies effects, then owners at 0 hearts fire you; with no dogs left the run ends.
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
    moneyChanges: applied.changes.filter(isMoney),
    moneyDelta: cents(next.money - state.money),
    quips,
    state: next,
    treatsDelta: next.treats - state.treats,
  };
}

function causeLines(data: ChoiceData, changes: readonly Change[]): BreakdownLine[] {
  return changes.flatMap((change) =>
    change.causes.flatMap((cause) =>
      // A meter held at 0 is said by the firing line instead.
      change.kind === "hearts" && cause.kind === "limit" && cause.bound === "min"
        ? []
        : [
            {
              dog: change.dog,
              name: causeName(data, change, cause),
              text: amountText(change.kind, cause.amount),
            },
          ],
    ),
  );
}

// The changes an option would make, cause by cause: the hearts, a line for each owner who
// would fire you, then the money.
function breakdownOf(
  data: ChoiceData,
  outcome: Pick<ChoiceOutcome, "fired" | "heartChanges" | "moneyChanges">,
): BreakdownLine[] {
  return [
    ...causeLines(data, outcome.heartChanges),
    ...outcome.fired.map((dog) => ({ dog, name: firedByText(data, dog), text: "" })),
    ...causeLines(data, outcome.moneyChanges),
  ];
}

// "Fires Jesse": the owners an option would fire, by their dogs.
export function firesText(
  data: Pick<GameData, "dogs" | "runText">,
  dogs: readonly DogId[],
): string {
  const owners = sentenceList(dogs.map((dog) => data.dogs[dog].owner.name));
  return fillNames(data.runText.card.fires, { owners });
}

// A fork's card: one free path card per path, left to right, each naming its zone, with the
// zone's difficulty and fee multiplier.
export function forkCard(
  data: CardData,
  source: Extract<CardSource, { readonly kind: "fork" }>,
): CardView {
  const options = source.paths.map((id, index): OptionView => {
    const zone = zoneById(data, id);
    return {
      art: cardZoneKey(zone),
      availability: { enabled: true },
      breakdown: [],
      cost: cents(0),
      fires: [],
      index,
      label: zone.name,
      path: {
        difficulty: zone.difficulty,
        difficultyName: zone.difficultyName,
        fees: zone.fees,
        side: pathSide(index, source.paths.length),
        zone: id,
      },
      text: `${zone.difficultyName}. Fees ×${zone.fees}.`,
    };
  });
  return { affected: [], options, skip: false, source, title: data.runText.card.forkTitle };
}

// The card for a source, with each option's text, cost, breakdown and whether the player can
// pick it. An option with no cost is always enabled, so every card keeps its free option.
// Throws for an instant encounter, which opens no card.
export function cardFor(data: CardData, state: RunState, source: CardSource): CardView {
  if (source.kind === "fork") {
    return forkCard(data, source);
  }
  const { title, ...card } = effectCard(data, state, source);
  return { ...card, title: title ?? data.runText.card.upgradeTitle };
}

function effectCard(
  data: ChoiceData,
  state: RunState,
  source: EffectCardSource,
): Omit<CardView, "title"> & { readonly title: string | null } {
  const { options, title: baseTitle } = cardContent(data, source);
  // An encounter's card is titled with its look in the zone.
  const title =
    source.kind === "encounter"
      ? encounterLook(data, currentZoneId(data, state), source.encounter).name
      : baseTitle;
  const affected = affectedBy(state, source);
  const skip =
    source.kind === "encounter" &&
    data.encounters[source.encounter].kind === "obstacle" &&
    state.skipsLeft > 0;
  const views = options.map(({ option, source: effectSource }, index): OptionView => {
    const textContext: CardTextContext = {
      dogs: (target) => targetDogs(data, { affected, random: () => 0 }, state, target),
      hearts: (effect, dog) => heartsAmount(data, effectSource, effect, dog),
      money: (effect) => moneyAmount(data, { affected }, state, effect),
      moneyQuirk: (effect) => quirkFactor(data, { affected }, effect)?.quirk ?? null,
    };
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
      breakdown: breakdownOf(data, preview),
      cost,
      fires: preview.fired,
      index,
      label: option.name,
      ...(effectSource.kind === "upgrade"
        ? { duration: data.upgrades[effectSource.upgrade].duration }
        : {}),
      text: cardEffectText(data, textContext, option.effects),
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

// The affected dogs whose quirk scales the chosen option's money, such as a ratter on a
// squirrel chase; none for Skip or a fork's path.
export function quirkActorsOf(data: ChoiceData, view: CardView, choice: Choice): DogId[] {
  if (choice === "skip" || view.source.kind === "fork") {
    return [];
  }
  const option = cardContent(data, view.source).options[choice]?.option;
  return option === undefined ? [] : quirkScaledDogs(data, option.effects, view.affected);
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

// The fork after the run's current zone: its paths are up to three zones not yet walked,
// drawn at random, easiest on the left.
export function offerFork(
  data: Pick<GameData, "world">,
  random: () => number,
  state: RunState,
): Extract<CardSource, { readonly kind: "fork" }> {
  return { kind: "fork", paths: forkPaths(data, random, state.route) };
}

// Taking a fork's path adds its zone to the route, as the next zone walked.
function takePath(
  source: Extract<CardSource, { readonly kind: "fork" }>,
  state: RunState,
  choice: Choice,
): ChoiceOutcome {
  const zone = choice === "skip" ? undefined : source.paths[choice];
  if (zone === undefined) {
    throw new RangeError(`Path ${choice} is not on the fork`);
  }
  return {
    fired: [],
    heartChanges: [],
    moneyChanges: [],
    moneyDelta: cents(0),
    quips: [],
    state: { ...state, phase: { kind: "walking" }, route: [...state.route, zone] },
    treatsDelta: 0,
  };
}

// Applies the chosen option. Owners at 0 hearts fire you; with no dogs left the run ends. An
// option that lets the chasers chase counts a chase. A fork's path sets the next zone.
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
  if (card.source.kind === "fork") {
    return takePath(card.source, state, choice);
  }
  const view = effectCard(data, state, card.source);
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

// Applies effects that open no card, such as a need met or gone wrong, to the dogs given,
// with the same outcome events as a card choice. Throws for an ended run.
export function applyEffectsNow(
  data: ChoiceData,
  random: () => number,
  state: RunState,
  source: EffectSource,
  effects: readonly Effect[],
  dogs: readonly DogId[],
): ChoiceOutcome {
  if (state.phase.kind === "ended") {
    throw new Error("The run has ended");
  }
  const affected = packDogs(state).filter((dog) => dogs.includes(dog));
  return outcomeOf(data, { affected, random, source }, effects, state, undefined);
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
  const source = { encounter, kind: "instant" } as const;
  const outcome = applyEffectsNow(data, random, state, source, resolution.effects, caught);
  if (outcome.treatsDelta <= 0) {
    return outcome;
  }
  // Treats move no meter, so the owners who gained them say a happier line for them.
  const quipping = outcome.quips.map(({ dog }) => dog);
  const gained = packDogs(outcome.state).filter(
    (dog) => caught.includes(dog) && !quipping.includes(dog),
  );
  return {
    ...outcome,
    quips: [...outcome.quips, ...gained.map((dog): QuipCue => ({ dog, moment: "happier" }))],
  };
}
