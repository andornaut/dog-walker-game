import type {
  Debuff,
  DebuffId,
  DodgeEffect,
  DogId,
  Duration,
  Effect,
  EncounterId,
  GameData,
  HeartsEffect,
  HomeText,
  LiveTuning,
  Modifier,
  MoneyEffect,
  Size,
  Stat,
  Target,
} from "../data/types";
import { homeLine } from "../home/homeText";
import { assertNever } from "../lib/assertNever";
import { fillNames } from "../lib/lines";
import type { ModifiedValue } from "./modified";
import { modifierValue } from "./modifiers";
import { type Cents, cents, read } from "./units";

type TextData = Pick<GameData, "debuffs" | "encounters" | "homeText" | "tuning">;

export const SIZE_NAMES: { readonly [S in Size]: string } = {
  big: "big",
  medium: "medium",
  small: "small",
};

const STAT_NAMES: { readonly [S in Stat]: string } = {
  agility: "agility",
  bumpHearts: "♥ lost to a bump",
  debuffSeconds: "debuff time",
  forgivenHearts: "first ♥ lost each neighborhood forgiven",
  freeCards: "free cards each neighborhood",
  laneMove: "lane change time",
  maxHearts: "max ♥",
  obstacleSpawns: "obstacles",
  squirrelPulls: "pulls toward squirrels",
  startMoney: "starting cash",
  tipReach: "tip reach",
  tipSpawns: "tips",
  tipValue: "tip value",
  treatReach: "treat reach",
  treatSpawns: "treats",
};

const DURATION_TEXT: { readonly [D in Duration]: string } = {
  nextZone: "next neighborhood",
  run: "all walk",
  zone: "for the rest of the neighborhood",
};

const MINUS = "−";

