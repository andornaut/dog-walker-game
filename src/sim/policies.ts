import type { DogId, GameData } from "../data/types";
import { type CardView, type Choice, type ChoiceData, chooseOption } from "../rules/choices";
import { maxHearts } from "../rules/dogs";
import { faceMood } from "../rules/treats";
import type { Cents } from "../rules/units";
import { chance, type Random } from "../runner/random";
import { heartsOf, packDogs } from "../state/pack";
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
export interface OptionPreview {
  readonly choice: Choice;
  readonly cost: Cents;
  // An owner whose meter falls ends at LOW_HEARTS or less, or fires you.
  readonly endangers: boolean;
  // The sum of every owner's change.
  readonly heartsGained: number;
  readonly moneyDelta: Cents;
}

export function previewOptions(data: ChoiceData, state: RunState, card: CardView): OptionPreview[] {
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

// An encounter or forced stop card's choice. Every policy takes poop bags' Skip when offered.
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

function lowestHearts(state: RunState): number {
  return Math.min(...packDogs(state).map((dog) => heartsOf(state, dog) ?? 0));
}

// When an owner's face looks upset, the upgrade that leaves the unhappiest owner with the
// most hearts, if any raises them. Otherwise the first upgrade that changes tips (their value
// or how many spawn), then the first boost, then the first card.
export function chooseUpgrade(
  data: ChoiceData & Pick<GameData, "upgrades">,
  state: RunState,
  card: CardView,
): Choice {
  if (card.source.kind !== "upgradeOffer") {
    throw new Error(`${card.title} is not an upgrade offer`);
  }
  const { offered } = card.source;
  const before = lowestHearts(state);
  if (packDogs(state).some((dog) => faceMood(data, heartsOf(state, dog) ?? 0) === "upset")) {
    const lifted = offered
      .map((_, index) => ({
        index,
        lowest: lowestHearts(chooseOption(data, () => 0, state, card, index).state),
      }))
      .filter(({ lowest }) => lowest > before);
    const top = lifted.reduce<(typeof lifted)[number] | undefined>(
      (leader, entry) => (leader === undefined || entry.lowest > leader.lowest ? entry : leader),
      undefined,
    );
    if (top !== undefined) {
      return top.index;
    }
  }
  const changesTips = offered.findIndex((id) =>
    data.upgrades[id].effects.some(
      (effect) =>
        effect.kind === "modifier" && (effect.stat === "tipValue" || effect.stat === "tipSpawns"),
    ),
  );
  if (changesTips >= 0) {
    return changesTips;
  }
  const boost = offered.findIndex((id) => data.upgrades[id].kind === "boost");
  return boost >= 0 ? boost : 0;
}

// The owner to give a carried treat to: the one with the fewest hearts among those below
// their max, the first in pack order on a tie.
export function treatTarget(
  data: Pick<GameData, "dogs" | "tuning">,
  state: RunState,
): DogId | undefined {
  let target: { readonly dog: DogId; readonly hearts: number } | undefined;
  for (const dog of packDogs(state)) {
    const hearts = heartsOf(state, dog) ?? 0;
    const below = hearts < maxHearts(data.tuning, state.modifiers, data.dogs[dog]);
    if (below && (target === undefined || hearts < target.hearts)) {
      target = { dog, hearts };
    }
  }
  return target?.dog;
}
