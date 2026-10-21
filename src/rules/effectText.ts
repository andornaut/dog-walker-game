import type {
  Debuff,
  DebuffId,
  DogId,
  Duration,
  Effect,
  GameData,
  HeartsEffect,
  LiveTuning,
  Modifier,
  MoneyEffect,
  Size,
  Stat,
  Target,
} from "../data/types";
import { fillNames } from "../text/lines";
import { assertNever } from "./assertNever";
import { modifierValue } from "./modifiers";
import { type Cents, cents, read } from "./units";

export type TextData = Pick<GameData, "debuffs" | "encounters" | "tuning">;

export const SIZE_NAMES: { readonly [S in Size]: string } = {
  big: "big",
  medium: "medium",
  small: "small",
};

const STAT_NAMES: { readonly [S in Stat]: string } = {
  agility: "agility",
  bumpHearts: "♥ lost to a bump",
  debuffSeconds: "debuff time",
  forgivenHearts: "first ♥ lost each zone forgiven",
  freeCards: "free cards each zone",
  laneMove: "lane change time",
  maxHearts: "max ♥",
  obstacleSpawns: "obstacles",
  squirrelPulls: "pulls toward squirrels",
  startMoney: "starting money",
  tipReach: "tip reach",
  tipSpawns: "tips",
  tipValue: "tip value",
  treatReach: "treat reach",
  treatSpawns: "treats",
};

const DURATION_TEXT: { readonly [D in Duration]: string } = {
  nextZone: "next zone",
  run: "for the run",
  zone: "for the rest of the zone",
};

const MINUS = "−";

// Names joined for a sentence: "Jesse", "Jesse and Rosa", "Jesse, Rosa and Kim".
export function sentenceList(names: readonly string[]): string {
  const head = names.slice(0, -1);
  const last = names.at(-1) ?? "";
  return head.length === 0 ? last : `${head.join(", ")} and ${last}`;
}

// The sign an amount is shown with: "−" or "+".
export function sign(value: number): string {
  return value < 0 ? MINUS : "+";
}

// Whole dollars without cents, as "$5"; otherwise "$1.50".
export function formatDollars(amount: Cents): string {
  const dollars = Math.abs(amount) / 100;
  return `$${Number.isInteger(dollars) ? dollars : dollars.toFixed(2)}`;
}

function moneyText(data: TextData, effect: MoneyEffect): string {
  const amount = read(data.tuning, "money", effect.amount);
  const signText = effect.change === "gain" ? "+" : MINUS;
  return `${signText}${formatDollars(amount)}`;
}

function heartsText(effect: HeartsEffect): string {
  const amount = `${sign(effect.amount)}${Math.abs(effect.amount)} ♥`;
  const target = effect.target;
  switch (target.kind) {
    case "affected":
    case "all":
      return `${amount} each`;
    case "randomOne":
      return `${amount} to one random owner`;
    default:
      return assertNever(target);
  }
}

function addedText(modifier: Modifier, value: number): string {
  switch (modifier.stat) {
    case "startMoney":
    case "tipValue":
      return `${sign(value)}${formatDollars(cents(value))}`;
    case "treatReach":
      return `${sign(value)}${Math.abs(value)} ${Math.abs(value) === 1 ? "lane" : "lanes"}`;
    default:
      return `${sign(value)}${Math.abs(value)}`;
  }
}

// One modifier, such as "+$1 per tip for the run", "tips +100% next zone" or "no lane-input
// lock after a pull".
export function modifierText(tuning: LiveTuning, modifier: Modifier): string {
  const value = modifierValue(tuning, modifier);
  const name = STAT_NAMES[modifier.stat];
  const percent = Math.round((value - 1) * 100);
  let change: string;
  if (modifier.operation === "add" && modifier.stat === "freeCards") {
    change =
      value === 1
        ? "the first card each zone costs nothing"
        : `the first ${value} cards each zone cost nothing`;
  } else if (modifier.operation === "add") {
    change =
      modifier.stat === "tipValue"
        ? `${addedText(modifier, value)} per tip`
        : `${name} ${addedText(modifier, value)}`;
  } else if (value === 0) {
    change = `no ${name}`;
  } else {
    change = `${name} ${sign(percent)}${Math.abs(percent)}%`;
  }
  return modifier.duration === undefined ? change : `${change} ${DURATION_TEXT[modifier.duration]}`;
}

