import { zonePipTag } from "../assets/spriteKeys";
import type { DogId, GameData, ZoneId } from "../data/types";
import { type CauseData, causeLabel, type Change, changeAmount } from "../rules/causes";
import { zoneById } from "../rules/route";

// A floating label naming a change, over the dog's slot or the bank. amount is the change in
// hearts or cents.
export interface ChangeLabel {
  amount: number;
  gain: boolean;
  target: { dog: DogId; kind: "dog" } | { kind: "bank" };
  text: string;
}

// One label per change, naming its causes ("−2 ♥, dramatic", "+$2 tip, Big tipper"): a heart
// change over its dog's slot, a money change over the bank. A heart change that nets nothing,
// a loss forgiven whole, has none: its forgiven moment shows it.
export function changeLabels(data: CauseData, changes: readonly Change[]): ChangeLabel[] {
  const shown = changes.filter((change) => change.kind === "money" || changeAmount(change) !== 0);
  return shown.map((change): ChangeLabel => ({
    amount: changeAmount(change),
    gain: changeAmount(change) > 0,
    target: change.kind === "hearts" ? { dog: change.dog, kind: "dog" } : { kind: "bank" },
    text: causeLabel(data, change),
  }));
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
