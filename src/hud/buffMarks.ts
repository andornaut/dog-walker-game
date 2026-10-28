import type { DogId, GameData } from "../data/types";
import { fillLine, fillNames } from "../lib/lines";
import { amountText } from "../rules/causes";
import type { CardView, OptionView } from "../rules/choices";
import { isLarge, packSizeRaise, placeInPack } from "../rules/dogs";
import { formatDollars, largeSpeedText } from "../rules/effectText";
import type { ModifiedValue } from "../rules/modified";
import { standingModified } from "../rules/standing";
import { cents } from "../rules/units";
import type { WalkItem, WalkStep } from "../runner/walk";
import { packDogs } from "../state/pack";
import type { ModifierSource } from "../state/runState";
import { effectIconKey, type EffectItem, effectLine, effectName } from "./effectIcons";
import type { MessageLine } from "./messageStrip";
import { RUN_TEXT_FIELDS, STRIP_LINE_FIELDS } from "./runText";

// What the player sees of a buff changing the game: its charm (the buff's walk bar icon in an
// effect well) on the card, the road and the bar, and the value it made.

type MarkData = Pick<
  GameData,
  | "debuffs"
  | "dogs"
  | "runText"
  | "shopGear"
  | "tuning"
  | "upgrades"
  | "walkerPerks"
  | "walkers"
  | "world"
>;

// The charm a modifier's source shows: its gear (found for a gear drop), its upgrade or the
// walker's perk. A debuff, a card's own option and a lucky find show none.
function charmItem(data: Pick<GameData, "walkers">, source: ModifierSource): EffectItem | null {
  switch (source.kind) {
    case "gear":
      return source.found === true
        ? { found: true, gear: source.gear, kind: "gear" }
        : { gear: source.gear, kind: "gear" };
    case "upgrade":
      return { kind: "upgrade", upgrade: source.upgrade };
    case "walker":
      return { kind: "perk", perk: data.walkers[source.walker].perk };
    default:
      return null;
  }
}

// The charms of a value's modifiers, one per modifier that has one, in the order applied.
function charmsOf(data: Pick<GameData, "walkers">, value: ModifiedValue): EffectItem[] {
  return value.by.flatMap((cause) => charmItem(data, cause.source) ?? []);
}

function uniqueItems(items: readonly EffectItem[]): EffectItem[] {
  const keys = items.map(effectIconKey);
  return items.filter((item, i) => keys.indexOf(effectIconKey(item)) === i);
}

// A heart change as a chip says it: "−1♥", "+2♥", and "0♥" for none.
function heartsText(hearts: number): string {
  return hearts === 0 ? "0♥" : amountText("hearts", hearts);
}

// The value a buff made, as a chip over the road says it: a money change ("+$2") or a
// debuff's seconds ("4s"). Null for any other value.
function chipText(data: Pick<GameData, "runText">, value: ModifiedValue): string | null {
  switch (value.subject.kind) {
    case "money":
      return amountText("money", value.after);
    case "debuffSeconds":
      return fillNames(data.runText.seconds, { seconds: String(Math.round(value.after)) });
    default:
      return null;
  }
}

// What a card shows of the buffs on an option, or on the Skip a buff offers (option
// undefined): the lit charms on its art window; the plaque, the price a buff waived or cut
// (FREE, or the lowered price), or FREE on the Skip (null leaves the plaque as the option has
// it); and a loss the walker's perk forgives, the hearts it leaves each dog, with the perk's
// name under them, in place of the effect text where that text says only the forgiving.
export interface OptionMarks {
  readonly charms: readonly EffectItem[];
  readonly forgiven: { readonly name: string; readonly rows: readonly string[] } | null;
  readonly plaque: string | null;
}

const NO_MARKS: OptionMarks = { charms: [], forgiven: null, plaque: null };

export function optionMarks(
  data: Pick<GameData, "dogs" | "runText" | "shopGear" | "upgrades" | "walkerPerks" | "walkers">,
  card: Pick<CardView, "modified">,
  option?: OptionView,
): OptionMarks {
  const free = data.runText.card.free;
  if (option === undefined) {
    const skips = card.modified.filter(({ subject }) => subject.kind === "skip");
    const charms = uniqueItems(skips.flatMap((value) => charmsOf(data, value)));
    return charms.length === 0 ? NO_MARKS : { ...NO_MARKS, charms, plaque: free };
  }
  const charms = uniqueItems(option.modified.flatMap((value) => charmsOf(data, value)));
  const waived = option.modified.find(
    ({ after, before, subject }) => subject.kind === "money" && before < 0 && after > before,
  );
  const plaque =
    waived === undefined || option.path !== undefined
      ? null
      : waived.after === 0
        ? free
        : formatDollars(cents(-waived.after));
  return { charms, forgiven: forgivenMarks(data, option), plaque };
}

