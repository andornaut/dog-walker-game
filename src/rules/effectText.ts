import type {
  Debuff,
  DebuffId,
  DodgeEffect,
  DogId,
  Duration,
  Effect,
  EncounterId,
  GameData,
  GearId,
  HeartsEffect,
  HomeText,
  LiveTuning,
  Modifier,
  MoneyEffect,
  ProbabilityKey,
  SharedHeartsEffect,
  Size,
  Target,
  WalkerPerk,
} from "../data/types";
import { HOME_TEXT_FIELDS, homeLine } from "../home/homeText";
import { assertNever } from "../lib/assertNever";
import { fillLine, fillNames, MINUS, signedText } from "../lib/lines";
import type { ModifiedValue } from "./modified";
import { modifiersOf, modifierValue } from "./modifiers";
import { type Cents, cents, read } from "./units";

type TextData = Pick<GameData, "debuffs" | "encounters" | "homeText" | "tuning">;
type WordsData = Pick<GameData, "homeText" | "tuning">;
type EffectWords = HomeText["effect"];

export const SIZE_NAMES: { readonly [S in Size]: string } = {
  large: "large",
  medium: "medium",
  small: "small",
};

// Names joined for a sentence by the words' joins: "Jason", "Jason and Rosa", "Jason, Rosa and
// Kim".
export function sentenceList(words: HomeText["sentenceList"], names: readonly string[]): string {
  const head = names.slice(0, -1);
  const last = names.at(-1) ?? "";
  return head.length === 0 ? last : `${head.join(words.between)}${words.beforeLast}${last}`;
}

// Whole dollars without cents, as "$5"; otherwise "$1.50".
export function formatDollars(amount: Cents): string {
  const dollars = Math.abs(amount) / 100;
  return `$${Number.isInteger(dollars) ? dollars : dollars.toFixed(2)}`;
}

// A money effect's amount, signed by its change: "+$5", "−$1.50".
function moneyChangeText(change: MoneyEffect["change"], amount: Cents): string {
  return `${change === "gain" ? "+" : MINUS}${formatDollars(amount)}`;
}

// A change in hearts, signed: "+3♥", "−1♥".
export function heartsChangeText(amount: number): string {
  return signedText(amount, `${Math.abs(amount)}♥`);
}

function moneyText(data: TextData, effect: MoneyEffect): string {
  return moneyChangeText(effect.change, read(data.tuning, "money", effect.amount));
}

// A dodge chance as one in so many, rounded: 0.25 as "4".
export function dodgeInText(tuning: LiveTuning, chance: ProbabilityKey): string {
  return String(Math.round(1 / read(tuning, "probability", chance)));
}

// "medium and large dogs dodge 1 in 8", lower case.
function dodgeText(data: TextData, effect: DodgeEffect): string {
  const sizes = sentenceList(
    data.homeText.sentenceList,
    effect.sizes.map((size) => SIZE_NAMES[size]),
  );
  const dodgeIn = dodgeInText(data.tuning, effect.chance);
  return homeLine(data.homeText, "dodgeEffect", { dodgeIn, sizes });
}

function heartsText(words: EffectWords, effect: HeartsEffect): string {
  const hearts = heartsChangeText(effect.amount);
  const key = effect.target.kind === "lead" ? "heartsLead" : "heartsEach";
  return fillLine(HOME_TEXT_FIELDS.effect, words, key, { hearts });
}

// Hearts shared by the pack, by their signed total: "+3♥ shared by the pack".
function sharedHeartsText(data: TextData, effect: SharedHeartsEffect): string {
  const total = read(data.tuning, "hearts", effect.amount);
  const hearts = heartsChangeText(total);
  return fillLine(HOME_TEXT_FIELDS.effect, data.homeText.effect, "heartsShared", { hearts });
}

// A fraction's size as a whole percent, unsigned: 0.3 and -0.3 both as "30%".
function percentMagnitude(fraction: number): string {
  return `${Math.abs(Math.round(fraction * 100))}%`;
}

