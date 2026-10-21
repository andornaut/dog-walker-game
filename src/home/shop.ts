import type { DogId, GameData, GearId } from "../data/types";
import { capitalize } from "../rules/effectText";
import { startingDogSlots, unlockPrice } from "../rules/shop";
import type { Cents } from "../rules/units";
import type { Owned } from "../save/schema";
import { fillLine } from "../text/lines";
import { isAffordable, purchases } from "./afford";
import { dogKindText, type Purchase, purchasePrice } from "./home";
import { HOME_TEXT_FIELDS, homeLine } from "./homeText";
import type { ItemLook } from "./interaction";

type ShopData = Pick<GameData, "dogSlots" | "dogs" | "homeText" | "shopGear" | "tuning">;

// The Pet shop's tabs, left to right: gear, then dog slots and dogs.
export type ShopTab = "dogs" | "gear";
export const SHOP_TABS: readonly ShopTab[] = ["gear", "dogs"];

// One thing the shop sells, as its row shows it. price is null once owned. blocked is why it
// cannot be bought yet (a slot needs the one before it), or null.
export interface ShopRow {
  readonly blocked: string | null;
  readonly id: string;
  readonly line: string;
  readonly name: string;
  readonly price: Cents | null;
  readonly purchase: Purchase;
}

// How a row draws: owned; blocked (greyed with its reason); affordable (the gold outline);
// or short of the bank.
type ShopRowLook = "affordable" | "blocked" | "owned" | "short";

export function shopRowLook(bank: Cents, row: ShopRow): ShopRowLook {
  if (row.price === null) {
    return "owned";
  }
  if (row.blocked !== null) {
    return "blocked";
  }
  return row.price <= bank ? "affordable" : "short";
}

// Everything a row's look sets. Owned shows its art in full colour with no padlock or plate.
// Affordable keeps the full-colour art with the open padlock and the buy plate. Short is a
// disabled row with the grey copy of its art, the closed padlock and the short plate. Blocked
// is a disabled row with its silhouette, the closed padlock and its price on the goal plate.
export const SHOP_ROW_VIEWS: Readonly<Record<ShopRowLook, ItemLook>> = {
  affordable: { art: "full", padlock: "open", plate: "buy", state: "normal" },
  blocked: { art: "silhouette", padlock: "closed", plate: "goal", state: "disabled" },
  owned: { art: "full", padlock: null, plate: null, state: "normal" },
  short: { art: "grey", padlock: "closed", plate: "short", state: "disabled" },
};

// Whether anything in the shop is affordable now: the building then wears the gold outline.
export function shopAffordable(data: ShopData, owned: Owned, bank: Cents): boolean {
  return purchases(data).some((purchase) => isAffordable(data, owned, bank, purchase));
}

// Every gear item in shop order, owned ones in place, each with its effect in a few words.
export function gearRows(data: ShopData, owned: Owned): ShopRow[] {
  return (Object.keys(data.shopGear) as GearId[]).map((gear) => {
    const purchase: Purchase = { gear, kind: "gear" };
    return {
      blocked: null,
      id: `gear:${gear}`,
      line: data.shopGear[gear].short,
      name: data.shopGear[gear].name,
      price: purchasePrice(data, owned, purchase),
      purchase,
    };
  });
}

// Each slot past the starting ones, numbered from 1: owned, the next one for sale, or one
// that needs the slot before it bought first.
export function slotRows(data: ShopData, owned: Owned): ShopRow[] {
  const text = data.homeText;
  const fields = HOME_TEXT_FIELDS.shop;
  const starting = startingDogSlots(data);
  return data.dogSlots.slice(starting).map((slot, i) => {
    const number = starting + i + 1;
    const blocked =
      number > owned.dogSlots + 1
        ? fillLine(fields, text.shop, "slotFirst", { slot: String(number - 1) })
        : null;
    return {
      blocked,
      id: `slot:${number}`,
      line: blocked ?? fillLine(fields, text.shop, "slotLine", { count: String(number) }),
      name: homeLine(text, "dogSlotName", { slot: String(number) }),
      price: number <= owned.dogSlots ? null : unlockPrice(data.tuning, slot),
      purchase: { kind: "dogSlot" },
    };
  });
}

// The dogs still for sale, in data order, each with its size and hearts: a bought dog leaves
// the list. Its price shows on the row's plate.
export function dogRows(data: ShopData, owned: Owned): ShopRow[] {
  const sold = (Object.keys(data.dogs) as DogId[]).filter(
    (dog) => data.dogs[dog].unlock === "shop" && !owned.dogs.includes(dog),
  );
  return sold.map((dog) => {
    const purchase: Purchase = { dog, kind: "dog" };
    return {
      blocked: null,
      id: `dog:${dog}`,
      line: capitalize(dogKindText(data, dog)),
      name: data.dogs[dog].name,
      price: purchasePrice(data, owned, purchase),
      purchase,
    };
  });
}

// The row a purchase opens the shop on: a dog's or gear item's own, or the next slot's.
export function shopRowId(owned: Pick<Owned, "dogSlots">, purchase: Purchase): string {
  switch (purchase.kind) {
    case "dog":
      return `dog:${purchase.dog}`;
    case "dogSlot":
      return `slot:${owned.dogSlots + 1}`;
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