function effectPhrase(data: TextData, effect: Effect): string {
  switch (effect.kind) {
    case "debuff":
      return debuffStake(
        data,
        effect.debuff,
        read(data.tuning, "seconds", data.debuffs[effect.debuff].seconds),
      );
    case "hearts":
      return heartsText(effect);
    case "immune":
      return `no ${data.encounters[effect.encounter].name} cards ${DURATION_TEXT[effect.duration]}`;
    case "modifier":
      return modifierText(data.tuning, effect);
    case "money":
      return moneyText(data, effect);
    case "skipOption":
      return "a free Skip on every encounter card until used, once per walk";
    default:
      return assertNever(effect);
  }
}

// The text with its first letter upper-cased, for a name shown on its own, as a label.
export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function phrasesText(phrases: readonly string[]): string {
  return phrases.length === 0 ? "Nothing" : capitalize(phrases.join(", "));
}

// The one-line effect an item shows, built from its effects and the live tuning, for no
// dogs in particular: "−1 ♥ each (−2 Fancy)".
export function effectText(data: TextData, effects: readonly Effect[]): string {
  return phrasesText(effects.map((effect) => effectPhrase(data, effect)));
}

// The effect as it follows a name and a colon, lower case: "tip value +50% for the run".
export function effectClause(data: TextData, effects: readonly Effect[]): string {
  const text = effectText(data, effects);
  return text.charAt(0).toLowerCase() + text.slice(1);
}

// A debuff's name and what it does for how long, as a card states its stake: "Muddy: bumps
// cost 2♥ for 20s".
export function debuffStake(
  data: Pick<GameData, "debuffs">,
  debuff: DebuffId,
  seconds: number,
): string {
  const { name, stake } = data.debuffs[debuff];
  return `${name}: ${fillNames(stake, { seconds: String(seconds) })}`;
}

// A debuff's modifiers and how long it lasts: "tips -50% for 20 seconds".
export function debuffText(tuning: LiveTuning, debuff: Debuff): string {
  const changes = debuff.modifiers.map((modifier) => modifierText(tuning, modifier)).join(", ");
  return `${changes} for ${read(tuning, "seconds", debuff.seconds)} seconds`;
}

// A named item and its effect, lower case after the colon: "Big tipper: tip value +50% for
// the run."
export function namedEffectText(data: TextData, name: string, effects: readonly Effect[]): string {
  return `${name}: ${effectClause(data, effects)}.`;
}

export type CardTextData = TextData & Pick<GameData, "dogs" | "runText">;

// What a card's text knows of the walk: the dogs a target reaches, in pack order, and a
// money effect's total for the dogs it counts, after modifiers.
export interface CardTextContext {
  readonly dogs: (target: Target) => readonly DogId[];
  readonly money: (effect: MoneyEffect) => Cents;
  // How long a debuff would last on this walk.
  readonly seconds: (debuff: DebuffId) => number;
}

// Each owner's change by their dog's name: "−1 ♥ Duchess, −1 ♥ Koda".
function cardHeartsText(
  data: CardTextData,
  context: CardTextContext,
  effect: HeartsEffect,
): string | undefined {
  if (effect.target.kind === "randomOne") {
    return heartsText(effect);
  }
  const change = `${sign(effect.amount)}${Math.abs(effect.amount)} ♥`;
  const names = context.dogs(effect.target).map((id) => `${change} ${data.dogs[id].name}`);
  return names.length === 0 ? undefined : names.join(", ");
}

// A phrase for the dogs a card catches, or undefined when the effect reaches none of them.
function cardPhrase(
  data: CardTextData,
  context: CardTextContext,
  effect: Effect,
): string | undefined {
  switch (effect.kind) {
    case "debuff":
      return debuffStake(data, effect.debuff, context.seconds(effect.debuff));
    case "hearts":
      return cardHeartsText(data, context, effect);
    case "money":
      return `${effect.change === "gain" ? "+" : MINUS}${formatDollars(context.money(effect))}`;
    default:
      return effectPhrase(data, effect);
  }
}

// The one-line effect a card shows for the dogs it catches: each dog's heart change by name,
// and money and treats totalled for those dogs, so the text agrees with the cost plaque.
// An effect that reaches none of them is left out.
export function cardEffectText(
  data: CardTextData,
  context: CardTextContext,
  effects: readonly Effect[],
): string {
  return phrasesText(
    effects.flatMap((effect) => {
      const phrase = cardPhrase(data, context, effect);
      return phrase === undefined ? [] : [phrase];
    }),
  );
}
