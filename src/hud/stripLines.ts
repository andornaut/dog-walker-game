import type { DebuffId, DogId, EncounterId, GameData } from "../data/types";
import { fillLine, fillNames, sentences } from "../lib/lines";
import { type Change, type HeartChange, heartsForgiven, type MoneyChange } from "../rules/causes";
import { debuffFields, formatDollars } from "../rules/effectText";
import type { FaceMood } from "../rules/treats";
import { cents, read } from "../rules/units";
import type { ActiveDebuff, RunState } from "../state/runState";
import { faceSentenceList, type FaceText, fillFaceLine, ownerFaceText } from "./faceText";
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
  lowHearts: "upset",
  luckyNeighbourGain: "happy",
  plainHit: "upset",
  secondChance: "neutral",
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

// The lines for a plain obstacle that landed on dog: a dodge; or the hearts its owner lost, then
// the cash it also cost while a debuff such as Spotlight makes bumps cost cash. obstacle is the
// obstacle's name. Hearts that cost nothing, such as a loss Second chance forgave whole, say
// nothing: forgivenLines says the forgiving.
export function bumpLines(
  data: StripData,
  bump: {
    readonly cash: MoneyChange | null;
    readonly change: HeartChange | null;
    readonly dodged: boolean;
    readonly dog: DogId;
  },
  obstacle: string,
): MessageLine[] {
  const dog = data.dogs[bump.dog].name;
  const name = obstacle.toLowerCase();
  if (bump.dodged) {
    return [{ icon: "bump", text: line(data, "dodge", { dog, obstacle: name }) }];
  }
  const { cash, change } = bump;
  const hearts: MessageLine[] =
    change === null || change.after === change.before
      ? []
      : [
          {
            icon: "bump",
            ...ownerLine(data, "plainHit", bump.dog, {
              dog,
              hearts: String(change.before - change.after),
              obstacle: name,
            }),
          },
        ];
  const paid: MessageLine[] =
    cash === null
      ? []
      : [
          {
            icon: "bump",
            text: line(data, "cashHit", { amount: formatDollars(cents(-cash.amount)) }),
          },
        ];
  return [...hearts, ...paid];
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
    const said = ownerLine(data, "secondChance", change.dog, {});
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

export function firedLine(data: StripData, dog: DogId): MessageLine {
  return { icon: "fired", ...ownerLine(data, "fired", dog, { dog: data.dogs[dog].name }) };
}

// A dog that started straining toward a squirrel. A pull the player steers away from is quiet.
export function pullLine(data: StripData, dog: DogId): MessageLine {
  return { icon: "pull", text: line(data, "pull", { dog: data.dogs[dog].name }) };
}

type LuckyData = StripData & Pick<GameData, "encounters" | "homeText" | "tuning">;

// The hearts an encounter's effects share by the pack, in all.
function sharedTotal(
  data: Pick<GameData, "encounters" | "tuning">,
  encounter: EncounterId,
): number {
  const { resolution } = data.encounters[encounter];
  const effects = resolution.kind === "instant" ? resolution.effects : [];
  return effects.reduce(
    (total, effect) =>
      effect.kind === "sharedHearts" ? total + read(data.tuning, "hearts", effect.amount) : total,
    0,
  );
}

// Each owner's gain in changes, as luckyNeighbourGain says it, joined as a sentence lists them
// in the changes' order.
function gainsText(data: LuckyData, changes: readonly Change[]): FaceText {
  return faceSentenceList(
    data.homeText.sentenceList,
    changes.flatMap((change) =>
      change.kind === "hearts" && change.after > change.before
        ? [
            ownerLine(data, "luckyNeighbourGain", change.dog, {
              dog: data.dogs[change.dog].name,
              hearts: String(change.after - change.before),
            }),
          ]
        : [],
    ),
  );
}

// A lucky find's line, from the changes it made: the hearts the friendly neighbour shares and
// each owner's gain, or the money a wallet held. A find with no line of its own says nothing.
export function luckyLine(
  data: LuckyData,
  encounter: EncounterId,
  changes: readonly Change[],
): MessageLine | null {
  if (encounter === "pettingNeighbour") {
    const hearts = String(sharedTotal(data, encounter));
    const gains = gainsText(data, changes);
    return {
      icon: "lucky",
      ...fillFaceLine(STRIP_LINE_FIELDS, data.runText.strip, "luckyNeighbour", { gains, hearts }),
    };
  }
  if (encounter === "lostWallet") {
    const amount = changes.reduce(
      (sum, change) => (change.kind === "money" ? sum + change.amount : sum),
      0,
    );
    return {
      icon: "lucky",
      text: line(data, "luckyWallet", { amount: formatDollars(cents(amount)) }),
    };
  }
  return null;
}

// The Walk bonus, from the fees paid at the walk's end; none paid says nothing.
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

// A debuff's start, with how long it lasts in whole seconds, its lead sentence, which names the
// debuff ("Stinky pack!"), set apart in the debuff's colour; or its end.
export function debuffLines(
  data: StripData & Pick<GameData, "debuffs" | "tuning">,
  changes: ReturnType<typeof debuffChanges>,
): MessageLine[] {
  const { debuffEnd, debuffStart } = data.runText.strip;
  return [
    ...changes.started.map(({ debuff, secondsLeft }): MessageLine => {
      const text = fillNames(
        debuffStart[debuff],
        debuffFields(data, debuff, Math.round(secondsLeft)),
      );
      const lead = sentences(text)[0] ?? "";
      return { icon: debuff, names: [{ at: 0, kind: debuff, length: lead.length }], text };
    }),
    ...changes.ended.map((debuff): MessageLine => ({ icon: debuff, text: debuffEnd[debuff] })),
  ];
}
