import type { DogId, GameData } from "../data/types";
import { fillLine } from "../lib/lines";
import { capitalize, gearShort } from "../rules/effectText";
import { unlockPrice } from "../rules/shop";
import type { Cents } from "../rules/units";
import type { Owned } from "../save/schema";
import type { ItemLook } from "../ui/interaction";
import { purchases } from "./afford";
import {
  cheapestFirst,
  dogKindText,
  gearByPrice,
  isAffordable,
  type Purchase,
  purchasePrice,
} from "./home";
import { HOME_TEXT_FIELDS, homeLine } from "./homeText";

type ShopData = Pick<GameData, "dogSlots" | "dogs" | "homeText" | "shopGear" | "tuning">;

// The Pet shop's tabs, left to right: dog slots and dogs, then gear.
export type ShopTab = "dogs" | "gear";
export const SHOP_TABS = ["dogs", "gear"] as const satisfies readonly ShopTab[];

// The shop's lists, each under its heading: dog slots and dogs, then gear.
export type ShopList = "dogs" | "gear" | "slots";

// The note right of a list's heading: how many of everything the list sells are owned. Dogs
// count every dog, those owned from the start included.
export function ownedCountNote(data: ShopData, owned: Owned, list: ShopList): string {
  const counts: Record<ShopList, { max: number; owned: number }> = {
    dogs: { max: Object.keys(data.dogs).length, owned: owned.dogs.length },
    gear: { max: Object.keys(data.shopGear).length, owned: owned.gear.length },
    slots: { max: data.dogSlots.length, owned: owned.dogSlots.length },
  };
  const { max, owned: have } = counts[list];
  return fillLine(HOME_TEXT_FIELDS.shop, data.homeText.shop, "ownedCount", {
    max: String(max),
    owned: String(have),
  });
}

// One thing the shop sells, as its row shows it. price is null once owned.
export interface ShopRow {
  readonly id: string;
  readonly line: string;
  readonly name: string;
  readonly price: Cents | null;
  readonly purchase: Purchase;
}

// How a row draws: owned; affordable (isAffordable: the buy plate); or short of the bank. A
// row's price is its own purchase's, the one isAffordable checks.
type ShopRowLook = "affordable" | "owned" | "short";

export function shopRowLook(data: ShopData, owned: Owned, bank: Cents, row: ShopRow): ShopRowLook {
  if (row.price === null) {
    return "owned";
  }
  return isAffordable(data, owned, bank, row.purchase) ? "affordable" : "short";
}

// Everything a row's look sets, the same for dogs, gear and dog slots. Owned shows its art in
// full colour with no badge or plate. A row not owned is a disabled row whose badge and plate
// say whether it can be bought: affordable has its art in full colour, the dollar bill and the
// buy plate; short its art's grey copy, the padlock and the short plate.
export const SHOP_ROW_VIEWS: Readonly<Record<ShopRowLook, ItemLook>> = {
  affordable: { art: "colour", badge: "bill", plate: "buy", state: "disabled" },
  owned: { art: "colour", badge: null, plate: null, state: "normal" },
  short: { art: "grey", badge: "lock", plate: "short", state: "disabled" },
};

// Whether anything in the shop is affordable now: the building then wears the gold outline.
export function shopAffordable(data: ShopData, owned: Owned, bank: Cents): boolean {
  return purchases(data).some((purchase) => isAffordable(data, owned, bank, purchase));
}

// Every gear item, cheapest first (gearByPrice), owned ones in place, each with its effect in a few words.
export function gearRows(data: ShopData, owned: Owned): ShopRow[] {
  return gearByPrice(data).map((gear) => {
    const purchase: Purchase = { gear, kind: "gear" };
    return {
      id: `gear:${gear}`,
      line: gearShort(data, gear),
      name: data.shopGear[gear].name,
      price: purchasePrice(data, owned, purchase),
      purchase,
    };
  });
}

// Every slot in order, numbered from 1, the starting ones included, each owned or for sale on
// its own, bought in any order. Every slot's line is the same: it holds one dog.
export function slotRows(data: ShopData, owned: Owned): ShopRow[] {
  const text = data.homeText;
  return data.dogSlots.map((_, i) => {
    const number = i + 1;
    const purchase: Purchase = { kind: "dogSlot", slot: number };
    return {
      id: `slot:${number}`,
      line: text.shop.slotLine,
      name: homeLine(text, "dogSlotName", { slot: String(number) }),
      price: purchasePrice(data, owned, purchase),
      purchase,
    };
  });
}

// Every dog, cheapest first by list price with ties in data order, owned ones in place as
// gearRows lists gear, each with its size and hearts. A starting dog lists at no cost, so it
// leads. A dog for sale shows its price on the row's plate.
export function dogRows(data: ShopData, owned: Owned): ShopRow[] {
  const dogs = Object.keys(data.dogs) as DogId[];
  return cheapestFirst((dog) => unlockPrice(data.tuning, data.dogs[dog]), dogs).map((dog) => {
    const purchase: Purchase = { dog, kind: "dog" };
    return {
      id: `dog:${dog}`,
      line: capitalize(dogKindText(data, dog)),
      name: data.dogs[dog].name,
      price: purchasePrice(data, owned, purchase),
      purchase,
    };
  });
}

// The row a purchase opens the shop on: its own.
export function shopRowId(purchase: Purchase): string {
  switch (purchase.kind) {
    case "dog":
      return `dog:${purchase.dog}`;
    case "dogSlot":
      return `slot:${purchase.slot}`;
    case "gear":
      return `gear:${purchase.gear}`;
    default:
      return purchase satisfies never;
  }
}

// The tab a purchase is sold on.
export function shopTabOf(purchase: Purchase): ShopTab {
  return purchase.kind === "gear" ? "gear" : "dogs";
}

// The tab the shop opens on: focus's, else the leftmost.
export function shopOpenTab(focus: Purchase | undefined): ShopTab {
  return focus === undefined ? SHOP_TABS[0] : shopTabOf(focus);
}
