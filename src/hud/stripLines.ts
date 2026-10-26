import type { DebuffId, DogId, EncounterId, GameData } from "../data/types";
import { fillLine, fillNames } from "../lib/lines";
import { type Change, type HeartChange, heartsForgiven, type MoneyChange } from "../rules/causes";
import { debuffFields, formatDollars } from "../rules/effectText";
import { bumpHearts } from "../rules/run";
import type { FaceMood } from "../rules/treats";
import { cents } from "../rules/units";
import type { ActiveDebuff, RunState } from "../state/runState";
import { type FaceText, fillFaceLine, ownerFaceText } from "./faceText";
import type { MessageLine } from "./messageStrip";
import { MOMENTS } from "./moments";
import { STRIP_LINE_FIELDS } from "./runText";

// The message strip's lines for what just happened on the road, from the walk's events.

type StripData = Pick<GameData, "dogs" | "minorObstacles" | "runText">;

type StripKey = keyof typeof STRIP_LINE_FIELDS;

function line<K extends StripKey>(
  data: StripData,
  key: K,
  fields: Readonly<Record<(typeof STRIP_LINE_FIELDS)[K][number], string>>,
): string {
  return fillLine(STRIP_LINE_FIELDS, data.runText.strip, key, fields);
}

// The strip's lines that name an owner, each led inline by the owner's face in a mood: upset
// on a heart loss, happy on a gain, neutral otherwise.
export const STRIP_OWNER_MOODS = {
  fired: "upset",
  kindWords: "neutral",
  lowHearts: "upset",
  muddyHearts: "upset",
  plainHit: "upset",
  treat: "happy",
} as const satisfies Partial<Record<StripKey, FaceMood>>;

type OwnerKey = keyof typeof STRIP_OWNER_MOODS;
type OwnerFields<K extends OwnerKey> = Exclude<(typeof STRIP_LINE_FIELDS)[K][number], "owner">;

// The line at key, its {owner} the owner of dog's name led by their face.
function ownerLine<K extends OwnerKey>(
  data: StripData,
  key: K,
  dog: DogId,
  fields: Readonly<Record<OwnerFields<K>, string>>,
): FaceText {
  const owner = ownerFaceText(data, STRIP_OWNER_MOODS[key], dog);
  const all = { ...fields, owner } as Readonly<
    Record<(typeof STRIP_LINE_FIELDS)[K][number], FaceText | string>
  >;
  return fillFaceLine(STRIP_LINE_FIELDS, data.runText.strip, key, all);
}

// A plain obstacle that landed on dog: a dodge, or the hearts its owner lost. obstacle is the
// obstacle's name. A bump that cost nothing, such as one Second chance forgave whole, says nothing:
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
  const hearts = String(change.before - change.after);
  return {
    icon: "bump",
    ...ownerLine(data, "plainHit", bump.dog, { dog, hearts, obstacle: name }),
  };
}

// Each owner whose loss the walker's perk, such as Second chance, forgave, led by the icon of
// the perk that forgave it.
export function forgivenLines(
  data: StripData & Pick<GameData, "walkers">,
  changes: readonly Change[],
): MessageLine[] {
  return changes.flatMap((change): MessageLine[] => {
    if (change.kind !== "hearts" || heartsForgiven(change) <= 0) {
      return [];
    }
    const perk = change.causes.flatMap((cause) =>
      cause.kind === "modifier" && cause.forgives === true && cause.source.kind === "walker"
        ? [data.walkers[cause.source.walker].perk]
        : [],
    )[0];
    const said = ownerLine(data, "kindWords", change.dog, {});
    return [{ icon: perk === undefined ? "hint" : { kind: "perk", perk }, ...said }];
  });
}

// A treat that raised its owner's hearts; one at their max says nothing.
export function treatLine(data: StripData, change: HeartChange | null): MessageLine | null {
  if (change === null || change.after <= change.before) {
    return null;
  }
  const { dog } = change;
  return {
    icon: "treat",
    ...ownerLine(data, "treat", dog, {
      dog: data.dogs[dog].name,
      hearts: String(change.after - change.before),
    }),
  };
}

// Each walking owner a change left on their last heart.
export function lowHeartsLines(data: StripData, changes: readonly Change[]): MessageLine[] {
  return changes.flatMap((change): MessageLine[] =>
    change.kind === "hearts" &&
    change.after === MOMENTS.lowHearts &&
    change.before > MOMENTS.lowHearts
      ? [{ icon: "lastHeart", ...ownerLine(data, "lowHearts", change.dog, {}) }]
      : [],
  );
}

// While the pack is Muddy, each walking owner a change left above their last heart but within
// one bump of firing you: down to the hearts a Muddy bump costs. The last heart has its own line.
export function muddyHeartsLines(
  data: StripData & Pick<GameData, "debuffs" | "tuning">,
  run: Pick<RunState, "debuffs" | "modifiers">,
  changes: readonly Change[],
): MessageLine[] {
  if (!run.debuffs.some(({ debuff }) => debuff === "muddy")) {
    return [];
  }
  const cost = bumpHearts(data, run);
  return changes.flatMap((change): MessageLine[] =>
    change.kind === "hearts" &&
    change.after > MOMENTS.lowHearts &&
    change.after <= cost &&
    change.before > change.after
      ? [
          {
            icon: "lastHeart",
            ...ownerLine(data, "muddyHearts", change.dog, {
              cost: String(cost),
              hearts: String(change.after),
            }),
          },
        ]
      : [],
  );
}

export function firedLine(data: StripData, dog: DogId): MessageLine {
  return { icon: "fired", ...ownerLine(data, "fired", dog, { dog: data.dogs[dog].name }) };
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
  if (encounter === "pettingNeighbor") {
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

// The Pack bonus, from the fees paid at the walk's end; none paid says nothing.
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
  data: StripData & Pick<GameData, "tuning">,
  changes: ReturnType<typeof debuffChanges>,
): MessageLine[] {
  const { debuffEnd, debuffStart } = data.runText.strip;
  return [
    ...changes.started.map(({ debuff, secondsLeft }): MessageLine => ({
      icon: debuff,
      text: fillNames(debuffStart[debuff], debuffFields(data, Math.round(secondsLeft))),
    })),
    ...changes.ended.map((debuff): MessageLine => ({ icon: debuff, text: debuffEnd[debuff] })),
  ];
}
