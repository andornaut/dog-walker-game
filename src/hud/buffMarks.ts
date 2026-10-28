import type { CharmEffect, DogId, Effect, GameData } from "../data/types";
import { fillLine, fillNames } from "../lib/lines";
import { amountText } from "../rules/causes";
import type { CardView, OptionView } from "../rules/choices";
import { isLarge, packSizeRaise, placeInPack } from "../rules/dogs";
import { largeSpeedText } from "../rules/effectText";
import type { ModifiedSubject, ModifiedValue } from "../rules/modified";
import { standingModified, type StandingRun } from "../rules/standing";
import type { WalkStep } from "../runner/walk";
import type { WalkItem } from "../runner/walkItems";
import { packDogs } from "../state/pack";
import type { ModifierSource } from "../state/runState";
import { effectIconKey, type EffectItem, effectLine, effectName } from "./effectIcons";
import type { MessageLine } from "./messageStrip";
import { RUN_TEXT_FIELDS } from "./runText";
import { stripLine } from "./stripLines";

// What the player sees of a buff changing the game: its charm (the buff's walk bar icon in an
// effect well) on the card, the road and the bar, and the value it made.

type MarkData = Pick<
  GameData,
  "debuffs" | "dogs" | "runText" | "shopGear" | "tuning" | "upgrades" | "walkerPerks" | "walkers"
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

// The value a buff made, as a chip over the road says it: a card option's cost it waived
// ("Free") or a debuff's seconds ("4s"). Null for any other value, such as a tip Big tipper
// raised, whose label by the cash shows the money.
function chipText(data: Pick<GameData, "runText">, value: ModifiedValue): string | null {
  switch (value.subject.kind) {
    case "money":
      return value.before < 0 && value.after === 0 ? data.runText.waivedCost : null;
    case "debuffSeconds":
      return fillNames(data.runText.seconds, { seconds: String(Math.round(value.after)) });
    default:
      return null;
  }
}

// A card option's charm: the item, its name, and what it did to the option (null for an effect
// no charmEffect line names).
export interface CardCharm {
  readonly effect: string | null;
  readonly item: EffectItem;
  readonly name: string;
}

// The value each charm effect changes on a card option.
const CHARM_EFFECT_SUBJECTS: { readonly [E in CharmEffect]: ModifiedSubject["kind"] } = {
  debuffSeconds: "debuffSeconds",
  forgivenHearts: "hearts",
  freeCards: "money",
  skipOption: "skip",
};

function itemEffects(
  data: Pick<GameData, "shopGear" | "upgrades" | "walkerPerks">,
  item: EffectItem,
): readonly Effect[] {
  switch (item.kind) {
    case "gear":
      return data.shopGear[item.gear].effects;
    case "perk":
      return data.walkerPerks[item.perk].effects;
    case "upgrade":
      return data.upgrades[item.upgrade].effects;
    default:
      return item satisfies never;
  }
}

function isCharmEffect(key: string): key is CharmEffect {
  return Object.hasOwn(CHARM_EFFECT_SUBJECTS, key);
}

// The charm effects among item's effects, in its order: a modifier by its stat, any other effect
// by its kind.
export function charmEffects(
  data: Pick<GameData, "shopGear" | "upgrades" | "walkerPerks">,
  item: EffectItem,
): CharmEffect[] {
  return itemEffects(data, item)
    .map((effect) => (effect.kind === "modifier" ? effect.stat : effect.kind))
    .filter(isCharmEffect);
}

// What item did to a value of subject, as its charm says it: the line of its first charm effect
// that changes such a value.
function charmEffectText(
  data: Pick<GameData, "runText" | "shopGear" | "upgrades" | "walkerPerks">,
  item: EffectItem,
  subject: ModifiedSubject["kind"],
): string | null {
  const key = charmEffects(data, item).find((effect) => CHARM_EFFECT_SUBJECTS[effect] === subject);
  return key === undefined ? null : data.runText.card.charmEffect[key];
}

// The charms of values' modifiers, one per item that has one, the first value's effect for an
// item on several, in the order applied.
function cardCharms(
  data: Pick<GameData, "runText" | "shopGear" | "upgrades" | "walkerPerks" | "walkers">,
  values: readonly ModifiedValue[],
): CardCharm[] {
  const charms = values.flatMap((value) =>
    charmsOf(data, value).map((item): CardCharm => ({
      effect: charmEffectText(data, item, value.subject.kind),
      item,
      name: effectName(data, item),
    })),
  );
  const keys = charms.map(({ item }) => effectIconKey(item));
  return charms.filter(({ item }, i) => keys.indexOf(effectIconKey(item)) === i);
}

