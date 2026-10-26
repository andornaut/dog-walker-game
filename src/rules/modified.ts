import type { DebuffId, DogId, EncounterId } from "../data/types";
import type { ActiveModifier, ModifierSource } from "../state/runState";
import type { Change, ModifierCause } from "./causes";
import type { StatParts } from "./modifiers";

// What a modified value is a value of.
export type ModifiedSubject =
  // The walker's agility.
  | { readonly kind: "agility" }
  // How long a debuff applied now lasts, in seconds.
  | { readonly debuff: DebuffId; readonly kind: "debuffSeconds" }
  // A change to an owner's meter, in hearts: a card option's, a bump's, a contact's.
  | { readonly dog: DogId; readonly kind: "hearts" }
  // How many times an encounter applies: 1, or 0 while the pack is immune to it.
  | { readonly encounter: EncounterId; readonly kind: "immune" }
  // The most hearts an owner's meter holds.
  | { readonly dog: DogId; readonly kind: "maxHearts" }
  // A change to the money, in cents: a card option's cost, a tip's pay.
  | { readonly kind: "money" }
  // How many lanes beside the pack's a tip or a treat is grabbed from.
  | { readonly kind: "reach"; readonly pickup: "tip" | "treat" }
  // How many Skip options a card offers.
  | { readonly kind: "skip" }
  // How many of a kind the current zone spawns.
  | {
      readonly kind: "spawns";
      readonly spawn: "minorObstacles" | "obstacles" | "tips" | "treats";
    }
  // How many pulls a squirrel draws.
  | { readonly kind: "squirrelPulls" }
  // The money the run started with, in cents.
  | { readonly kind: "startMoney" };

// A value that modifiers changed, such as a bump's hearts that Second chance forgave or a
// card's cost that Sweet talker waived, so a view can show the modifiers' icons: before is the
// value without them, after the value with them, and by each modifier's share of the difference,
// in the order applied. A meter or the money held at a limit is left out: after is the value
// before the limit holds it.
export interface ModifiedValue {
  readonly after: number;
  readonly before: number;
  readonly by: readonly ModifierCause[];
  readonly subject: ModifiedSubject;
}

// The modified value of before changed by by, or null when no modifier changed it.
export function modifiedValue(
  subject: ModifiedSubject,
  before: number,
  by: readonly ModifierCause[],
): ModifiedValue | null {
  if (by.length === 0) {
    return null;
  }
  const after = by.reduce((sum, cause) => sum + cause.amount, before);
  return { after, before, by, subject };
}

// The modifier causes among a change's causes.
export function modifierCausesOf(change: Change): ModifierCause[] {
  return change.causes.filter((cause): cause is ModifierCause => cause.kind === "modifier");
}

// A heart or money change's modified value: before is the sum of its causes that are no
// modifier or limit, such as its base. Null when no modifier
// changed it.
export function changeModified(change: Change): ModifiedValue | null {
  const by = modifierCausesOf(change);
  const before = change.causes.reduce(
    (sum, cause) =>
      cause.kind === "modifier" || cause.kind === "limit" ? sum : sum + cause.amount,
    0,
  );
  const subject: ModifiedSubject =
    change.kind === "hearts" ? { dog: change.dog, kind: "hearts" } : { kind: "money" };
  return modifiedValue(subject, before, by);
}

// A stat's modified value from its parts, from base. shown is how the rules use the stat, such
// as rounded to a whole count or held to a cap; each modifier's share is the change it makes to
// the shown value, and one that changes nothing shown is left out.
export function statModified(
  subject: ModifiedSubject,
  base: number,
  parts: StatParts<ActiveModifier>,
  shown: (value: number) => number = (value) => value,
): ModifiedValue | null {
  const before = shown(base);
  let exact = base;
  let previous = before;
  const by = parts.contributions.flatMap(({ amount, modifier }, index): ModifierCause[] => {
    exact += amount;
    // The last share lands on the stat's own value, free of the running sum's rounding error.
    const next = shown(index === parts.contributions.length - 1 ? parts.value : exact);
    const share = next - previous;
    previous = next;
    return share === 0 ? [] : [modifierCause(share, modifier.source)];
  });
  return modifiedValue(subject, before, by);
}

export function modifierCause(amount: number, source: ModifierSource): ModifierCause {
  return { amount, kind: "modifier", source };
}
