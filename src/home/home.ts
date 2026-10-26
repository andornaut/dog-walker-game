import type { DogId, GameData, GearId } from "../data/types";
import { fillLine, signedText } from "../lib/lines";
import { quipLine } from "../rules/choices";
import { sizeHearts } from "../rules/dogs";
import { effectClause, SIZE_NAMES } from "../rules/effectText";
import { price, unlockPrice } from "../rules/shop";
import { type Cents, cents, read } from "../rules/units";
import type { Owned, SaveDocument } from "../save/schema";
import { HOME_TEXT_FIELDS } from "./homeText";

// The pack being picked, in the order picked, and the gear to take.
export interface HomeLoadout {
  readonly dogs: readonly DogId[];
  readonly gear: GearId | null;
}

export type Purchase =
  | { readonly dog: DogId; readonly kind: "dog" }
  // A dog slot by number, counting from 1.
  | { readonly kind: "dogSlot"; readonly slot: number }
  | { readonly gear: GearId; readonly kind: "gear" };

// A tap on the home screen changes the loadout, opens the shop on a locked item, or is
// refused because the pack is full.
export type HomeTap =
  | { readonly kind: "full" }
  | { readonly kind: "loadout"; readonly loadout: HomeLoadout }
  | { readonly kind: "shop"; readonly purchase: Purchase };

type ShopData = Pick<GameData, "dogSlots" | "dogs" | "shopGear" | "tuning">;

// Money is counted in cents and shown in whole dollars, with thousands separated.
export function dollarText(amount: Cents): string {
  return `$${dollarAmountText(amount)}`;
}

// dollarText without its "$", for a screen that draws the "$" apart.
export function dollarAmountText(amount: Cents): string {
  return Math.floor(amount / 100).toLocaleString("en-US");
}

// The short form's units, each a thousand times the one before it, from a thousand.
const SHORT_UNITS = ["k", "M", "B", "T"] as const;

// dollarAmountText at most three digits long, rounded down, for a slot too narrow for the full
// amount: whole dollars under a thousand, else in the largest unit it reaches, with one decimal
// under ten of it ("1.2k", "12k", "123M", "1.2B").
export function shortDollarAmountText(amount: Cents): string {
  const dollars = Math.floor(amount / 100);
  const place = SHORT_UNITS.filter((_, i) => dollars >= 1_000 ** (i + 1)).length - 1;
  const unit = SHORT_UNITS[place];
  if (unit === undefined) {
    return String(dollars);
  }
  const tenths = Math.floor(dollars / (1_000 ** (place + 1) / 10));
  return tenths < 100 ? `${tenths / 10}${unit}` : `${Math.floor(tenths / 10)}${unit}`;
}

// A change in money with its sign: "+$240", "−$12".
export function signedDollarText(amount: number): string {
  return signedText(amount, dollarText(cents(Math.abs(amount))));
}

// How many dogs the player's pack may hold: one per dog slot owned, whichever slots they are,
// up to counts.packSizeMax.
export function packCapacity(
  data: Pick<GameData, "tuning">,
  owned: Pick<Owned, "dogSlots">,
): number {
  return Math.min(owned.dogSlots.length, read(data.tuning, "counts", "packSizeMax"));
}

// A tap on an id in a pick of at most capacity: a picked id is dropped, a free slot takes it
// in order, a full one-slot pick swaps it in, and a fuller pick refuses it. Dogs, the Pocket's
// gear and walkers share this, so their taps stay alike.
export function togglePick<T>(
  capacity: number,
  picked: readonly T[],
  id: T,
): { readonly kind: "full" } | { readonly kind: "picked"; readonly picked: readonly T[] } {
  if (picked.includes(id)) {
    return { kind: "picked", picked: picked.filter((other) => other !== id) };
  }
  if (picked.length < capacity) {
    return { kind: "picked", picked: [...picked, id] };
  }
  return capacity === 1 ? { kind: "picked", picked: [id] } : { kind: "full" };
}

// An owned dog joins the pack, or leaves it if already picked. A full one-slot pack swaps
// its dog for this one; a fuller pack refuses it. A dog not owned yet opens the shop on it.
export function tapDog(
  data: Pick<GameData, "tuning">,
  owned: Owned,
  dog: DogId,
  loadout: HomeLoadout,
): HomeTap {
  if (!owned.dogs.includes(dog)) {
    return { kind: "shop", purchase: { dog, kind: "dog" } };
  }
  const toggled = togglePick(packCapacity(data, owned), loadout.dogs, dog);
  return toggled.kind === "full"
    ? { kind: "full" }
    : { kind: "loadout", loadout: { ...loadout, dogs: toggled.picked } };
}

// Owned gear goes in the Pocket, replacing any other, or comes out if already in it. Gear
// not owned yet opens the shop on it.
export function tapGear(owned: Owned, gear: GearId, loadout: HomeLoadout): HomeTap {
  if (!owned.gear.includes(gear)) {
    return { kind: "shop", purchase: { gear, kind: "gear" } };
  }
  const toggled = togglePick(1, loadout.gear === null ? [] : [loadout.gear], gear);
  return {
    kind: "loadout",
    loadout: { ...loadout, gear: toggled.kind === "picked" ? (toggled.picked[0] ?? null) : null },
  };
}

// ids cheapest first by cost, ties in the order given.
export function cheapestFirst<Id>(cost: (id: Id) => Cents, ids: readonly Id[]): Id[] {
  return [...ids].sort((a, b) => cost(a) - cost(b) || ids.indexOf(a) - ids.indexOf(b));
}

