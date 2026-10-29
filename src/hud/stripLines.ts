import type { DebuffId, DogId, EncounterId, GameData, GearId } from "../data/types";
import { fillLine, fillNames } from "../lib/lines";
import { type Change, type HeartChange, heartsForgiven, type MoneyChange } from "../rules/causes";
import { debuffFields, formatDollars } from "../rules/effectText";
import { spareTreatGiver, spareTreatSource } from "../rules/spareTreats";
import type { FaceMood, TreatGrabbed } from "../rules/treats";
import { read } from "../rules/units";
import type { ActiveDebuff, EffectSource, RunState } from "../state/runState";
import { debuffNameMarks } from "./effectNames";
import { type FaceText, fillFaceLine, ownerFaceText } from "./faceText";
import type { MessageIcon, MessageLine } from "./messageStrip";
import { STRIP_LINE_FIELDS } from "./runText";

// The message strip's lines for what just happened on the road, from the walk's events.

type StripData = Pick<GameData, "dogs" | "minorObstacles" | "runText">;

type StripKey = keyof typeof STRIP_LINE_FIELDS;

// The strip's line at key, filled with fields.
export function stripLine<K extends StripKey>(
  data: Pick<GameData, "runText">,
  key: K,
  fields: Readonly<Record<(typeof STRIP_LINE_FIELDS)[K][number], string>>,
): string {
  return fillLine(STRIP_LINE_FIELDS, data.runText.strip, key, fields);
}

// The strip's lines that name an owner, each led inline by the owner's face in a mood: upset
// on a heart loss, happy on a gain, neutral otherwise.
export const STRIP_OWNER_MOODS = {
  fired: "upset",
  plainHit: "upset",
  secondChance: "neutral",
  spareTreatUsed: "happy",
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
    return [{ icon: "bump", text: stripLine(data, "dodge", { dog, obstacle: name }) }];
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
            text: stripLine(data, "cashHit", {}),
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

// What leads a spare treat's line: the icon of the gear that holds it, such as the Fanny pack.
function spareTreatIcon(source: EffectSource | undefined): MessageIcon {
  return source?.kind === "gear" ? source : "treat";
}

// A treat grabbed at every owner's max, held as a spare treat by run's gear.
export function spareTreatSavedLine(
  data: Pick<GameData, "runText">,
  run: Pick<RunState, "modifiers">,
): MessageLine {
  return {
    icon: spareTreatIcon(spareTreatSource(run)),
    text: stripLine(data, "spareTreatSaved", {}),
  };
}

// A treat grabbed's line: the owner it cheered (treatLine), or with every owner at their max, the
// spare treat run's gear held or the cash it paid, whose label shows the amount.
export function treatGrabLine(
  data: StripData,
  grab: Pick<TreatGrabbed, "cash" | "change" | "stored">,
  run: Pick<RunState, "modifiers">,
): MessageLine | null {
  if (grab.stored) {
    return spareTreatSavedLine(data, run);
  }
  if (grab.cash !== null) {
    return { icon: "treat", text: stripLine(data, "treatCash", {}) };
  }
  return treatLine(data, grab.change);
}

// A spare treat given back to the owner who just lost a heart, who keeps it.
export function spareTreatUsedLine(data: StripData, change: HeartChange): MessageLine {
  return {
    icon: spareTreatIcon(spareTreatGiver(change)),
    ...ownerLine(data, "spareTreatUsed", change.dog, {}),
  };
}

// An owner who fired you, which waits its turn on the strip however long it takes.
export function firedLine(data: StripData, dog: DogId): MessageLine {
  return {
    icon: "fired",
    keepsWaiting: true,
    ...ownerLine(data, "fired", dog, { dog: data.dogs[dog].name }),
  };
}

// A dog that started straining toward a squirrel. A pull the player steers away from is quiet.
export function pullLine(data: StripData, dog: DogId): MessageLine {
  return { icon: "pull", text: stripLine(data, "pull", { dog: data.dogs[dog].name }) };
}

type LuckyData = StripData & Pick<GameData, "encounters" | "tuning">;

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

// A lucky find's line: the hearts the friendly neighbour shares, whose owners' gains their heart
// pops show, or the wallet found, whose money its label shows. A find with no line of its own
// says nothing.
export function luckyLine(data: LuckyData, encounter: EncounterId): MessageLine | null {
  if (encounter === "friendlyNeighbour") {
    const hearts = String(sharedTotal(data, encounter));
    return { icon: "lucky", text: stripLine(data, "luckyNeighbour", { hearts }) };
  }
  if (encounter === "lostWallet") {
    return { icon: "lucky", text: stripLine(data, "luckyWallet", {}) };
  }
  return null;
}

// A gear drop grabbed, led by its gear's icon: gearFound, or gearSwapped naming the found item
// it replaced.
export function gearFoundLine(
  data: Pick<GameData, "runText" | "shopGear">,
  gear: GearId,
  replaced: GearId | null,
): MessageLine {
  const name = data.shopGear[gear].name;
  return {
    icon: { found: true, gear, kind: "gear" },
    text:
      replaced === null
        ? stripLine(data, "gearFound", { gear: name })
        : stripLine(data, "gearSwapped", {
            gear: name,
            old: data.shopGear[replaced].name,
          }),
  };
}

// The Walk bonus, from the fees paid at the walk's end; none paid says nothing.
export function fullPackLine(data: StripData, fees: readonly MoneyChange[]): MessageLine | null {
  const bonus = fees.find((fee) => fee.causes.some((cause) => cause.kind === "bonus"));
  return bonus === undefined
    ? null
    : {
        icon: "lucky",
        text: stripLine(data, "fullPackHome", { amount: formatDollars(bonus.amount) }),
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

// A debuff's start, with how long it lasts in whole seconds, the debuff's name in it ("Stinky
// pack!") marked for its pill; or its end.
export function debuffLines(
  data: StripData & Pick<GameData, "debuffs" | "tuning">,
  changes: ReturnType<typeof debuffChanges>,
): MessageLine[] {
  const { debuffEnd, debuffStart } = data.runText.strip;
  return [
    ...changes.started.map(({ debuff, secondsLeft }): MessageLine => {
      const fields = debuffFields(data, debuff, Math.round(secondsLeft));
      const text = fillNames(debuffStart[debuff], fields);
      return { icon: debuff, names: debuffNameMarks(data, debuff, text), text };
    }),
    ...changes.ended.map((debuff): MessageLine => ({ icon: debuff, text: debuffEnd[debuff] })),
  ];
}
