import type { DogId, GameData } from "../data/types";
import type { Change, MoneyChange } from "../rules/causes";
import { quipLine } from "../rules/choices";
import { type Cents, cents } from "../rules/units";
import type { LastWalk } from "../save/schema";

export type EarningsKind = "cardCosts" | "clawbacks" | "fees" | "luckyFinds" | "start" | "tips";

export interface EarningsLine {
  readonly amount: Cents;
  readonly kind: EarningsKind;
  readonly label: string;
}

const LABELS: Readonly<Record<EarningsKind, string>> = {
  cardCosts: "Card costs",
  clawbacks: "Fees taken back",
  fees: "Fees",
  luckyFinds: "Lucky finds",
  start: "Starting money",
  tips: "Tips",
};

// Fees, tips and card costs always show; the rest only when the run had some.
const ALWAYS_SHOWN: ReadonlySet<EarningsKind> = new Set(["cardCosts", "fees", "tips"]);
const ORDER: readonly EarningsKind[] = [
  "fees",
  "tips",
  "luckyFinds",
  "cardCosts",
  "clawbacks",
  "start",
];

// A money change counts under its base cause: a fee, tip or clawback, or a card or lucky find's
// effect, as a cost or a gain.
function kindOf(change: MoneyChange): EarningsKind {
  const base = change.causes[0];
  switch (base?.kind) {
    case "clawback":
      return "clawbacks";
    case "fee":
      return "fees";
    case "tip":
      return "tips";
    default:
  }
  return change.amount < 0 ? "cardCosts" : "luckyFinds";
}

// What made up a run's earnings, from the changes it made. Money that no change accounts for
// is what the run started with (the fanny pack's), so the lines always add up to earned.
export function earningsBreakdown(changes: readonly Change[], earned: Cents): EarningsLine[] {
  const totals = new Map<EarningsKind, number>();
  let counted = 0;
  for (const change of changes) {
    if (change.kind === "money") {
      const kind = kindOf(change);
      totals.set(kind, (totals.get(kind) ?? 0) + change.amount);
      counted += change.amount;
    }
  }
  totals.set("start", earned - counted);
  return ORDER.flatMap((kind) => {
    const amount = totals.get(kind) ?? 0;
    return amount !== 0 || ALWAYS_SHOWN.has(kind)
      ? [{ amount: cents(amount), kind, label: LABELS[kind] }]
      : [];
  });
}

export type ZonePip = "current" | "done" | "todo";

// One pip per zone of the world: done for each zone finished, current for the zone a run that
// ended early stopped in, todo for the rest.
export function zonePips(
  zoneCount: number,
  walk: Pick<LastWalk, "outcome" | "zonesFinished">,
): ZonePip[] {
  return Array.from({ length: zoneCount }, (_, zone): ZonePip => {
    if (zone < walk.zonesFinished) {
      return "done";
    }
    return zone === walk.zonesFinished && walk.outcome !== "finished" ? "current" : "todo";
  });
}

export interface ClosingLine {
  readonly dog: DogId;
  readonly fired: boolean;
  readonly text: string;
}

// One closing line from each owner, in pack order: the fired line from an owner who fired
// you, a happier line from the rest.
export function closingLines(
  data: Pick<GameData, "quips">,
  random: () => number,
  walk: Pick<LastWalk, "dogs" | "firings">,
): ClosingLine[] {
  return walk.dogs.map((dog) => {
    const fired = walk.firings.some((firing) => firing.dog === dog);
    return {
      dog,
      fired,
      text: quipLine(data, random, { dog, moment: fired ? "fired" : "happier" }),
    };
  });
}
