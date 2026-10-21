import { chance, type Random } from "../lib/random";
import { type CardView, type Choice, type ChoiceData, chooseOption } from "../rules/choices";
import type { Cents } from "../rules/units";
import type { RunState } from "../state/runState";

// heartsUnlessLow: take hearts unless an owner whose meter falls would end at LOW_HEARTS or
// less, then pay the cheapest affordable money option. alwaysHearts: always a free option.
// alwaysPay: the cheapest money option whenever one is affordable. mixed: as heartsUnlessLow,
// but while a free option is safe and a safe money option is affordable, pay at MIXED_PAY_SHARE,
// drawn from the policy's stream.
export type PolicyId = "alwaysHearts" | "alwaysPay" | "heartsUnlessLow" | "mixed";

export const POLICY_IDS: readonly PolicyId[] = [
  "heartsUnlessLow",
  "alwaysHearts",
  "alwaysPay",
  "mixed",
];

export const POLICY_NAMES: Readonly<Record<PolicyId, string>> = {
  alwaysHearts: "Always take hearts",
  alwaysPay: "Always pay when affordable",
  heartsUnlessLow: "Hearts unless an owner would drop to 1",
  mixed: "Pay half the time, and when an owner would drop to 1",
};

// The share of safe choices the mixed policy pays for.
export const MIXED_PAY_SHARE = 0.5;

// How the bot picks a fork's path: always the middle (straight), always the easiest (left),
// always the hardest (right), or one at random.
export type RoutePolicyId = "left" | "random" | "right" | "straight";

export const ROUTE_POLICY_IDS: readonly RoutePolicyId[] = ["straight", "left", "right", "random"];

// The policy the simulator uses unless told otherwise.
export const DEFAULT_ROUTE_POLICY: RoutePolicyId = "straight";

// The index of the path the route policy takes among pathCount paths, easiest first. With an
// even count, straight is the easier of the two middle paths.
export function choosePath(random: () => number, policy: RoutePolicyId, pathCount: number): number {
  switch (policy) {
    case "left":
      return 0;
    case "right":
      return pathCount - 1;
    case "straight":
      return Math.floor((pathCount - 1) / 2);
    default:
      return Math.floor(random() * pathCount);
  }
}

// An owner left at this many hearts or fewer is one bad card from firing you.
export const LOW_HEARTS = 1;

// What an enabled option would do, previewed on the current state. A random target is
// previewed on the first owner in the pack, as the card shows it.
interface OptionPreview {
  readonly choice: Choice;
  readonly cost: Cents;
  // An owner whose meter falls ends at LOW_HEARTS or less, or fires you.
  readonly endangers: boolean;
  // The sum of every owner's change.
  readonly heartsGained: number;
  readonly moneyDelta: Cents;
}

function previewOptions(data: ChoiceData, state: RunState, card: CardView): OptionPreview[] {
  return card.options
    .filter((option) => option.availability.enabled)
    .map((option) => {
      const outcome = chooseOption(data, () => 0, state, card, option.index);
      return {
        choice: option.index,
        cost: option.cost,
        endangers:
          outcome.fired.length > 0 ||
          outcome.heartChanges.some(
            (change) => change.after < change.before && change.after <= LOW_HEARTS,
          ),
        heartsGained: outcome.heartChanges.reduce(
          (sum, change) => sum + change.after - change.before,
          0,
        ),
        moneyDelta: outcome.moneyDelta,
      };
    });
}

// The first preview that no other beats on the keys, compared in order.
function best(
  previews: readonly OptionPreview[],
  keys: readonly ((preview: OptionPreview) => number)[],
): OptionPreview | undefined {
  return previews.reduce<OptionPreview | undefined>((leader, preview) => {
    if (leader === undefined) {
      return preview;
    }
    for (const key of keys) {
      const difference = key(preview) - key(leader);
      if (difference !== 0) {
        return difference > 0 ? preview : leader;
      }
    }
    return leader;
  }, undefined);
}

const cheapest = (preview: OptionPreview) => -preview.cost;
const mostHearts = (preview: OptionPreview) => preview.heartsGained;
const mostMoney = (preview: OptionPreview) => preview.moneyDelta;
const isFree = (preview: OptionPreview) => preview.cost === 0;
const isPaid = (preview: OptionPreview) => preview.cost > 0;
const isSafe = (preview: OptionPreview) => !preview.endangers;

// The free option that keeps the most money, then the most hearts.
function freePick(previews: readonly OptionPreview[]): OptionPreview | undefined {
  return best(previews.filter(isFree), [mostMoney, mostHearts]);
}

function alwaysHearts(previews: readonly OptionPreview[]): OptionPreview | undefined {
  return freePick(previews);
}

function alwaysPay(previews: readonly OptionPreview[]): OptionPreview | undefined {
  return (
    best(previews.filter(isPaid), [cheapest, mostHearts]) ??
    best(previews.filter(isFree), [mostHearts, mostMoney])
  );
}

function heartsUnlessLow(previews: readonly OptionPreview[]): OptionPreview | undefined {
  const free = freePick(previews);
  if (free === undefined || !free.endangers) {
    return free;
  }
  return (
    best(previews.filter(isPaid).filter(isSafe), [cheapest]) ??
    best(previews.filter(isFree).filter(isSafe), [mostMoney, mostHearts]) ??
    best(previews.filter(isPaid), [cheapest]) ??
    free
  );
}

// Draws only when both a safe free option and a safe money option are on the card.
function mixed(random: Random, previews: readonly OptionPreview[]): OptionPreview | undefined {
  const free = freePick(previews);
  const paid = best(previews.filter(isPaid).filter(isSafe), [cheapest, mostHearts]);
  if (free === undefined || free.endangers || paid === undefined) {
    return heartsUnlessLow(previews) ?? paid;
  }
  return chance(random, MIXED_PAY_SHARE) ? paid : free;
}

type Policy = (random: Random, previews: readonly OptionPreview[]) => OptionPreview | undefined;

const POLICIES: Readonly<Record<PolicyId, Policy>> = {
  alwaysHearts: (_, previews) => alwaysHearts(previews),
  alwaysPay: (_, previews) => alwaysPay(previews),
  heartsUnlessLow: (_, previews) => heartsUnlessLow(previews),
  mixed,
};

// An encounter card's choice. Every policy takes Hall pass's Skip when offered.
// Only the mixed policy draws from random.
export function chooseCardOption(
  data: ChoiceData,
  random: Random,
  policy: PolicyId,
  state: RunState,
  card: CardView,
): Choice {
  if (card.skip) {
    return "skip";
  }
  const picked = POLICIES[policy](random, previewOptions(data, state, card));
  if (picked === undefined) {
    throw new Error(`${card.title} has no option the ${policy} policy can take`);
  }
  return picked.choice;
}
