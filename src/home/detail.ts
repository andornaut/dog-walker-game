import type { DogId, GameData, GearId, WalkerId } from "../data/types";
import { fillLine } from "../lib/lines";
import { sizeHearts } from "../rules/dogs";
import {
  capitalize,
  dodgeInText,
  effectText,
  largeSpeedText,
  SIZE_NAMES,
} from "../rules/effectText";
import type { Cents } from "../rules/units";
import type { Owned } from "../save/schema";
import { dollarText, type HomeLoadout, isAffordable, type Purchase, purchasePrice } from "./home";
import { HOME_TEXT_FIELDS } from "./homeText";
import { walkerDetailLines, walkerLockedLine } from "./walkers";

type DetailData = Pick<
  GameData,
  | "debuffs"
  | "dogSlots"
  | "dogs"
  | "encounters"
  | "homeText"
  | "shopGear"
  | "tuning"
  | "walkerPerks"
  | "walkers"
  | "world"
>;

// What a held dog, walker or gear tile's detail card says, owned or not: a title, a line under
// it, rows of text, and a status row (the fee or price, owned or equipped, or the goal). locked
// is true while the item costs more than the bank holds, or the walker is not owned. A dog's
// card names the dog as owner, for its owner's photo and name.
export interface DetailCard {
  readonly lines: readonly string[];
  readonly locked: boolean;
  readonly owner?: DogId;
  readonly status: string;
  readonly subtitle: string;
  readonly title: string;
}

// What a detail card shows in its well: a dog's or walker's portrait, or a gear item's,
// effect's or debuff's icon.
export interface DetailPicture {
  // Drawn centred in the well at 1x while key has no texture, such as a walker's face before
  // its portrait is drawn.
  readonly fallback?: string;
  readonly key: string;
  // Drawn at this whole-number scale: 1 for a 64x64 portrait, 2 for a 32x32 icon, 4 for a
  // 16x16 icon.
  readonly scale: number;
}

const FIELDS = HOME_TEXT_FIELDS.detail;

// Whether the card shows it locked: for sale, and not affordable now.
function isLocked(data: DetailData, owned: Owned, bank: Cents, purchase: Purchase): boolean {
  return (
    purchasePrice(data, owned, purchase) !== null && !isAffordable(data, owned, bank, purchase)
  );
}

// What buying it would take, or null when it is already owned.
function priceLine(data: DetailData, owned: Owned, bank: Cents, purchase: Purchase): string | null {
  const cost = purchasePrice(data, owned, purchase);
  if (cost === null) {
    return null;
  }
  const key = isAffordable(data, owned, bank, purchase) ? "priceBuy" : "priceLocked";
  return fillLine(FIELDS, data.homeText.detail, key, { price: dollarText(cost) });
}

// A dog's size row: a large dog's lane-change slowdown or a small dog's dodge, and none for a
// medium dog.
function sizeRow(data: DetailData, dog: DogId): readonly string[] {
  const text = data.homeText.detail;
  const { size } = data.dogs[dog];
  switch (size) {
    case "large":
      return [fillLine(FIELDS, text, "dogLarge", { speed: largeSpeedText(data.tuning) })];
    case "medium":
      return [];
    case "small":
      return [
        fillLine(FIELDS, text, "dogSmall", {
          dodgeIn: dodgeInText(data.tuning, "smallDodgeChance"),
        }),
      ];
    default:
      return size satisfies never;
  }
}

// A dog's breed, its size and hearts, its size row, and its owner, whose photo it shows.
export function dogDetail(data: DetailData, owned: Owned, bank: Cents, dog: DogId): DetailCard {
  const { breed, name, owner, size } = data.dogs[dog];
  const purchase: Purchase = { dog, kind: "dog" };
  const text = data.homeText.detail;
  return {
    lines: [
      fillLine(FIELDS, text, "dogKind", {
        hearts: String(sizeHearts(data.tuning, data.dogs[dog])),
        size: capitalize(SIZE_NAMES[size]),
      }),
      ...sizeRow(data, dog),
      fillLine(FIELDS, text, "dogOwner", { owner: owner.name, role: owner.role }),
    ],
    locked: isLocked(data, owned, bank, purchase),
    owner: dog,
    status: priceLine(data, owned, bank, purchase) ?? text.dogStatus,
    subtitle: breed,
    title: name,
  };
}

// A gear item's effect, and whether it is owned or equipped.
export function gearDetail(
  data: DetailData,
  owned: Owned,
  bank: Cents,
  loadout: Pick<HomeLoadout, "gear">,
  gear: GearId,
): DetailCard {
  const item = data.shopGear[gear];
  const purchase: Purchase = { gear, kind: "gear" };
  const text = data.homeText.detail;
  const status = loadout.gear === gear ? text.gearEquipped : text.gearOwned;
  return {
    lines: [`${capitalize(effectText(data, item.effects))}.`],
    locked: isLocked(data, owned, bank, purchase),
    status: priceLine(data, owned, bank, purchase) ?? status,
    subtitle: text.gearSubtitle,
    title: item.name,
  };
}

// A walker's agility and perk lines. An owned walker's status says so; one not owned is
// locked, and its status names the zone whose finish unlocks it.
export function walkerDetail(
  data: DetailData,
  owned: Pick<Owned, "walkers">,
  walker: WalkerId,
): DetailCard {
  const { name } = data.walkers[walker];
  const text = data.homeText;
  const has = owned.walkers.includes(walker);
  return {
    lines: walkerDetailLines(data, walker),
    locked: !has,
    status: has ? text.detail.walkerStatus : walkerLockedLine(data, walker),
    subtitle: text.detail.walkerSubtitle,
    title: name,
  };
}
