import type { DogId } from "../data/types";
import { type CauseData, causeLabel, type Change, changeAmount } from "../rules/causes";
import type { ChoiceOutcome } from "../rules/choices";
import type { Cents } from "../rules/units";

// A floating label naming a change, over the dog's slot or the bank.
export interface ChangeLabel {
  gain: boolean;
  target: { dog: DogId; kind: "dog" } | { kind: "bank" };
  text: string;
}

// One label per change, naming its causes ("−2 ♥, dramatic", "+$1.50 tip, solo"): a heart
// change over its dog's slot, a money change over the bank.
export function changeLabels(data: CauseData, changes: readonly Change[]): ChangeLabel[] {
  return changes.map((change): ChangeLabel => ({
    gain: changeAmount(change) > 0,
    target: change.kind === "hearts" ? { dog: change.dog, kind: "dog" } : { kind: "bank" },
    text: causeLabel(data, change),
  }));
}

// The labels for a choice or an instant encounter: its heart changes, then its money changes.
export function outcomeLabels(
  data: CauseData,
  outcome: Pick<ChoiceOutcome, "heartChanges" | "moneyChanges">,
): ChangeLabel[] {
  return changeLabels(data, [...outcome.heartChanges, ...outcome.moneyChanges]);
}

// Money is counted in cents and shown in whole dollars.
export function wholeDollars(amount: Cents): string {
  return `$${Math.floor(amount / 100)}`;
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

export type PipState = "current" | "done" | "todo";

// One pip per zone of the route; fill is how far through it the walk is, from 0 to 1.
export function zonePips(
  zoneCount: number,
  zoneIndex: number,
  zoneFraction: number,
): { fill: number; state: PipState }[] {
  return Array.from({ length: zoneCount }, (_, i) => {
    if (i < zoneIndex) {
      return { fill: 1, state: "done" };
    }
    if (i > zoneIndex) {
      return { fill: 0, state: "todo" };
    }
    return { fill: Math.min(1, Math.max(0, zoneFraction)), state: "current" };
  });
}
