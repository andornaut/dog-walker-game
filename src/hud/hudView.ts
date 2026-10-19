import type { DogId } from "../data/types";
import type { ChoiceOutcome } from "../rules/choices";
import { formatDollars } from "../rules/effectText";
import type { Cents } from "../rules/units";

// A floating label naming a change, over the dog's slot or the bank.
export interface ChangeLabel {
  gain: boolean;
  target: { dog: DogId; kind: "dog" } | { kind: "bank" };
  text: string;
}

const signed = (value: number, text: string) => `${value < 0 ? "−" : "+"}${text}`;

// One label per heart change and one for the money. Plain amounts for now; each label
// gains its cause ("−2 ♥, dramatic") when the outcome events carry causes.
export function changeLabels(
  outcome: Pick<ChoiceOutcome, "heartChanges" | "moneyDelta">,
): ChangeLabel[] {
  const hearts = outcome.heartChanges.map(({ after, before, dog }): ChangeLabel => ({
    gain: after > before,
    target: { dog, kind: "dog" },
    text: signed(after - before, `${Math.abs(after - before)} ♥`),
  }));
  const money: ChangeLabel[] =
    outcome.moneyDelta === 0
      ? []
      : [
          {
            gain: outcome.moneyDelta > 0,
            target: { kind: "bank" },
            text: signed(outcome.moneyDelta, formatDollars(outcome.moneyDelta)),
          },
        ];
  return [...hearts, ...money];
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
