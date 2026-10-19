import type { CardOption, DogId, GameData, Temperament } from "../data/types";
import type { ActiveModifier, EffectSource, ModifierSource } from "../state/runState";
import { fillNames } from "../text/lines";
import { assertNever } from "./assertNever";
import { TEMPERAMENT_NAMES } from "./effectText";
import type { Contribution } from "./modifiers";
import { type Cents, cents, type Hearts } from "./units";

// One reason behind a change, with how much of the change it accounts for, in the change's
// unit: hearts, or cents for money. A change's causes sum to the change. The first is the
// base: the effect, tip, fee, clawback, treat or bump. The rest are what changed it: a temperament
// multiplier, the pack-size tip factor, a modifier, a zone's fee multiplier, or a limit (a meter held within 0 and its
// max, money held at $0 or more).
export type Cause =
  | { readonly amount: number; readonly bound: "max" | "min"; readonly kind: "limit" }
  | { readonly amount: number; readonly kind: "bump" | "clawback" | "fee" | "tip" | "treat" }
  | { readonly amount: number; readonly kind: "effect"; readonly source: EffectSource }
  | { readonly amount: number; readonly kind: "modifier"; readonly source: ModifierSource }
  | { readonly amount: number; readonly kind: "packSize"; readonly packSize: number }
  | { readonly amount: number; readonly kind: "temperament"; readonly temperament: Temperament }
  // A zone's fee multiplier, with the zone's name.
  | { readonly amount: number; readonly kind: "zone"; readonly zone: string };

// A change to one owner's meter.
export interface HeartChange {
  readonly after: Hearts;
  readonly before: Hearts;
  readonly causes: readonly Cause[];
  readonly dog: DogId;
  readonly kind: "hearts";
}

// A change to the money. dog is the dog a fee or clawback belongs to, or null.
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
  | "forcedStops"
  | "needCards"
  | "needSpots"
  | "runText"
  | "shopGear"
  | "upgrades"
>;

// "Jesse fires you": the dog's owner, whose meter reached 0.
export function firedByText(data: Pick<GameData, "dogs" | "runText">, dog: DogId): string {
  return fillNames(data.runText.firedBy, { owner: data.dogs[dog].owner.name });
}

export function modifierCauses(
  contributions: readonly Contribution<ActiveModifier>[],
  scale = 1,
): Cause[] {
  return contributions.map(({ amount, modifier }) => ({
    amount: amount * scale,
    kind: "modifier",
    source: modifier.source,
  }));
}

// Rounds money causes to whole cents so they still sum to the rounded total: each cause takes
// the change it makes to the rounded running total. Causes left at 0 are dropped, except the
// base.
export function centsCauses(causes: readonly Cause[]): Cause[] {
  let exact = 0;
  let rounded = 0;
  return causes.flatMap((cause, index) => {
    exact += cause.amount;
    const next = cents(exact);
    const amount = next - rounded;
    rounded = next;
    return amount === 0 && index > 0 ? [] : [{ ...cause, amount }];
  });
}

export function changeAmount(change: Change): number {
  return change.kind === "hearts" ? change.after - change.before : change.amount;
}

// A card option names its changes by its cause, or else its name.
function optionCause(option: CardOption | undefined): string | undefined {
  return option?.cause ?? option?.name;
}

function effectSourceName(data: CauseData, source: ModifierSource): string {
  switch (source.kind) {
    case "debuff":
      return data.debuffs[source.debuff].name;
    case "encounter": {
      const { name, resolution } = data.encounters[source.encounter];
      return resolution.kind === "card"
        ? (optionCause(resolution.options[source.option]) ?? name)
        : name;
    }
    case "forcedStop":
      return optionCause(data.forcedStops[source.stop].options[source.option]) ?? "";
    case "gear":
      return data.shopGear[source.gear].name;
    case "instant":
      return data.encounters[source.encounter].name;
    case "needCard":
      return optionCause(data.needCards[source.card].options[source.option]) ?? "";
    case "needGoneWrong":
      return "need ignored";
    case "needMet":
      return data.needSpots[source.spot].name;
    case "upgrade":
      return data.upgrades[source.upgrade].name;
    default:
      return assertNever(source);
  }
}

// A readable name for one cause of a change, such as "dramatic", "solo" or "Big tipper".
export function causeName(data: CauseData, change: Change, cause: Cause): string {
  switch (cause.kind) {
    case "clawback":
      return "fees taken back";
    case "effect":
    case "modifier":
      return effectSourceName(data, cause.source);
    case "bump":
    case "fee":
    case "tip":
    case "treat":
      return cause.kind;
    case "limit":
      if (change.kind === "money") {
        return data.runText.outOfMoney;
      }
      // A meter held at 0 means its owner fires you.
      return cause.bound === "max" ? "at max" : firedByText(data, change.dog);
    case "packSize":
      return cause.packSize === 1 ? "solo" : `pack of ${cause.packSize}`;
    case "temperament":
      return TEMPERAMENT_NAMES[cause.temperament];
    case "zone":
      return cause.zone;
    default:
      return assertNever(cause);
  }
}

const MINUS = "−";

// Money in whole dollars, as the top bar shows it: rounded, and at least $1 so a change
// never reads "$0".
function wholeDollarText(amount: number): string {
  return `$${Math.max(1, Math.round(Math.abs(amount) / 100))}`;
}

// A signed amount in the change's unit, such as "−2 ♥" or "+$2".
export function amountText(kind: Change["kind"], amount: number): string {
  const sign = amount < 0 ? MINUS : "+";
  return kind === "hearts" ? `${sign}${Math.abs(amount)} ♥` : `${sign}${wholeDollarText(amount)}`;
}

// A card choice's own effects need no name: the player just picked them.
function namesBase(cause: Cause): boolean {
  if (cause.kind !== "effect") {
    return true;
  }
  const { kind } = cause.source;
  return kind !== "encounter" && kind !== "forcedStop" && kind !== "upgrade";
}

// The short floating label for a change: its amount, then its base unless the player just
// picked it on a card, then everything that changed it, as "−2 ♥, dramatic" or
// "+$2 tip, solo".
export function causeLabel(data: CauseData, change: Change): string {
  const amount = amountText(change.kind, changeAmount(change));
  const [base, ...rest] = change.causes;
  const head =
    base !== undefined && namesBase(base) ? `${amount} ${causeName(data, change, base)}` : amount;
  return [head, ...rest.map((cause) => causeName(data, change, cause))].join(", ");
}