// Names joined for a sentence by the words' joins: "Jesse", "Jesse and Rosa", "Jesse, Rosa and
// Kim".
export function sentenceList(words: HomeText["sentenceList"], names: readonly string[]): string {
  const head = names.slice(0, -1);
  const last = names.at(-1) ?? "";
  return head.length === 0 ? last : `${head.join(words.between)}${words.beforeLast}${last}`;
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

// "medium and big dogs dodge 1 in 8", lower case.
function dodgeText(data: TextData, effect: DodgeEffect): string {
  const sizes = sentenceList(
    data.homeText.sentenceList,
    effect.sizes.map((size) => SIZE_NAMES[size]),
  );
  const dodgeIn = String(Math.round(1 / read(data.tuning, "probability", effect.chance)));
  return homeLine(data.homeText, "dodgeEffect", { dodgeIn, sizes });
}

function heartsText(effect: HeartsEffect): string {
  const amount = `${sign(effect.amount)}${Math.abs(effect.amount)}♥`;
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

// A phrase of an effect's text, and how long what it says lasts when it says.
interface Phrase {
  readonly duration?: Duration | undefined;
  readonly text: string;
}

// One modifier's change, without its duration: "+$1 per tip", "tips +100%".
function modifierChange(tuning: LiveTuning, modifier: Modifier): string {
  const value = modifierValue(tuning, modifier);
  const name = STAT_NAMES[modifier.stat];
  const percent = Math.round((value - 1) * 100);
  if (modifier.operation === "add" && modifier.stat === "freeCards") {
    return value === 1
      ? "first card's cash options free each neighborhood"
      : `first ${value} cards' cash options free each neighborhood`;
  }
  if (modifier.operation === "add") {
    return modifier.stat === "tipValue"
      ? `${addedText(modifier, value)} per tip`
      : `${name} ${addedText(modifier, value)}`;
  }
  return value === 0 ? `no ${name}` : `${name} ${sign(percent)}${Math.abs(percent)}%`;
}

function withDuration({ duration, text }: Phrase): string {
  return duration === undefined ? text : `${text} ${DURATION_TEXT[duration]}`;
}

// One modifier, such as "+$1 per tip all walk", "tips +100% next neighborhood" or "no pulls
// toward squirrels".
function modifierText(tuning: LiveTuning, modifier: Modifier): string {
  return withDuration({ duration: modifier.duration, text: modifierChange(tuning, modifier) });
}

// What an immunity to an encounter says: a contact obstacle's own line, or the cards it stops.
function immuneText(data: TextData, encounter: EncounterId): string {
  const { name, resolution } = data.encounters[encounter];
  return resolution.kind === "contact" ? resolution.immuneText : `no ${name} cards`;
}

function effectPhrase(data: TextData, effect: Effect): Phrase {
  switch (effect.kind) {
    case "debuff":
      return {
        text: debuffStake(
          data,
          effect.debuff,
          read(data.tuning, "seconds", data.debuffs[effect.debuff].seconds),
        ),
      };
    case "dodge":
      return { text: dodgeText(data, effect) };
    case "hearts":
      return { text: heartsText(effect) };
    case "immune":
      return { duration: effect.duration, text: immuneText(data, effect.encounter) };
    case "modifier":
      return { duration: effect.duration, text: modifierChange(data.tuning, effect) };
    case "money":
      return { text: moneyText(data, effect) };
    case "skipOption":
      return { text: "a free Walk on by each neighborhood" };
    default:
      return assertNever(effect);
  }
}

// The text with its first letter upper-cased, for a name shown on its own, as a label.
export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// The phrases joined, with a duration every phrase shares said once at the end.
function phrasesText(phrases: readonly Phrase[]): string {
  const [first] = phrases;
  if (first === undefined) {
    return "Nothing";
  }
  const shared = phrases.every(({ duration }) => duration === first.duration);
  const text =
    shared && first.duration !== undefined
      ? withDuration({
          duration: first.duration,
          text: phrases.map((phrase) => phrase.text).join(", "),
        })
      : phrases.map(withDuration).join(", ");
  return capitalize(text);
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
function debuffStake(data: Pick<GameData, "debuffs">, debuff: DebuffId, seconds: number): string {
  const { name, stake } = data.debuffs[debuff];
  return `${name}: ${fillNames(stake, { seconds: String(seconds) })}`;
}

// A debuff's modifiers and how long it lasts: "tips -50% for 20 seconds".
export function debuffText(tuning: LiveTuning, debuff: Debuff): string {
  const changes = debuff.modifiers.map((modifier) => modifierText(tuning, modifier)).join(", ");
  return `${changes} for ${read(tuning, "seconds", debuff.seconds)} seconds`;
}

type CardTextData = TextData & Pick<GameData, "dogs" | "runText">;

// What a card's text knows of the walk: the dogs a target reaches, in pack order, and a
// money effect's total after modifiers, unsigned, with its modified value (null when no
// modifier changed it).
export interface CardTextContext {
  readonly dogs: (target: Target) => readonly DogId[];
  // Whether the walker's perk, such as Second chance, would forgive the dog's owner's loss.
  readonly forgiven: (dog: DogId) => boolean;
  readonly money: (effect: MoneyEffect) => {
    readonly amount: Cents;
    readonly modified: ModifiedValue | null;
  };
  // How long a debuff would last on this walk.
  readonly seconds: (debuff: DebuffId) => number;
}

// Each owner's change by their dog's name, a loss the walker's perk would forgive saying so in
// place of its cost: "♥ Duchess's safe!, −1♥ Koda".
function cardHeartsText(
  data: CardTextData,
  context: CardTextContext,
  effect: HeartsEffect,
): string | undefined {
  if (effect.target.kind === "randomOne") {
    return heartsText(effect);
  }
  const hearts = String(Math.abs(effect.amount));
  const change = `${sign(effect.amount)}${hearts}♥`;
  const names = context.dogs(effect.target).map((id) => {
    const dog = data.dogs[id].name;
    return effect.amount < 0 && context.forgiven(id)
      ? fillNames(data.runText.card.heartForgiven, { dog, hearts })
      : `${change} ${dog}`;
  });
  return names.length === 0 ? undefined : names.join(", ");
}

// Whether a modifier, such as Sweet talker, waived a cost to nothing.
function isWaived(modified: ModifiedValue | null): boolean {
  return modified !== null && modified.before < 0 && modified.after === 0;
}

// A phrase for the dogs a card catches, or undefined when the effect reaches none of them.
function cardPhrase(
  data: CardTextData,
  context: CardTextContext,
  effect: Effect,
): Phrase | undefined {
  switch (effect.kind) {
    case "debuff":
      return { text: debuffStake(data, effect.debuff, context.seconds(effect.debuff)) };
    case "hearts": {
      const text = cardHeartsText(data, context, effect);
      return text === undefined ? undefined : { text };
    }
    case "money": {
      const { amount, modified } = context.money(effect);
      return {
        text: isWaived(modified)
          ? data.runText.card.free
          : `${effect.change === "gain" ? "+" : MINUS}${formatDollars(amount)}`,
      };
    }
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
