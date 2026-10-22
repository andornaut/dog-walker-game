import type { DogId, GameData } from "../data/types";
import { assertNever } from "../lib/assertNever";
import { fillNames } from "../lib/lines";
import type { ActiveModifier, EffectSource, ModifierSource } from "../state/runState";
import { sign } from "./effectText";
import type { Contribution } from "./modifiers";
import { type Cents, type Hearts, roundDollars } from "./units";

// One reason behind a change, with how much of the change it accounts for, in the change's
// unit: hearts, or cents for money. A change's causes sum to the change. The first is the
// base: the effect, tip, pay, treat or bump. The rest are what changed it: a modifier, a zone's
// fee multiplier, or a limit (a meter held within 0 and its max, money held at $0 or more).
export type Cause =
  | { readonly amount: number; readonly bound: "max" | "min"; readonly kind: "limit" }
  | { readonly amount: number; readonly kind: "bonus" | "bump" | "pay" | "tip" | "treat" }
  | { readonly amount: number; readonly kind: "effect"; readonly source: EffectSource }
  | ModifierCause
  // A zone's fee multiplier, with the zone's name.
  | { readonly amount: number; readonly kind: "zone"; readonly zone: string };

// One modifier's share of a change, in the change's unit. forgives marks the share of a loss a
// forgivenHearts modifier, such as Second chance's, forgave.
export interface ModifierCause {
  readonly amount: number;
  readonly forgives?: true;
  readonly kind: "modifier";
  readonly source: ModifierSource;
}

// A change to one owner's meter.
export interface HeartChange {
  readonly after: Hearts;
  readonly before: Hearts;
  readonly causes: readonly Cause[];
  readonly dog: DogId;
  readonly kind: "hearts";
}

// A change to the money. dog is the dog a fee belongs to, or null.
export interface MoneyChange {
  readonly amount: Cents;
  readonly causes: readonly Cause[];
  readonly dog: DogId | null;
  readonly kind: "money";
}

export type Change = HeartChange | MoneyChange;

export type CauseData = Pick<
  GameData,
  | "debuffs"
  | "dogs"
  | "encounters"
  | "runText"
  | "shopGear"
  | "upgrades"
  | "walkerPerks"
  | "walkers"
>;

// "Jesse fires you": the dog's owner, whose meter reached 0.
export function firedByText(data: Pick<GameData, "dogs" | "runText">, dog: DogId): string {
  return fillNames(data.runText.firedBy, { owner: data.dogs[dog].owner.name });
}

export function modifierCauses(
  contributions: readonly Contribution<ActiveModifier>[],
): ModifierCause[] {
  return contributions.map(({ amount, modifier }) => ({
    amount,
    kind: "modifier",
    source: modifier.source,
  }));
}

// Rounds money causes to whole dollars so they still sum to the rounded total: each cause
// takes the change it makes to the rounded running total. Causes left at 0 are dropped, except
// the base.
export function dollarCauses(causes: readonly Cause[]): Cause[] {
  let exact = 0;
  let rounded = 0;
  return causes.flatMap((cause, index) => {
    exact += cause.amount;
    const next = roundDollars(exact);
    const amount = next - rounded;
    rounded = next;
    return amount === 0 && index > 0 ? [] : [{ ...cause, amount }];
  });
}

// The hearts of a loss a forgivenHearts modifier, such as Second chance's, forgave: 0 for none.
export function heartsForgiven(change: HeartChange): number {
  return change.causes.reduce(
    (sum, cause) =>
      cause.kind === "modifier" && cause.forgives === true ? sum + cause.amount : sum,
    0,
  );
}

export function changeAmount(change: Change): number {
  return change.kind === "hearts" ? change.after - change.before : change.amount;
}

function effectSourceName(data: CauseData, source: ModifierSource): string {
  switch (source.kind) {
    case "debuff":
      return data.debuffs[source.debuff].name;
    case "encounter": {
      const { name, resolution } = data.encounters[source.encounter];
      return resolution.kind === "card" ? (resolution.options[source.option]?.name ?? name) : name;
    }
    case "gear":
      return data.shopGear[source.gear].name;
    case "instant":
      return data.encounters[source.encounter].name;
    case "upgrade":
      return data.upgrades[source.upgrade].name;
    case "walker":
      return data.walkerPerks[data.walkers[source.walker].perk].name;
    default:
      return assertNever(source);
  }
}

// A readable name for one cause of a change, such as "tip" or "Big tipper".
export function causeName(data: CauseData, change: Change, cause: Cause): string {
  switch (cause.kind) {
    case "effect":
    case "modifier":
      return effectSourceName(data, cause.source);
    case "bonus":
    case "bump":
    case "pay":
    case "tip":
    case "treat":
      return data.runText.causes[cause.kind];
    case "limit":
      // Only a meter is held at a limit; one held at 0 means its owner fires you.
      return cause.bound === "min" && change.kind === "hearts"
        ? firedByText(data, change.dog)
        : data.runText.causes.atMax;
    case "zone":
      return cause.zone;
    default:
      return assertNever(cause);
  }
}

// Money in whole dollars, as the top bar shows it: rounded, and at least $1 so a change
// never reads "$0", unless it is nothing at all, such as a tip while Stinky.
function wholeDollarText(amount: number): string {
  return amount === 0 ? "$0" : `$${Math.max(1, Math.round(Math.abs(amount) / 100))}`;
}

// A signed amount in the change's unit, such as "−2♥" or "+$2".
export function amountText(kind: Change["kind"], amount: number): string {
  return kind === "hearts"
    ? `${sign(amount)}${Math.abs(amount)}♥`
    : `${sign(amount)}${wholeDollarText(amount)}`;
}

// A card choice's own effects need no name: the player just picked them. A change cancelled
// to nothing names only what cancelled it, as "+$0 Stinky".
function namesBase(change: Change, cause: Cause): boolean {
  if (changeAmount(change) === 0 && change.causes.length > 1) {
    return false;
  }
  if (cause.kind !== "effect") {
    return true;
  }
  const { kind } = cause.source;
  return kind !== "encounter" && kind !== "upgrade";
}

// The short floating label for a change: its amount, then its base unless the player just
// picked it on a card, then everything that changed it, as "−2 ♥, dramatic" or
// "+$2 tip, Big tipper".
export function causeLabel(data: CauseData, change: Change): string {
  const amount = amountText(change.kind, changeAmount(change));
  const [base, ...rest] = change.causes;
  const others = rest.map((cause) => causeName(data, change, cause));
  if (base === undefined) {
    return amount;
  }
  if (namesBase(change, base)) {
    return [`${amount} ${causeName(data, change, base)}`, ...others].join(", ");
  }
  // A change cancelled to nothing reads as what cancelled it, as "+$0 Stinky".
  return changeAmount(change) === 0 && others.length > 0
    ? `${amount} ${others.join(", ")}`
    : [amount, ...others].join(", ");
}