// The losses an option's text says the walker's perk forgives, when that is all it says.
function forgivenMarks(
  data: Pick<GameData, "dogs" | "runText" | "shopGear" | "upgrades" | "walkerPerks" | "walkers">,
  option: OptionView,
): OptionMarks["forgiven"] {
  const forgiven = option.modified.flatMap((value) =>
    value.subject.kind === "hearts" && value.after > value.before
      ? [{ dog: value.subject.dog, value }]
      : [],
  );
  const said = forgiven.map(({ dog, value }) =>
    fillNames(data.runText.card.heartForgiven, {
      dog: data.dogs[dog].name,
      hearts: String(-value.before),
    }),
  );
  if (forgiven.length === 0 || said.join(", ") !== option.text) {
    return null;
  }
  const items = uniqueItems(forgiven.flatMap(({ value }) => charmsOf(data, value)));
  return {
    name: items.map((item) => effectName(data, item)).join(", "),
    rows: forgiven.map(({ dog, value }) => `${heartsText(value.after)} ${data.dogs[dog].name}`),
  };
}

// Where a pop shows over the road: over a dog, over an item, over the pack's lead, or beside
// the walker's head.
export type PopAt =
  | { readonly dog: DogId; readonly kind: "dog" }
  | { readonly item: number; readonly kind: "item" }
  | { readonly kind: "pack" }
  | { readonly kind: "walker" };

// One buff's pop over the road at at (index-th of the step's pops there): its charm unless
// charm is false, as for a money value, and a chip of the value it made. Each pop glints the
// buff's walk bar well. forgiven is a bump the walker's perk forgave, whole or in part,
// whose heart pop turns from loss to gain as the charm shows; reach is a pickup grabbed by
// Long reach, with a dotted line from its dog (the pack's lead when null) to the item.
export interface BuffPop {
  readonly at: PopAt;
  readonly charm: boolean;
  readonly chip: string | null;
  readonly forgiven: { readonly dog: DogId; readonly whole: boolean } | null;
  readonly index: number;
  readonly item: EffectItem;
  readonly reach: { readonly dog: DogId | null; readonly item: number } | null;
}

// A value a buff changed, where it happened: at a road item, with the dog it happened to.
export interface PoppedValue {
  readonly bump: boolean;
  readonly dog: DogId | null;
  readonly item: WalkItem | null;
  readonly value: ModifiedValue;
}

type UnplacedPop = Omit<BuffPop, "index">;

function placeKey(at: PopAt): string {
  return JSON.stringify(at);
}

// Each pop takes the next index at its place.
export function stacked(pops: readonly UnplacedPop[]): BuffPop[] {
  const counts = new Map<string, number>();
  return pops.map((pop) => {
    const key = placeKey(pop.at);
    const index = counts.get(key) ?? 0;
    counts.set(key, index + 1);
    return { ...pop, index };
  });
}

// One pop per modifier with a charm on each value: a forgiven bump's by the walker's head, a
// pickup grabbed by reach over the item with its dotted line, any other over its dog, its item
// or the pack. A money value, such as a tip Big tipper raised, shows no charm, and its first
// pop carries a chip of the new amount; a shortened debuff's first pop carries a chip of its
// new seconds beside the charm.
export function popsOf(
  data: Pick<GameData, "runText" | "walkers">,
  values: readonly PoppedValue[],
): BuffPop[] {
  return stacked(
    values.flatMap(({ bump, dog, item, value }) => {
      const place: PopAt =
        dog !== null
          ? { dog, kind: "dog" }
          : item !== null
            ? { item: item.id, kind: "item" }
            : { kind: "pack" };
      const charmed = value.by.flatMap((cause) => {
        const charm = charmItem(data, cause.source);
        return charm === null ? [] : [{ cause, charm }];
      });
      return charmed.flatMap(({ cause, charm }, i): UnplacedPop[] => {
        const plain = { charm: true, chip: null, forgiven: null, item: charm, reach: null };
        const chip = i === 0 ? chipText(data, value) : null;
        switch (value.subject.kind) {
          case "hearts":
            return bump && dog !== null && cause.amount > 0
              ? [{ ...plain, at: { kind: "walker" }, forgiven: { dog, whole: value.after === 0 } }]
              : [{ ...plain, at: place }];
          case "reach":
            return item === null
              ? []
              : [{ ...plain, at: { item: item.id, kind: "item" }, reach: { dog, item: item.id } }];
          case "immune":
            return [{ ...plain, at: item === null ? place : { item: item.id, kind: "item" } }];
          case "money":
            return [{ ...plain, at: place, charm: false, chip }];
          case "debuffSeconds":
            return [{ ...plain, at: place, chip }];
          default:
            return [{ ...plain, at: place }];
        }
      });
    }),
  );
}

// A walk step's values a buff changed, with the dog each happened to: a bump's, a treat's
// or a contact's dog.
export function stepValues(
  step: Pick<WalkStep, "bumps" | "contacts" | "modified" | "treats">,
): PoppedValue[] {
  return step.modified.map(({ item, value }) => {
    const bump = step.bumps.find((entry) => entry.item.id === item.id);
    const dog =
      bump?.dog ??
      step.treats.find((entry) => entry.item.id === item.id)?.dog ??
      step.contacts.find((entry) => entry.item.id === item.id)?.dog ??
      null;
    return { bump: bump !== undefined, dog, item, value };
  });
}