// The gear as the Pocket and the shop's gear tab list it: cheapest first by list price, owned
// or not, ties in data order (the order of shopGear's keys).
export function gearByPrice(data: Pick<GameData, "shopGear" | "tuning">): GearId[] {
  const listPrice = (gear: GearId) => price(data.tuning, data.shopGear[gear].price);
  return cheapestFirst(listPrice, Object.keys(data.shopGear) as GearId[]);
}

// What a purchase costs, or null when it is not for sale: already owned, or no such slot.
export function purchasePrice(data: ShopData, owned: Owned, purchase: Purchase): Cents | null {
  switch (purchase.kind) {
    case "dog":
      return owned.dogs.includes(purchase.dog)
        ? null
        : unlockPrice(data.tuning, data.dogs[purchase.dog]);
    case "dogSlot": {
      const slot = data.dogSlots[purchase.slot - 1];
      return slot === undefined || owned.dogSlots.includes(purchase.slot)
        ? null
        : unlockPrice(data.tuning, slot);
    }
    case "gear":
      return owned.gear.includes(purchase.gear)
        ? null
        : price(data.tuning, data.shopGear[purchase.gear].price);
    default:
      return purchase satisfies never;
  }
}

// Whether the player can buy it now: it is for sale and the bank covers its price. Owned items,
// dog slots included, never are. The one buyable check: the shop's rows and confirm, the home
// screen's tiles, slot sign and info line, and the detail cards all ask it.
export function isAffordable(
  data: ShopData,
  owned: Owned,
  bank: Cents,
  purchase: Purchase,
): boolean {
  const cost = purchasePrice(data, owned, purchase);
  return cost !== null && cost <= bank;
}

export type BuyResult =
  | { readonly kind: "bought"; readonly save: SaveDocument }
  | { readonly kind: "refused"; readonly reason: "cantAfford" | "notForSale" };

// Takes the price from the bank and adds the item to what the player owns.
export function buy(data: ShopData, purchase: Purchase, save: SaveDocument): BuyResult {
  const { owned } = save;
  const cost = purchasePrice(data, owned, purchase);
  if (cost === null) {
    return { kind: "refused", reason: "notForSale" };
  }
  if (!isAffordable(data, owned, save.bankCents, purchase)) {
    return { kind: "refused", reason: "cantAfford" };
  }
  const bought: Owned =
    purchase.kind === "dog"
      ? { ...owned, dogs: [...owned.dogs, purchase.dog] }
      : purchase.kind === "gear"
        ? { ...owned, gear: [...owned.gear, purchase.gear] }
        : { ...owned, dogSlots: [...owned.dogSlots, purchase.slot].sort((a, b) => a - b) };
  return {
    kind: "bought",
    save: { ...save, bankCents: cents(save.bankCents - cost), owned: bought },
  };
}

// What a dog's owner says when the player picks it: one of their parting lines. The bubble
// shows the owner's face and name beside it.
export function partingSpeech(
  data: Pick<GameData, "dogs" | "quips">,
  random: () => number,
  dog: DogId,
): string {
  return quipLine(data, random, { dog, moment: "parting" });
}

type InfoData = ShopData & Pick<GameData, "debuffs" | "encounters" | "homeText">;

const FOCUS_FIELDS = HOME_TEXT_FIELDS.focus;

// What buying an item would take: its price, and how much more the bank needs if short.
function priceInfo(
  data: InfoData,
  owned: Owned,
  bank: Cents,
  cost: Cents,
  purchase: Purchase,
): string {
  const text = data.homeText.focus;
  const price = dollarText(cost);
  return isAffordable(data, owned, bank, purchase)
    ? fillLine(FOCUS_FIELDS, text, "priceBuy", { price })
    : fillLine(FOCUS_FIELDS, text, "priceShort", { amount: dollarText(cents(cost - bank)), price });
}

// A dog's size and hearts in words ("big, 5♥"), as the info line and the shop's row say them.
export function dogKindText(
  data: Pick<GameData, "dogs" | "homeText" | "tuning">,
  dog: DogId,
): string {
  return fillLine(FOCUS_FIELDS, data.homeText.focus, "kind", {
    hearts: String(sizeHearts(data.tuning, data.dogs[dog])),
    size: SIZE_NAMES[data.dogs[dog].size],
  });
}

// A dog in words for the home screen's info line, so its tile's icons never stand alone: its
// name and size, and its price while not owned.
export function dogInfo(data: InfoData, owned: Owned, bank: Cents, dog: DogId): string {
  const text = data.homeText.focus;
  const purchase: Purchase = { dog, kind: "dog" };
  const cost = purchasePrice(data, owned, purchase);
  const fields = { dog: data.dogs[dog].name, kind: dogKindText(data, dog) };
  return cost === null
    ? fillLine(FOCUS_FIELDS, text, "dogOwned", fields)
    : fillLine(FOCUS_FIELDS, text, "dogLocked", {
        ...fields,
        price: priceInfo(data, owned, bank, cost, purchase),
      });
}

// A gear item and what it does, with its price while locked.
export function gearInfo(data: InfoData, owned: Owned, bank: Cents, gear: GearId): string {
  const text = data.homeText.focus;
  const item = data.shopGear[gear];
  const fields = { effect: effectClause(data, item.effects), gear: item.name };
  const purchase: Purchase = { gear, kind: "gear" };
  const cost = purchasePrice(data, owned, purchase);
  return cost === null
    ? fillLine(FOCUS_FIELDS, text, "gear", fields)
    : fillLine(FOCUS_FIELDS, text, "gearLocked", {
        ...fields,
        price: priceInfo(data, owned, bank, cost, purchase),
      });
}
