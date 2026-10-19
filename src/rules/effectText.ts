import type {
  AffectRule,
  Condition,
  Duration,
  Effect,
  GameData,
  HeartsEffect,
  LiveTuning,
  Modifier,
  MoneyEffect,
  NeedId,
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

export type TextData = Pick<GameData, "debuffs" | "encounters" | "tuning">;

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

// The word a dog's card shows for its need.
export const NEED_WORDS: { readonly [N in NeedId]: string } = {
  friendly: "Friendly",
  nosy: "Nosy",
  playful: "Playful",
  regular: "Regular",
  thirsty: "Thirsty",
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

function sign(value: number): string {
  return value < 0 ? MINUS : "+";
}

// Whole dollars without cents, as "$5"; otherwise "$1.50".
export function formatDollars(amount: Cents): string {
  const dollars = Math.abs(amount) / 100;
  return `$${Number.isInteger(dollars) ? dollars : dollars.toFixed(2)}`;
}

function perDogText(target: Target | undefined): string {
  if (target === undefined) {
    return "";
  }
  switch (target.kind) {
    case "affected":
    case "all":
      return " per dog";
    case "need":
      return ` per ${NEED_WORDS[target.need]} dog`;
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

function moneyText(tuning: LiveTuning, effect: MoneyEffect): string {
  const amount = read(tuning, "money", effect.amount);
  const signText = effect.change === "gain" ? "+" : MINUS;
  return `${signText}${formatDollars(amount)}${perDogText(effect.perDog)}`;
}

function heartsText(effect: HeartsEffect): string {
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
      return `${amount} to ${NEED_WORDS[target.need]} owners`;
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

function treatsText(tuning: LiveTuning, effect: TreatsEffect): string {
  const amount = read(tuning, "counts", effect.amount);
  const noun = amount === 1 ? "treat" : "treats";
  const carryMax = read(tuning, "counts", "treatCarryMax");
  return `+${amount} ${noun}${perDogText(effect.perDog)} (carry up to ${carryMax})`;
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
      return `${NEED_WORDS[effect.need]} needs met`;
    case "hearts":
      return heartsText(effect);
    case "immune":
      return `no ${data.encounters[effect.encounter].name} cards ${DURATION_TEXT[effect.duration]}`;
    case "modifier":
      return modifierText(data.tuning, effect);
    case "money":
      return moneyText(data.tuning, effect);
    case "skipOption": {
      const uses = read(data.tuning, "counts", effect.usesPerRun);
      return `a free Skip option on ${uses} encounter ${uses === 1 ? "card" : "cards"} per run`;
    }
    case "treats":
      return treatsText(data.tuning, effect);
    default:
      return assertNever(effect);
  }
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// The one-line effect a card shows, built from its effects and the live tuning.
export function effectText(data: TextData, effects: readonly Effect[]): string {
  if (effects.length === 0) {
    return "Nothing";
  }
  return capitalize(effects.map((effect) => effectPhrase(data, effect)).join(", "));
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
