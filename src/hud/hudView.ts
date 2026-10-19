import { zonePipTag } from "../assets/spriteKeys";
import type { DogId, GameData, ZoneId } from "../data/types";
import { type CauseData, causeLabel, causeNames, type Change, changeAmount } from "../rules/causes";
import { zoneById } from "../rules/route";
import type { Cents } from "../rules/units";

// A floating label naming a change, over the dog's slot or the bank. amount is the change in
// hearts or cents, and cause its causes' names without the amount.
export interface ChangeLabel {
  amount: number;
  cause: string;
  gain: boolean;
  target: { dog: DogId; kind: "dog" } | { kind: "bank" };
  text: string;
}

// One label per change, naming its causes ("−2 ♥, dramatic", "+$1.50 tip, solo"): a heart
// change over its dog's slot, a money change over the bank.
export function changeLabels(data: CauseData, changes: readonly Change[]): ChangeLabel[] {
  return changes.map((change): ChangeLabel => ({
    amount: changeAmount(change),
    cause: causeNames(data, change).join(", "),
    gain: changeAmount(change) > 0,
    target: change.kind === "hearts" ? { dog: change.dog, kind: "dog" } : { kind: "bank" },
    text: causeLabel(data, change),
  }));
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

// One pip per zone of the walk; fill is how far through it the walk is, from 0 to 1. zone is
// the zone the route has at the pip's position, or null for a fork not yet taken.
export interface ZonePip {
  readonly fill: number;
  readonly state: PipState;
  readonly zone: ZoneId | null;
}

// What a pip draws: its ui-zone-pips tag, and the colour its well fills with as the current
// zone goes by, the zone's road colour. A pip with no zone yet has no well colour.
export interface PipLook {
  readonly tag: string;
  readonly wellColor: string | null;
}

export function pipLook(data: Pick<GameData, "world">, pip: ZonePip): PipLook {
  const zone = pip.state === "todo" || pip.zone === null ? null : zoneById(data, pip.zone);
  return { tag: zonePipTag(zone, pip.state === "done"), wellColor: zone?.roadColor ?? null };
}

// The walk's pips: the zones walked, the current one part filled, then one unknown pip per
// fork still ahead.
export function zonePips(
  walkLength: number,
  route: readonly ZoneId[],
  zoneIndex: number,
  zoneFraction: number,
): ZonePip[] {
  return Array.from({ length: walkLength }, (_, i): ZonePip => {
    const zone = route[i] ?? null;
    if (i < zoneIndex) {
      return { fill: 1, state: "done", zone };
    }
    if (i > zoneIndex || zone === null) {
      return { fill: 0, state: "todo", zone };
    }
    return { fill: Math.min(1, Math.max(0, zoneFraction)), state: "current", zone };
  });
}
