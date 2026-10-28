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
import { fillNames } from "../lib/lines";
import { type Random, randomInt } from "../lib/random";
import { packDogs } from "../state/pack";
import type { CardSource, EffectSource, RunState } from "../state/runState";
import { countOptionPick } from "./achievements";
import {
  amountText,
  type CauseData,
  causeName,
  type Change,
  firedByText,
  type HeartChange,
  heartsForgiven,
  type MoneyChange,
} from "./causes";
import { debuffLasting } from "./durations";
import {
  baseMoneyCost,
  type EffectContext,
  moneyAmount,
  moneyCost,
  resolveEffects,
  targetDogs,
} from "./effects";
import { cardEffectText, type CardTextContext, sentenceList } from "./effectText";
import { type ModifiedValue, modifierCause } from "./modified";
import { forkPaths, type PathSide, pathSide, zoneById } from "./route";
import { fireOwnersAtZero } from "./run";
import { type Cents, cents, type Hearts } from "./units";

export type ChoiceData = CauseData & Pick<GameData, "dogs" | "homeText" | "tuning" | "world">;

// What a card's view needs: ChoiceData, the upgrades a fork's paths carry, and the fork's
// title.
export type CardData = ChoiceData & Pick<GameData, "runText" | "upgrades">;

// A fork's path: the zone it leads to, the upgrade it carries, and what a path card shows of
// them.
interface PathView {
  readonly difficulty: Difficulty;
  readonly difficultyName: string;
  readonly side: PathSide;
  readonly upgrade: UpgradeId;
  readonly zone: ZoneId;
}

type OptionAvailability =
  { readonly enabled: false; readonly reason: "not enough money" } | { readonly enabled: true };

// One line of an option's enlarged view: one cause of one change the option would make,
// such as the base cost or a modifier. dog is the owner whose meter changes, or null for the
// money. text is the amount, empty on the line saying an owner fires you.
interface BreakdownLine {
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
  // Every value modifiers change in the option's changes, as the breakdown shows it: its cost
  // waived, a loss forgiven, a debuff shortened.
  readonly modified: readonly ModifiedValue[];
  // Set on a fork's path cards only: how long its upgrade lasts, which its plaque shows for a
  // price.
  readonly duration?: UpgradeDuration;
  // Set on a fork's path cards only.
  readonly path?: PathView;
  readonly text: string;
}

// Whether a card shows a plaque at its foot: an option that costs cash shows its price there,
// and a fork's path card how long its upgrade lasts. A free option and the Skip card have none.
export function hasPlaque(option: OptionView | undefined): option is OptionView {
  return option !== undefined && (option.path !== undefined || option.cost > 0);
}

// The most options a card shows.
export const MAX_CARD_OPTIONS = 3;