// A fraction as a signed whole percent: 0.3 as "+30%", -0.5 as "−50%".
function percentText(fraction: number): string {
  return signedText(Math.round(fraction * 100), percentMagnitude(fraction));
}

// An agility as a signed whole percent against the base lane-change speed, an agility of 1:
// 1.4 as "+40%", 0.9 as "−10%", or null for one that rounds to the base, which shows no
// lane-change line.
export function agilityPercent(agility: number): string | null {
  const fraction = agility - 1;
  return Math.round(fraction * 100) === 0 ? null : percentText(fraction);
}

// How much a large dog slows the pack's lane changes, as a percent of the base lane-change
// speed: largeDogAgility as "10%".
export function largeSpeedText(tuning: LiveTuning): string {
  return percentMagnitude(read(tuning, "multipliers", "largeDogAgility"));
}

// A gear item's shop line, its {percent} the share of the base lane-change speed its agility
// modifiers add: Running shoes' "30% faster lane changes".
export function gearShort(data: Pick<GameData, "shopGear" | "tuning">, gear: GearId): string {
  const { effects, short } = data.shopGear[gear];
  const agility = modifiersOf(effects)
    .filter((modifier) => modifier.operation === "add" && modifier.stat === "agility")
    .reduce((sum, modifier) => sum + modifierValue(data.tuning, modifier), 0);
  return fillNames(short, { percent: percentMagnitude(agility) });
}

// A walker perk's effect line, its {percent} how far the multiplier its percent names is from
// 1: Keen eye's "25% more tips".
export function perkEffect(tuning: LiveTuning, perk: WalkerPerk): string {
  return perk.percent === undefined
    ? perk.effect
    : fillNames(perk.effect, {
        percent: percentMagnitude(read(tuning, "multipliers", perk.percent) - 1),
      });
}

function addedText(modifier: Modifier, value: number): string {
  switch (modifier.stat) {
    // Agility is a multiple of the base lane-change speed, so an added 0.3 is 30% of it.
    case "agility":
      return percentText(value);
    case "tipValue":
      return signedText(value, formatDollars(cents(value)));
    case "treatReach":
      return signedText(value, `${Math.abs(value)} ${Math.abs(value) === 1 ? "lane" : "lanes"}`);
    default:
      return signedText(value, String(Math.abs(value)));
  }
}

// A phrase of an effect's text, and how long what it says lasts when it says.
interface Phrase {
  readonly duration?: Duration | undefined;
  readonly text: string;
}

// One modifier's change, without its duration: "+$1 per tip", "tips +100%".
function modifierChange(data: WordsData, modifier: Modifier): string {
  const words = data.homeText.effect;
  const value = modifierValue(data.tuning, modifier);
  const name = words.stats[modifier.stat];
  if (modifier.operation === "add" && modifier.stat === "freeCards") {
    return value === 1
      ? words.freeCard
      : fillLine(HOME_TEXT_FIELDS.effect, words, "freeCards", { count: String(value) });
  }
  if (modifier.operation === "add") {
    return modifier.stat === "tipValue"
      ? `${addedText(modifier, value)} per tip`
      : `${addedText(modifier, value)} ${name}`;
  }
  return value === 0 ? `no ${name}` : `${percentText(value - 1)} ${name}`;
}

function withDuration(words: EffectWords, { duration, text }: Phrase): string {
  return duration === undefined ? text : `${text} ${words.durations[duration]}`;
}

// One modifier, such as "+$1 per tip all walk", "tips +100% next neighbourhood" or "no pulls
// toward squirrels".
function modifierText(data: WordsData, modifier: Modifier): string {
  return withDuration(data.homeText.effect, {
    duration: modifier.duration,
    text: modifierChange(data, modifier),
  });
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
      return { text: heartsText(data.homeText.effect, effect) };
    case "immune":
      return { duration: effect.duration, text: immuneText(data, effect.encounter) };
    case "modifier":
      return { duration: effect.duration, text: modifierChange(data, effect) };
    case "money":
      return { text: moneyText(data, effect) };
    case "sharedHearts":
      return { text: sharedHeartsText(data, effect) };
    case "skipOption":
      return { text: data.homeText.effect.skipOption };
    default:
      return assertNever(effect);
  }
}

