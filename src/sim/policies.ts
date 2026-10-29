import { chance, type Random, randomInt } from "@andornaut/game-kit/random";

import { heartsForgiven } from "../rules/causes";
import { type CardView, type Choice, type ChoiceData, chooseOption } from "../rules/choices";
import type { RunState } from "../state/runState";
import type { Cents } from "../units";

// heartsUnlessLow: take hearts unless an owner whose meter falls would end at LOW_HEARTS or
// less, then pay the cheapest affordable money option. alwaysHearts: always a free option.
// alwaysPay: the cheapest money option whenever one is affordable. mixed: as heartsUnlessLow,
// but while a free option is safe and a safe money option is affordable, pay at MIXED_PAY_SHARE,
// drawn from the policy's stream. debuffs: a safe debuff option whenever one is offered, else
// as mixed. noDebuffs: as mixed among the options that give no debuff while one of them is
// safe, else as mixed among them all.
export type PolicyId =
  "alwaysHearts" | "alwaysPay" | "debuffs" | "heartsUnlessLow" | "mixed" | "noDebuffs";

export const POLICY_IDS: readonly PolicyId[] = [
  "heartsUnlessLow",
  "alwaysHearts",
  "alwaysPay",
  "mixed",
  "debuffs",
  "noDebuffs",
];

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
      return randomInt(random, 0, pathCount);
  }
}

// An owner left at this many hearts or fewer is one bad card from firing you.
export const LOW_HEARTS = 1;

// What an enabled option would do, previewed on the current state.
interface OptionPreview {
  readonly choice: Choice;
  readonly cost: Cents;
  // The pack gets a debuff.
  readonly debuffs: boolean;
  // An owner whose meter falls ends at LOW_HEARTS or less, or fires you.
  readonly endangers: boolean;
  // An owner loses hearts, or a perk forgives the loss, or the pack gets a debuff.
  readonly harms: boolean;
  // The sum of every owner's change.
  readonly heartsGained: number;
  readonly moneyDelta: Cents;
}

function previewOptions(data: ChoiceData, state: RunState, card: CardView): OptionPreview[] {
  return card.options
    .filter((option) => option.availability.enabled)
    .map((option) => {
      const outcome = chooseOption(data, state, card, option.index);
      const debuffsGot = (run: RunState) =>
        Object.values(run.debuffsGot).reduce((sum, count) => sum + count, 0);
      const debuffs = debuffsGot(outcome.state) > debuffsGot(state);
      return {
        choice: option.index,
        cost: option.cost,
        debuffs,
        endangers:
          outcome.fired.length > 0 ||
          outcome.heartChanges.some(
            (change) => change.after < change.before && change.after <= LOW_HEARTS,
          ),
        harms:
          outcome.heartChanges.some(
            (change) => change.after < change.before || heartsForgiven(change) > 0,
          ) || debuffs,
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
const givesDebuff = (preview: OptionPreview) => preview.debuffs;
const givesNoDebuff = (preview: OptionPreview) => !preview.debuffs;

// The free option that keeps the most money, then the most hearts.
function freePick(previews: readonly OptionPreview[]): OptionPreview | undefined {
  return best(previews.filter(isFree), [mostMoney, mostHearts]);
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

// What a policy took, and whether it fell back from its own rule to play as mixed: null for a
// policy with no fallback.
interface PolicyPick {
  readonly fellBack: boolean | null;
  readonly picked: OptionPreview | undefined;
}

// The safe debuff option that keeps the most money, then the most hearts, whenever one is on the
// card; otherwise, falling back, as mixed.
function debuffs(random: Random, previews: readonly OptionPreview[]): PolicyPick {
  const debuff = best(previews.filter(givesDebuff).filter(isSafe), [mostMoney, mostHearts]);
  return debuff === undefined
    ? { fellBack: true, picked: mixed(random, previews) }
    : { fellBack: false, picked: debuff };
}

// As mixed among the hearts and money options, those that give no debuff, while one of them is
// safe; otherwise, falling back, as mixed among every option.
function noDebuffs(random: Random, previews: readonly OptionPreview[]): PolicyPick {
  const others = previews.filter(givesNoDebuff);
  const fellBack = !others.some(isSafe);
  return { fellBack, picked: mixed(random, fellBack ? previews : others) };
}

type Policy = (random: Random, previews: readonly OptionPreview[]) => PolicyPick;

const noFallback = (picked: OptionPreview | undefined): PolicyPick => ({
  fellBack: null,
  picked,
});

const POLICIES: Readonly<Record<PolicyId, Policy>> = {
  alwaysHearts: (_, previews) => noFallback(freePick(previews)),
  alwaysPay: (_, previews) => noFallback(alwaysPay(previews)),
  debuffs,
  heartsUnlessLow: (_, previews) => noFallback(heartsUnlessLow(previews)),
  mixed: (random, previews) => noFallback(mixed(random, previews)),
  noDebuffs,
};

// An encounter card's choice, and whether the policy fell back to take it (null for a policy
// with no fallback). Every policy takes Hall pass's Skip, when offered, in place of a pick that
// costs hearts or a debuff, and keeps it for such a card otherwise. Only the mixed policy, and
// the debuffs and noDebuffs policies when they play as mixed, draw from random.
export function pickCardOption(
  data: ChoiceData,
  random: Random,
  policy: PolicyId,
  state: RunState,
  card: CardView,
): { readonly choice: Choice; readonly fellBack: boolean | null } {
  const { fellBack, picked } = POLICIES[policy](random, previewOptions(data, state, card));
  if (picked === undefined) {
    throw new Error(`${card.title} has no option the ${policy} policy can take`);
  }
  return { choice: card.skip && picked.harms ? "skip" : picked.choice, fellBack };
}

// An encounter card's choice by pickCardOption.
export function chooseCardOption(
  data: ChoiceData,
  random: Random,
  policy: PolicyId,
  state: RunState,
  card: CardView,
): Choice {
  return pickCardOption(data, random, policy, state, card).choice;
}
