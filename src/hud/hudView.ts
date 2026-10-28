import { zonePipTag } from "../assets/spriteKeys";
import type { DebuffId, DogId, GameData, ZoneId } from "../data/types";
import type { Point } from "../lib/rect";
import { type CauseData, causeLabel, causeName, type Change, changeAmount } from "../rules/causes";
import { zoneById } from "../rules/route";

// A floating label naming a change: over the dog's slot (dog), from where money changed hands
// to the bank (bank), or, for a tip, from by the cash total into it (cash), with the names of
// what changed the tip (others), such as "Big tipper". amount is the change in hearts or cents.
// zeroedBy: the debuff that cancelled a change to nothing, as Stinky zeroes a tip, in whose
// colour the label is drawn.
export interface ChangeLabel {
  amount: number;
  gain: boolean;
  target:
    | { dog: DogId; kind: "dog" }
    | { from: Point; kind: "bank" }
    | { kind: "cash"; others: readonly string[] };
  text: string;
  zeroedBy?: DebuffId;
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

// Where a change's label goes: a heart change to its dog's slot, a tip, a Stinky "+$0" one
// included, by the cash total, so the many tips stay out of the road, and any other money
// change from from, where it changed hands, to the bank.
function labelTarget(data: CauseData, from: Point, change: Change): ChangeLabel["target"] {
  if (change.kind === "hearts") {
    return { dog: change.dog, kind: "dog" };
  }
  if (!change.causes.some((cause) => cause.kind === "tip")) {
    return { from, kind: "bank" };
  }
  const others = change.causes.flatMap((cause) =>
    cause.kind === "tip" ? [] : [causeName(data, change, cause)],
  );
  return { kind: "cash", others };
}

// One label per change, naming its causes ("−2 ♥, dramatic", "+$2 tip, Big tipper"), at its
// labelTarget. A heart change that nets nothing, a loss forgiven whole, has none: its forgiven
// moment shows it.
export function changeLabels(
  data: CauseData,
  from: Point,
  changes: readonly Change[],
): ChangeLabel[] {
  const shown = changes.filter((change) => change.kind === "money" || changeAmount(change) !== 0);
  return shown.map((change): ChangeLabel => {
    const zeroedBy = zeroingDebuff(change);
    return {
      amount: changeAmount(change),
      gain: changeAmount(change) > 0,
      target: labelTarget(data, from, change),
      text: causeLabel(data, change),
      ...(zeroedBy === undefined ? {} : { zeroedBy }),
    };
  });
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
