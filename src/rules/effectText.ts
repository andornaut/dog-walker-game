import type {
  AffectRule,
  Condition,
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
  Temperament,
  TraitId,
  TreatsEffect,
} from "../data/types";
import { assertNever } from "./assertNever";
import { modifierValue } from "./modifiers";
import { type Cents, cents, read, readTable } from "./units";

export type TextData = Pick<GameData, "debuffs" | "encounters" | "needs" | "tuning">;

export const SIZE_NAMES: { readonly [S in Size]: string } = {
  big: "big",
  medium: "medium",
  small: "small",
};

export const TEMPERAMENT_NAMES: { readonly [T in Temperament]: string } = {
  dramatic: "dramatic",
  fussy: "fussy",
  laidBack: "laid-back",
};

export const TRAIT_NAMES: { readonly [T in TraitId]: string } = {
  chaser: "Chaser",
  fancy: "Fancy",
  foodDriven: "Food-driven",
};

const STAT_NAMES: { readonly [S in Stat]: string } = {
  chaserSquirrelPulls: "chaser pulls toward squirrels",
  costPerDog: "card costs per dog",
  fees: "fees",
  inputLock: "lane-input lock after a pull",
  maxHearts: "max ♥",
  obstacleSpawns: "obstacles",
  startHearts: "starting ♥",
  startMoney: "starting money",
  tipSpawns: "tips",
  tipValue: "tip value",
  treatReach: "treat reach",
  zoneLength: "zone length",
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

function perDogText(data: Pick<GameData, "needs">, target: Target | undefined): string {
  if (target === undefined) {
    return "";
  }
  switch (target.kind) {
    case "affected":
    case "all":
      return " per dog";
    case "need":
      return ` per ${data.needs[target.need].name} dog`;
    case "randomOne":
    case "unhappiest":
      return "";
    case "temperament":
      return ` per ${TEMPERAMENT_NAMES[target.temperament]} dog`;
    case "trait":
      return ` per ${TRAIT_NAMES[target.trait]} dog`;
    default:
      return assertNever(target);
  }
}

function moneyText(data: TextData, effect: MoneyEffect): string {
  const amount = read(data.tuning, "money", effect.amount);
  const signText = effect.change === "gain" ? "+" : MINUS;
  return `${signText}${formatDollars(amount)}${perDogText(data, effect.perDog)}`;
}

function heartsText(data: Pick<GameData, "needs">, effect: HeartsEffect): string {
  const amount = `${sign(effect.amount)}${Math.abs(effect.amount)} ♥`;
  const target = effect.target;
  switch (target.kind) {
    case "affected":
    case "all": {
      const exceptions = Object.entries(effect.traitAmounts ?? {}).map(
        ([trait, traitAmount]) =>
          `${sign(traitAmount)}${Math.abs(traitAmount)} ${TRAIT_NAMES[trait as TraitId]}`,
      );
      return exceptions.length === 0
        ? `${amount} each`
        : `${amount} each (${exceptions.join(", ")})`;
    }
    case "need":
      return `${amount} to ${data.needs[target.need].name} owners`;
    case "randomOne":
      return `${amount} to one random owner`;
    case "temperament":
      return `${amount} to ${TEMPERAMENT_NAMES[target.temperament]} owners`;
    case "trait":
      return `${amount} to ${TRAIT_NAMES[target.trait]} owners`;
    case "unhappiest":
      return `${amount} to the unhappiest owner`;
    default:
      return assertNever(target);
  }
}

function treatsText(data: TextData, effect: TreatsEffect): string {
  const amount = read(data.tuning, "counts", effect.amount);
  const noun = amount === 1 ? "treat" : "treats";
  const carryMax = read(data.tuning, "counts", "treatCarryMax");
  return `+${amount} ${noun}${perDogText(data, effect.perDog)} (carry up to ${carryMax})`;
}

function addedText(modifier: Modifier, value: number): string {
  switch (modifier.stat) {
    case "costPerDog":
    case "startMoney":
      return `${sign(value)}${formatDollars(cents(value))}`;
    case "treatReach":
      return `${sign(value)}${Math.abs(value)} ${Math.abs(value) === 1 ? "lane" : "lanes"}`;
    default:
      return `${sign(value)}${Math.abs(value)}`;
  }
}

// One modifier, such as "tip value +50% for the run" or "no lane-input lock after a pull".
export function modifierText(tuning: LiveTuning, modifier: Modifier): string {
  const value = modifierValue(tuning, modifier);
  const name = STAT_NAMES[modifier.stat];
  const percent = Math.round((value - 1) * 100);
  let change: string;
  if (modifier.operation === "add") {
    change = `${name} ${addedText(modifier, value)}`;
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
      return data.debuffs[effect.debuff].name;
    case "fulfilNeed":
      return `${data.needs[effect.need].name} needs met`;
    case "hearts":
      return heartsText(data, effect);
    case "immune":
      return `no ${data.encounters[effect.encounter].name} cards ${DURATION_TEXT[effect.duration]}`;
    case "modifier":
      return modifierText(data.tuning, effect);
    case "money":
      return moneyText(data, effect);
    case "skipOption": {
      const uses = read(data.tuning, "counts", effect.usesPerRun);
      return `a free Skip option on ${uses} encounter ${uses === 1 ? "card" : "cards"} per run`;
    }
    case "treats":
      return treatsText(data, effect);
    default:
      return assertNever(effect);
  }
}

function capitalize(text: string): string {
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

// A named item and its effect, lower case after the colon: "Big tipper: tip value +50% for
// the run."
export function namedEffectText(data: TextData, name: string, effects: readonly Effect[]): string {
  return `${name}: ${effectClause(data, effects)}.`;
}

export type CardTextData = TextData & Pick<GameData, "dogs">;

// What a card's text knows of the walk: the dogs a target reaches, in pack order, and a
// money effect's total for the dogs it counts, after modifiers.
export interface CardTextContext {
  readonly dogs: (target: Target) => readonly DogId[];
  readonly money: (effect: MoneyEffect) => Cents;
}

// Each dog's total, its owner's temperament included, with the dogs on the same total
// grouped: "−2 ♥ Duchess, −1 ♥ Koda and Biscuit".
function cardHeartsText(
  data: CardTextData,
  context: CardTextContext,
  effect: HeartsEffect,
): string | undefined {
  if (effect.target.kind === "randomOne") {
    return heartsText(data, effect);
  }
  const groups = new Map<number, string[]>();
  for (const id of context.dogs(effect.target)) {
    const dog = data.dogs[id];
    const total =
      (effect.traitAmounts?.[dog.trait] ?? effect.amount) *
      readTable(data.tuning, "multipliers", "heartsByTemperament", dog.owner.temperament);
    groups.set(total, [...(groups.get(total) ?? []), dog.name]);
  }
  if (groups.size === 0) {
    return undefined;
  }
  return [...groups]
    .map(([total, names]) => `${sign(total)}${Math.abs(total)} ♥ ${sentenceList(names)}`)
    .join(", ");
}

// A phrase for the dogs a card catches, or undefined when the effect reaches none of them.
function cardPhrase(
  data: CardTextData,
  context: CardTextContext,
  effect: Effect,
): string | undefined {
  switch (effect.kind) {
    case "hearts":
      return cardHeartsText(data, context, effect);
    case "money": {
      if (effect.perDog === undefined) {
        return moneyText(data, effect);
      }
      const total = context.money(effect);
      return total === 0
        ? undefined
        : `${effect.change === "gain" ? "+" : MINUS}${formatDollars(total)}`;
    }
    case "treats": {
      if (effect.perDog === undefined) {
        return treatsText(data, effect);
      }
      const count = read(data.tuning, "counts", effect.amount) * context.dogs(effect.perDog).length;
      const carryMax = read(data.tuning, "counts", "treatCarryMax");
      return count === 0
        ? undefined
        : `+${count} ${count === 1 ? "treat" : "treats"} (carry up to ${carryMax})`;
    }
    default:
      return effectPhrase(data, effect);
  }
}

// The one-line effect a card shows for the dogs it catches: each dog's heart total by name,
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

export function conditionText(condition: Condition): string {
  switch (condition.kind) {
    case "packHasSize":
      return `Pack has a ${SIZE_NAMES[condition.size]} dog`;
    case "packHasTrait":
      return `Pack has a ${TRAIT_NAMES[condition.trait]} dog`;
    default:
      return assertNever(condition);
  }
}

export function affectText(tuning: LiveTuning, affects: AffectRule): string {
  switch (affects.kind) {
    case "all":
      return "All dogs";
    case "caught": {
      const chances = (["small", "medium", "big"] as const).map(
        (size) =>
          `${Math.round(readTable(tuning, "probability", "catchBySize", size) * 100)}% ${size}`,
      );
      return `Dogs caught by the roll (${chances.join(", ")})`;
    }
    case "trait":
      return `${TRAIT_NAMES[affects.trait]} dogs`;
    default:
      return assertNever(affects);
  }
}