// What a card scene draws. skip is true when Hall pass offers a free Skip option; on a card
// that would then show more than MAX_CARD_OPTIONS, Skip takes the place of the option that
// costs the most hearts (see withoutCostliest).
export interface CardView {
  readonly affected: readonly DogId[];
  // The Skip option a modifier, such as Hall pass, offers: Skip options from 0 to 1.
  readonly modified: readonly ModifiedValue[];
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
export function quipLine(data: Pick<GameData, "quips">, random: Random, cue: QuipCue): string {
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
  // Every value modifiers changed, in order, such as a loss forgiven or a cost waived.
  readonly modified: readonly ModifiedValue[];
  readonly quips: readonly QuipCue[];
  readonly state: RunState;
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

type EncounterCardSource = Extract<CardSource, { readonly kind: "encounter" }>;
type ForkSource = Extract<CardSource, { readonly kind: "fork" }>;

// An encounter card's options.
function cardContent(data: ChoiceData, source: EncounterCardSource): readonly SourcedOption[] {
  return encounterOptions(data, source.encounter).map((option, index) => ({
    option,
    source: { encounter: source.encounter, kind: "encounter", option: index },
  }));
}

// The dogs the encounter affected that are still walking.
function affectedBy(state: RunState, source: EncounterCardSource): DogId[] {
  return packDogs(state).filter((dog) => source.affected.includes(dog));
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
  picked?: UpgradeId,
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
    modified: applied.modified,
    moneyChanges: applied.changes.filter(isMoney),
    moneyDelta: cents(next.money - state.money),
    quips,
    state: next,
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

// "Fires Jason": the owners an option would fire, by their dogs.
export function firesText(
  data: Pick<GameData, "dogs" | "homeText" | "runText">,
  dogs: readonly DogId[],
): string {
  const owners = sentenceList(
    data.homeText.sentenceList,
    dogs.map((dog) => data.dogs[dog].owner.name),
  );
  return fillNames(data.runText.card.fires, { owners });
}

// A fork's card: one free path card per path, left to right, each naming its zone, with the
// zone's difficulty, and the upgrade the path carries: its effect, how long
// it lasts, and the changes it would make now.
export function forkCard(data: CardData, state: RunState, source: ForkSource): CardView {
  const options = source.paths.map((id, index): OptionView => {
    const zone = zoneById(data, id);
    const upgrade = source.upgrades[index] ?? source.upgrades[0];
    if (upgrade === undefined) {
      throw new Error("A fork carries an upgrade on every path");
    }
    const { duration, effects } = data.upgrades[upgrade];
    const preview = outcomeOf(
      data,
      { affected: [], source: { kind: "upgrade", upgrade } },
      effects,
      state,
    );
    return {
      art: cardZoneKey(zone),
      availability: { enabled: true },
      breakdown: breakdownOf(data, preview),
      cost: cents(0),
      duration,
      fires: preview.fired,
      index,
      label: zone.name,
      modified: preview.modified,
      path: {
        difficulty: zone.difficulty,
        difficultyName: zone.difficultyName,
        side: pathSide(index, source.paths.length),
        upgrade,
        zone: id,
      },
      text: `${data.upgrades[upgrade].name}: ${data.upgrades[upgrade].effect}`,
    };
  });
  return {
    affected: [],
    modified: [],
    options,
    skip: false,
    source,
    title: data.runText.card.forkTitle,
  };
}

// The card for a source, with each option's text, cost, breakdown and whether the player can
// pick it. An option the player cannot afford is disabled; every card keeps a free option.
// Throws for an instant encounter, which opens no card.
export function cardFor(data: CardData, state: RunState, source: CardSource): CardView {
  return source.kind === "fork" ? forkCard(data, state, source) : effectCard(data, state, source);
}

function effectCard(data: ChoiceData, state: RunState, source: EncounterCardSource): CardView {
  const options = cardContent(data, source);
  const title = data.encounters[source.encounter].name;
  const affected = affectedBy(state, source);
  const skipBy =
    data.encounters[source.encounter].kind === "obstacle" && !state.skipUsed
      ? state.skipPass
      : null;
  const skip = skipBy !== null;
  const views = options.map(({ option, source: effectSource }, index): OptionView => {
    const preview = outcomeOf(data, { affected, source: effectSource }, option.effects, state);
    const textContext: CardTextContext = {
      dogs: (target) => targetDogs(data, { affected }, state, target),
      forgiven: (dog) =>
        preview.heartChanges.some((change) => change.dog === dog && heartsForgiven(change) > 0),
      money: (effect) => moneyAmount(data, state, effect),
      seconds: (debuff) =>
        debuffLasting(data.tuning, data.debuffs[debuff].seconds, state).secondsLeft,
    };
    const cost = moneyCost(data, state, option.effects);
    return {
      art: option.art,
      availability:
        cost <= state.money ? { enabled: true } : { enabled: false, reason: "not enough money" },
      breakdown: breakdownOf(data, preview),
      cost,
      fires: preview.fired,
      index,
      label: option.name,
      modified: preview.modified,
      text: cardEffectText(data, textContext, option.effects),
    };
  });
  return {
    affected,
    modified:
      skipBy === null
        ? []
        : [{ after: 1, before: 0, by: [modifierCause(1, skipBy)], subject: { kind: "skip" } }],
    options:
      skip && views.length >= MAX_CARD_OPTIONS
        ? withoutCostliest((view) => {
            const effects = options[view.index]?.option.effects ?? [];
            return [baseHeartsCost(effects), baseMoneyCost(data, effects)];
          }, views)
        : views,
    skip,
    source,
    title,
  };
}

// The hearts an option's effects would take from each owner they reach, before Second chance
// forgives any.
function baseHeartsCost(effects: readonly Effect[]): number {
  return effects.reduce(
    (total, effect) =>
      effect.kind === "hearts" && effect.amount < 0 ? total - effect.amount : total,
    0,
  );
}

// Drops the option Skip takes the place of: the one that costs the most hearts, the most
// expensive of those before a free card waives it if they tie, and the first one if they tie on
// both, keeping the others in order. costs gives an option's hearts, then its money.
function withoutCostliest(
  costs: (option: OptionView) => readonly [number, number],
  options: readonly OptionView[],
): OptionView[] {
  const costlier = (option: OptionView, than: OptionView): boolean => {
    const [hearts, money] = costs(option);
    const [thanHearts, thanMoney] = costs(than);
    return hearts > thanHearts || (hearts === thanHearts && money > thanMoney);
  };
  const costliest = options.reduce((most, option) => (costlier(option, most) ? option : most));
  return options.filter((option) => option !== costliest);
}

// Opens a card: the walk waits in the card phase.
export function openCard(source: CardSource, state: RunState): RunState {
  return { ...state, phase: { kind: "card", source } };
}

// count upgrades drawn at random from those not yet picked this run, with at most one
// trade-off: a second trade-off drawn is set aside and another card drawn instead.
export function offerUpgrades(
  data: Pick<GameData, "upgrades">,
  random: Random,
  count: number,
  state: Pick<RunState, "upgradesPicked">,
): UpgradeId[] {
  const pool = (Object.keys(data.upgrades) as UpgradeId[]).filter(
    (id) => !state.upgradesPicked.includes(id),
  );
  const isTradeOff = (id: UpgradeId) => data.upgrades[id].kind === "tradeOff";
  const offered: UpgradeId[] = [];
  while (offered.length < count && pool.length > 0) {
    const [picked] = pool.splice(randomInt(random, 0, pool.length), 1);
    if (picked !== undefined && !(isTradeOff(picked) && offered.some(isTradeOff))) {
      offered.push(picked);
    }
  }
  if (offered.length < count) {
    throw new Error(`Fewer than ${count} upgrades are left in the pool`);
  }
  return offered;
}

// The fork after the run's current zone: its paths are up to three zones not yet walked,
// drawn at random from forks, easiest on the left, each carrying one upgrade drawn from
// upgrades.
export function offerFork(
  data: Pick<GameData, "upgrades" | "world">,
  random: { readonly forks: Random; readonly upgrades: Random },
  state: RunState,
): ForkSource {
  const paths = forkPaths(data, random.forks, state.route);
  return {
    kind: "fork",
    paths,
    upgrades: offerUpgrades(data, random.upgrades, paths.length, state),
  };
}

// Taking a fork's path takes its upgrade, then adds its zone to the route, as the next zone
// walked.
function takePath(
  data: CardData,
  source: ForkSource,
  state: RunState,
  choice: Choice,
): ChoiceOutcome {
  const zone = choice === "skip" ? undefined : source.paths[choice];
  const upgrade = choice === "skip" ? undefined : source.upgrades[choice];
  if (zone === undefined || upgrade === undefined) {
    throw new RangeError(`Path ${choice} is not on the fork`);
  }
  const outcome = outcomeOf(
    data,
    { affected: [], source: { kind: "upgrade", upgrade } },
    data.upgrades[upgrade].effects,
    state,
    upgrade,
  );
  return { ...outcome, state: { ...outcome.state, route: [...outcome.state.route, zone] } };
}

// Applies the chosen option. Owners at 0 hearts fire you; with no dogs left the run ends. The
// pick counts one toward the option's picks; a Skip counts toward none. A fork's path takes its
// upgrade and sets the next zone. Throws for a disabled option or an ended run.
export function chooseOption(
  data: CardData,
  state: RunState,
  card: CardView,
  choice: Choice,
): ChoiceOutcome {
  if (state.phase.kind === "ended") {
    throw new Error("The run has ended");
  }
  if (card.source.kind === "fork") {
    return takePath(data, card.source, state, choice);
  }
  const view = effectCard(data, state, card.source);
  if (choice === "skip") {
    if (!view.skip) {
      throw new Error("This card has no Skip option");
    }
    const skipped: RunState = {
      ...state,
      cardsThisZone: state.cardsThisZone + 1,
      phase: { kind: "walking" },
      skipUsed: true,
    };
    return {
      fired: [],
      heartChanges: [],
      modified: [],
      moneyChanges: [],
      moneyDelta: cents(0),
      quips: [],
      state: skipped,
    };
  }
  const option = view.options.find(({ index }) => index === choice);
  const content = cardContent(data, card.source)[choice];
  if (option === undefined || content === undefined) {
    throw new RangeError(`Option ${choice} is not on the ${view.title} card`);
  }
  if (!option.availability.enabled) {
    throw new Error(`${option.label} is disabled: ${option.availability.reason}`);
  }
  const outcome = outcomeOf(
    data,
    { affected: view.affected, source: content.source },
    content.option.effects,
    state,
  );
  const counted = { ...outcome.state, cardsThisZone: state.cardsThisZone + 1 };
  return { ...outcome, state: countOptionPick(card.source.encounter, content.option.id, counted) };
}

// Applies the effects of a lucky find or a contact obstacle as it is touched, to the dogs it
// caught, with the same outcome events as a card choice. Throws for an encounter with no
// effects on contact or an ended run.
export function applyInstantEncounter(
  data: ChoiceData,
  state: RunState,
  encounter: EncounterId,
  caught: readonly DogId[],
): ChoiceOutcome {
  const { name, resolution } = data.encounters[encounter];
  if (resolution.kind !== "instant" && resolution.kind !== "contact") {
    throw new Error(`${name} has no effects on contact`);
  }
  if (state.phase.kind === "ended") {
    throw new Error("The run has ended");
  }
  const affected = packDogs(state).filter((dog) => caught.includes(dog));
  const source = { encounter, kind: "instant" } as const;
  return outcomeOf(data, { affected, source }, resolution.effects, state);
}