// How many tips and treats the walk has collected while a buff scaled their spawns.
export interface SpawnCounts {
  readonly tips: number;
  readonly treats: number;
}

export const NO_SPAWNS: SpawnCounts = { tips: 0, treats: 0 };

// Keen eye's and Rush hour's pops: while a buff scales a pickup's spawns, every second one
// collected pops each scaling buff's charm over it. Returns the pops and the counts after.
export function spawnPops(
  data: MarkData,
  run: Parameters<typeof standingModified>[1],
  collected: readonly WalkItem[],
  counts: SpawnCounts,
): { counts: SpawnCounts; pops: BuffPop[] } {
  const pickups = collected.filter(({ kind }) => kind === "tip" || kind === "treat");
  if (pickups.length === 0) {
    return { counts, pops: [] };
  }
  const scaled = standingModified(data, run);
  const next = { ...counts };
  const pops = pickups.flatMap((item): UnplacedPop[] => {
    const spawn = item.kind === "tip" ? "tips" : "treats";
    const value = scaled.find(
      ({ subject }) => subject.kind === "spawns" && subject.spawn === spawn,
    );
    if (value === undefined) {
      return [];
    }
    next[spawn] += 1;
    if (next[spawn] % 2 !== 0) {
      return [];
    }
    return charmsOf(data, value).map((charm) => ({
      at: { item: item.id, kind: "item" },
      charm: true,
      chip: null,
      forgiven: null,
      item: charm,
      reach: null,
    }));
  });
  return { counts: next, pops: stacked(pops) };
}

// Good leash's pop over a dog that would have strained toward a squirrel: one per squirrel.
export function leashPops(
  data: MarkData,
  run: Parameters<typeof standingModified>[1],
  dogs: readonly DogId[],
): BuffPop[] {
  const value = standingModified(data, run).find(({ subject }) => subject.kind === "squirrelPulls");
  if (value === undefined) {
    return [];
  }
  return stacked(
    dogs.flatMap((dog) =>
      charmsOf(data, value).map((charm): UnplacedPop => ({
        at: { dog, kind: "dog" },
        charm: true,
        chip: null,
        forgiven: null,
        item: charm,
        reach: null,
      })),
    ),
  );
}

// What a walk's start says of its gear and pack: a strip line for each gear that changes it
// from the start, such as Running shoes' agility, led by the gear's icon as its well glints, and
// a line for each large dog.
export function walkStartMarks(
  data: MarkData,
  run: Parameters<typeof standingModified>[1],
): { glints: EffectItem[]; lines: MessageLine[] } {
  const strip = data.runText.strip;
  const values = standingModified(data, run).filter(({ subject }) => subject.kind === "agility");
  const gear = values.flatMap((value) =>
    value.by.flatMap((cause) => {
      const item = charmItem(data, cause.source);
      return item?.kind === "gear" ? [item] : [];
    }),
  );
  const large = packDogs(run).filter((dog) => isLarge(data.dogs[dog]));
  return {
    glints: gear,
    lines: [
      ...gear.map((item): MessageLine => ({
        icon: item,
        text: fillLine(STRIP_LINE_FIELDS, strip, "effectStart", {
          effect: effectLine(data, item),
          name: effectName(data, item),
        }),
      })),
      ...large.map((dog): MessageLine => ({
        icon: "hint",
        text: fillLine(STRIP_LINE_FIELDS, strip, "largeDog", {
          dog: data.dogs[dog].name,
          speed: largeSpeedText(data.tuning),
        }),
      })),
    ],
  };
}

// Each source of a dog's extra max hearts as a row of its held card's detail: the lead dog's
// small-pack bonus, and each buff's, such as Lucky collar's.
export function extraHearts(
  data: MarkData,
  run: Parameters<typeof standingModified>[1],
  dog: DogId,
): string[] {
  const owner = data.dogs[dog].owner.name;
  const line = (name: string, hearts: number) =>
    fillLine(RUN_TEXT_FIELDS.explain, data.runText.explain, "extraHearts", {
      hearts: String(hearts),
      name,
      owner,
    });
  const bonus = packSizeRaise(data.tuning, run.modifiers, placeInPack(run, dog), data.dogs[dog]);
  const value = standingModified(data, run).find(
    ({ subject }) => subject.kind === "maxHearts" && subject.dog === dog,
  );
  const buffs = (value?.by ?? []).flatMap((cause) => {
    const item = charmItem(data, cause.source);
    return item === null || cause.amount <= 0 ? [] : [{ hearts: cause.amount, item }];
  });
  return [
    ...(bonus > 0 ? [line(data.runText.explain.smallPack, bonus)] : []),
    ...buffs.map(({ hearts, item }) => line(effectName(data, item), hearts)),
  ];
}
