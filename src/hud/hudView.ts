import { zonePipTag } from "../assets/spriteKeys";
import type { DebuffId, DogId, GameData, ZoneId } from "../data/types";
import type { Point } from "../lib/rect";
import { amountText, type Change, changeAmount, type MoneyChange } from "../rules/causes";
import { zoneById } from "../rules/route";

// A floating label for a change: over the dog's slot (dog), from where money changed hands to
// the bank (bank), or, for a money gain, from by the cash total into it (cash), tip marking a
// tip's, which adds up with the tip showing. amount is the change in hearts or cents. zeroedBy:
// the debuff that cancelled a change to nothing, as Stinky zeroes a tip, so its label never adds
// up with a paying tip's. reachIcon: the 16x16 icon of the buff that grabbed the change's pickup
// by reach, such as Long reach's, which its chip shows at its left (reachChipPlace).
export interface ChangeLabel {
  amount: number;
  gain: boolean;
  reachIcon?: string;
  target:
    { dog: DogId; kind: "dog" } | { from: Point; kind: "bank" } | { kind: "cash"; tip: boolean };
  text: string;
  zeroedBy?: DebuffId;
}

// labels for a pickup grabbed by reach, each carrying icon, the reaching buff's; labels as they
// are with no icon, a pickup the pack touched.
export function reachedLabels(
  icon: string | undefined,
  labels: readonly ChangeLabel[],
): ChangeLabel[] {
  return icon === undefined ? [...labels] : labels.map((label) => ({ ...label, reachIcon: icon }));
}

// The debuff among a change's causes when the change came to nothing, or undefined.
function zeroingDebuff(change: Change): DebuffId | undefined {
  if (changeAmount(change) !== 0) {
    return undefined;
  }
  return change.causes.flatMap((cause) =>
    cause.kind === "modifier" && cause.source.kind === "debuff" ? [cause.source.debuff] : [],
  )[0];
}

// Where a change's label goes: a heart change to its dog's slot; a money gain, and a tip, a
// Stinky "+$0" one included, by the cash total, so no gain's label covers the road; and a money
// loss, or another change that came to nothing, from from, where it changed hands, to the bank.
function labelTarget(from: Point, change: Change): ChangeLabel["target"] {
  if (change.kind === "hearts") {
    return { dog: change.dog, kind: "dog" };
  }
  const tip = change.causes.some((cause) => cause.kind === "tip");
  return tip || change.amount > 0 ? { kind: "cash", tip } : { from, kind: "bank" };
}

// One label per change at its labelTarget, its amount alone: "−1♥", "+$2", a Stinky tip's
// "+$0". The message strip says what caused it. A heart change that nets nothing, a loss
// forgiven whole, has none: its forgiven moment shows it.
export function changeLabels(from: Point, changes: readonly Change[]): ChangeLabel[] {
  const shown = changes.filter((change) => change.kind === "money" || changeAmount(change) !== 0);
  return shown.map((change): ChangeLabel => {
    const zeroedBy = zeroingDebuff(change);
    return {
      amount: changeAmount(change),
      gain: changeAmount(change) > 0,
      target: labelTarget(from, change),
      text: amountText(change.kind, changeAmount(change)),
      ...(zeroedBy === undefined ? {} : { zeroedBy }),
    };
  });
}

// One label for money paid together, such as a zone's fees and the Walk bonus: their total, by
// the cash; null when they pay nothing.
export function totalLabel(changes: readonly MoneyChange[]): ChangeLabel | null {
  const amount = changes.reduce((sum, change) => sum + change.amount, 0);
  return amount <= 0
    ? null
    : {
        amount,
        gain: true,
        target: { kind: "cash", tip: false },
        text: amountText("money", amount),
      };
}

// A meter of max hearts, the first `hearts` of them full, in rows of at most perRow.
export function heartRows(perRow: number, hearts: number, max: number): boolean[][] {
  const rows: boolean[][] = [];
  for (let i = 0; i < max; i++) {
    if (i % perRow === 0) {
      rows.push([]);
    }
    rows.at(-1)?.push(i < hearts);
  }
  return rows;
}

// A zone pip's state: done, the current zone, or still to come.
export type PipState = "current" | "done" | "todo";

// A pip's ui-zone-pips tag: its zone's art, done or not, or the todo tag for a pip still to
// come or a fork not yet taken.
export function pipTag(
  data: Pick<GameData, "world">,
  pip: { readonly state: PipState; readonly zone: ZoneId | null },
): string {
  const zone = pip.state === "todo" || pip.zone === null ? null : zoneById(data, pip.zone);
  return zonePipTag(zone, pip.state === "done");
}
