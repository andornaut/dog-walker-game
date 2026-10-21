import type { DebuffId, DogId, EncounterId, GameData } from "../data/types";
import { type Change, type HeartChange, heartsForgiven, type MoneyChange } from "../rules/causes";
import { formatDollars } from "../rules/effectText";
import { cents } from "../rules/units";
import type { ActiveDebuff, RunState } from "../state/runState";
import { fillLine, fillNames } from "../text/lines";
import type { MessageLine } from "./messageStrip";
import { STRIP_LINE_FIELDS } from "./runText";

// The message strip's lines for what just happened on the road, from the walk's events.

export type StripData = Pick<GameData, "dogs" | "minorObstacles" | "runText">;

type StripKey = keyof typeof STRIP_LINE_FIELDS;

function line<K extends StripKey>(
  data: StripData,
  key: K,
  fields: Readonly<Record<(typeof STRIP_LINE_FIELDS)[K][number], string>>,
): string {
  return fillLine(STRIP_LINE_FIELDS, data.runText.strip, key, fields);
}

const ownerOf = (data: StripData, dog: DogId) => data.dogs[dog].owner.name;

// A plain obstacle that landed on dog: a dodge, or the hearts its owner lost. obstacle is the
// obstacle's name. A bump that cost nothing, such as one Kind words forgave whole, says nothing:
// forgivenLines says the forgiving.
export function bumpLine(
  data: StripData,
  bump: { readonly change: HeartChange | null; readonly dodged: boolean; readonly dog: DogId },
  obstacle: string,
): MessageLine | null {
  const dog = data.dogs[bump.dog].name;
  const name = obstacle.toLowerCase();
  if (bump.dodged) {
    return { icon: "bump", text: line(data, "dodge", { dog, obstacle: name }) };
  }
  const { change } = bump;
  if (change === null || change.after === change.before) {
    return null;
  }
  const owner = ownerOf(data, bump.dog);
  const hearts = String(change.before - change.after);
  return {
    icon: "bump",
    text: line(data, "plainHit", { dog, hearts, obstacle: name, owner }),
  };
}

// Each owner whose loss the walker's perk, such as Kind words, forgave.
export function forgivenLines(data: StripData, changes: readonly Change[]): MessageLine[] {
  return changes.flatMap((change): MessageLine[] =>
    change.kind === "hearts" && heartsForgiven(change) > 0
      ? [{ icon: "hint", text: line(data, "kindWords", { owner: ownerOf(data, change.dog) }) }]
      : [],
  );
}

// A treat that raised its owner's hearts; one at their max says nothing.
export function treatLine(data: StripData, change: HeartChange | null): MessageLine | null {
  if (change === null || change.after <= change.before) {
    return null;
  }
  const { dog } = change;
  return {
    icon: "treat",
    text: line(data, "treat", {
      dog: data.dogs[dog].name,
      hearts: String(change.after - change.before),
      owner: ownerOf(data, dog),
    }),
  };
}

// Each walking owner a change left on their last heart.
export function lowHeartsLines(data: StripData, changes: readonly Change[]): MessageLine[] {
  return changes.flatMap((change): MessageLine[] =>
    change.kind === "hearts" && change.after === 1 && change.before > 1
      ? [{ icon: "lastHeart", text: line(data, "lowHearts", { owner: ownerOf(data, change.dog) }) }]
      : [],
  );
}

export function firedLine(data: StripData, dog: DogId): MessageLine {
  const fields = { dog: data.dogs[dog].name, owner: ownerOf(data, dog) };
  return { icon: "fired", text: line(data, "fired", fields) };
}

// A dog that started straining toward a squirrel. A pull the player steers away from is quiet.
export function pullLine(data: StripData, dog: DogId): MessageLine {
  return { icon: "pull", text: line(data, "pull", { dog: data.dogs[dog].name }) };
}

// A lucky find's line, with the money it found; a find with no line of its own says nothing.
export function luckyLine(
  data: StripData,
  encounter: EncounterId,
  money: readonly MoneyChange[],
): MessageLine | null {
  if (encounter === "biscuitNeighbour") {
    return { icon: "lucky", text: data.runText.strip.luckyNeighbor };
  }
  if (encounter === "lostWallet") {
    const amount = money.reduce((sum, change) => sum + change.amount, 0);
    return {
      icon: "lucky",
      text: line(data, "luckyWallet", { amount: formatDollars(cents(amount)) }),
    };
  }
  return null;
}

// The Full pack bonus, from the fees paid at the walk's end; none paid says nothing.
export function fullPackLine(data: StripData, fees: readonly MoneyChange[]): MessageLine | null {
  const bonus = fees.find((fee) => fee.causes.some((cause) => cause.kind === "bonus"));
  return bonus === undefined
    ? null
    : {
        icon: "lucky",
        text: line(data, "fullPackHome", { amount: formatDollars(bonus.amount) }),
      };
}

// The debuffs that started (or restarted) and ended between two run states.
export function debuffChanges(
  before: Pick<RunState, "debuffs">,
  after: Pick<RunState, "debuffs">,
): { readonly ended: DebuffId[]; readonly started: ActiveDebuff[] } {
  const was = new Map(before.debuffs.map((active) => [active.debuff, active.secondsLeft]));
  const started = after.debuffs.filter((active) => {
    const left = was.get(active.debuff);
    return left === undefined || active.secondsLeft > left;
  });
  const now = new Set(after.debuffs.map(({ debuff }) => debuff));
  const ended = before.debuffs.flatMap(({ debuff }) => (now.has(debuff) ? [] : [debuff]));
  return { ended, started };
}

// A debuff's start, with how long it lasts in whole seconds, or its end.
export function debuffLines(
  data: StripData,
  changes: ReturnType<typeof debuffChanges>,
): MessageLine[] {
  const { debuffEnd, debuffStart } = data.runText.strip;
  return [
    ...changes.started.map(({ debuff, secondsLeft }): MessageLine => ({
      icon: debuff,
      text: fillNames(debuffStart[debuff], { seconds: String(Math.round(secondsLeft)) }),
    })),
    ...changes.ended.map((debuff): MessageLine => ({ icon: debuff, text: debuffEnd[debuff] })),
  ];
}