// The text with its first letter upper-cased, for a name shown on its own, as a label.
export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// The phrases joined, with a duration every phrase shares said once at the end.
function phrasesText(words: EffectWords, phrases: readonly Phrase[]): string {
  const [first] = phrases;
  if (first === undefined) {
    return words.nothing;
  }
  const shared = phrases.every(({ duration }) => duration === first.duration);
  const text =
    shared && first.duration !== undefined
      ? withDuration(words, {
          duration: first.duration,
          text: phrases.map((phrase) => phrase.text).join(", "),
        })
      : phrases.map((phrase) => withDuration(words, phrase)).join(", ");
  return capitalize(text);
}

// The one-line effect an item shows, built from its effects and the live tuning, for no
// dogs in particular: "−1♥ each".
export function effectText(data: TextData, effects: readonly Effect[]): string {
  return phrasesText(
    data.homeText.effect,
    effects.map((effect) => effectPhrase(data, effect)),
  );
}

// The effect as it follows a name and a colon, lower case: "tip value +50% for the run".
export function effectClause(data: TextData, effects: readonly Effect[]): string {
  const text = effectText(data, effects);
  return text.charAt(0).toLowerCase() + text.slice(1);
}

// The {name}s a debuff's stake and its strip start line are filled with: cash, what a minor bump
// costs while the debuff makes bumps cost cash ($0 for one that does not), seconds, how long the
// debuff lasts or has left, and slower, how much slower its multiply agility modifiers make lane
// changes, such as Muddy's "50%" (0% for one with none).
export function debuffFields(
  data: Pick<GameData, "debuffs" | "tuning">,
  debuff: DebuffId,
  seconds: number,
): { readonly cash: string; readonly seconds: string; readonly slower: string } {
  const { bumpMoney, modifiers } = data.debuffs[debuff];
  const speed = modifiers
    .filter(({ operation, stat }) => operation === "multiply" && stat === "agility")
    .reduce((product, modifier) => product * modifierValue(data.tuning, modifier), 1);
  return {
    cash: formatDollars(bumpMoney === undefined ? cents(0) : read(data.tuning, "money", bumpMoney)),
    seconds: String(seconds),
    slower: percentMagnitude(1 - speed),
  };
}

// A debuff's name and what it does for how long, as a card states its stake: "Muddy: lane
// changes 50% slower for 20s".
function debuffStake(
  data: Pick<GameData, "debuffs" | "tuning">,
  debuff: DebuffId,
  seconds: number,
): string {
  const { name, stake } = data.debuffs[debuff];
  return `${name}: ${fillNames(stake, debuffFields(data, debuff, seconds))}`;
}

// A debuff's modifiers and how long it lasts: "tips -50% for 20 seconds".
export function debuffText(data: WordsData, debuff: Debuff): string {
  const changes = debuff.modifiers.map((modifier) => modifierText(data, modifier)).join(", ");
  return `${changes} for ${read(data.tuning, "seconds", debuff.seconds)} seconds`;
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
// place of its cost: "♥ Duchess's safe!, −1♥ Kilo".
function cardHeartsText(
  data: CardTextData,
  context: CardTextContext,
  effect: HeartsEffect,
): string | undefined {
  const hearts = String(Math.abs(effect.amount));
  const change = heartsChangeText(effect.amount);
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
        text: isWaived(modified) ? data.runText.card.free : moneyChangeText(effect.change, amount),
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
    data.homeText.effect,
    effects.flatMap((effect) => {
      const phrase = cardPhrase(data, context, effect);
      return phrase === undefined ? [] : [phrase];
    }),
  );
}