// What a card shows of the buffs on an option, or on the Skip a buff offers (option
// undefined): the lit charms under the card; the plaque, FREE on a cost a buff waived or on the
// Skip (null leaves the plaque as the option has it); and a loss the walker's perk forgives, the
// hearts it leaves each dog, with the perk's name under them, in place of the effect text where
// that text says only the forgiving.
export interface OptionMarks {
  readonly charms: readonly CardCharm[];
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
    const charms = cardCharms(
      data,
      card.modified.filter(({ subject }) => subject.kind === "skip"),
    );
    return charms.length === 0 ? NO_MARKS : { ...NO_MARKS, charms, plaque: free };
  }
  const charms = cardCharms(data, option.modified);
  const waived = option.modified.some(
    ({ after, before, subject }) => subject.kind === "money" && before < 0 && after === 0,
  );
  const plaque = waived && option.path === undefined ? free : null;
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
type PopAt =
  | { readonly dog: DogId; readonly kind: "dog" }
  | { readonly item: number; readonly kind: "item" }
  | { readonly kind: "pack" }
  | { readonly kind: "walker" };

// One buff's pop over the road at at (index-th of the step's pops there): its charm, and a chip
// of the value it made, if any. Each pop glints the buff's walk bar well. forgiven is a bump the walker's perk forgave, whole or in part,
// whose heart pop turns from loss to gain as the charm shows; reach is a pickup grabbed by
// Long reach, with a dotted line from its dog (the pack's lead when null) to the item.
export interface BuffPop {
  readonly at: PopAt;
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

// A pop of a charm over a place, with no chip, forgiven bump or reach line.
function charmPop(at: PopAt, item: EffectItem): UnplacedPop {
  return { at, chip: null, forgiven: null, item, reach: null };
}

function placeKey(at: PopAt): string {
  return JSON.stringify(at);
}

// Each pop takes the next index at its place.
function stacked(pops: readonly UnplacedPop[]): BuffPop[] {
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
// or the pack. A waived cost's first pop carries a "Free" chip, and a shortened debuff's a chip
// of its new seconds, over the charm; any other money value, such as a tip Big tipper raised,
// has its charm alone, as its label by the cash shows the money.
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
        const plain = charmPop(place, charm);
        const chip = i === 0 ? chipText(data, value) : null;
        switch (value.subject.kind) {
          case "hearts":
            return bump && dog !== null && cause.amount > 0
              ? [{ ...plain, at: { kind: "walker" }, forgiven: { dog, whole: value.after === 0 } }]
              : [plain];
          case "reach":
            return item === null
              ? []
              : [{ ...plain, at: { item: item.id, kind: "item" }, reach: { dog, item: item.id } }];
          case "immune":
            return [{ ...plain, at: item === null ? place : { item: item.id, kind: "item" } }];
          case "money":
          case "debuffSeconds":
            return [{ ...plain, chip }];
          default:
            return [plain];
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

// Good leash's pop over a dog that would have strained toward a squirrel: one per squirrel.
export function leashPops(data: MarkData, run: StandingRun, dogs: readonly DogId[]): BuffPop[] {
  const value = standingModified(data, run).find(({ subject }) => subject.kind === "squirrelPulls");
  if (value === undefined) {
    return [];
  }
  return stacked(
    dogs.flatMap((dog) =>
      charmsOf(data, value).map((charm) => charmPop({ dog, kind: "dog" }, charm)),
    ),
  );
}

// What a walk's start says of its gear and pack: a strip line for each gear that changes it
// from the start, such as Running shoes' agility, led by the gear's icon as its well glints, and
// a line for each large dog.
export function walkStartMarks(
  data: MarkData,
  run: StandingRun,
): { glints: EffectItem[]; lines: MessageLine[] } {
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
        text: stripLine(data, "effectStart", {
          effect: effectLine(data, item),
          name: effectName(data, item),
        }),
      })),
      ...large.map((dog): MessageLine => ({
        icon: "hint",
        text: stripLine(data, "largeDog", {
          dog: data.dogs[dog].name,
          speed: largeSpeedText(data.tuning),
        }),
      })),
    ],
  };
}

// Each source of a dog's extra max hearts as a row of its held card's detail: the lead dog's
// small-pack bonus, and each buff's, such as Lucky collar's.
export function extraHearts(data: MarkData, run: StandingRun, dog: DogId): string[] {
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
