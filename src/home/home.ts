import type { DogId, GameData, GearId, HomeText, ZoneId } from "../data/types";
import { quipLine } from "../rules/choices";
import { maxHearts } from "../rules/dogs";
import { effectClause, sentenceList, SIZE_NAMES } from "../rules/effectText";
import { payFor } from "../rules/run";
import { nextDogSlot, price, unlockPrice } from "../rules/shop";
import { type Cents, cents, read } from "../rules/units";
import type { LastWalk, Owned, SaveDocument, SaveStats } from "../save/schema";
import { dogsWalked, walksPlayed } from "../save/stats";
import { fillLine, signedText } from "../text/lines";
import { HOME_TEXT_FIELDS, homeLine } from "./homeText";

// The pack being picked, in the order picked, and the gear to take.
export interface HomeLoadout {
  readonly dogs: readonly DogId[];
  readonly gear: GearId | null;
}

export type Purchase =
  | { readonly dog: DogId; readonly kind: "dog" }
  | { readonly kind: "dogSlot" }
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

// How many dogs the player's pack may hold: one per dog slot, up to counts.packSizeMax.
export function packCapacity(
  data: Pick<GameData, "tuning">,
  owned: Pick<Owned, "dogSlots">,
): number {
  return Math.min(owned.dogSlots, read(data.tuning, "counts", "packSizeMax"));
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

// What a purchase costs, or null when it is not for sale: already owned, or no slot left.
export function purchasePrice(data: ShopData, owned: Owned, purchase: Purchase): Cents | null {
  switch (purchase.kind) {
    case "dog":
      return owned.dogs.includes(purchase.dog)
        ? null
        : unlockPrice(data.tuning, data.dogs[purchase.dog]);
    case "dogSlot":
      return nextDogSlot(data, owned.dogSlots)?.price ?? null;
    case "gear":
      return owned.gear.includes(purchase.gear)
        ? null
        : price(data.tuning, data.shopGear[purchase.gear].price);
    default:
      return purchase satisfies never;
  }
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
  if (cost > save.bankCents) {
    return { kind: "refused", reason: "cantAfford" };
  }
  const bought: Owned =
    purchase.kind === "dog"
      ? { ...owned, dogs: [...owned.dogs, purchase.dog] }
      : purchase.kind === "gear"
        ? { ...owned, gear: [...owned.gear, purchase.gear] }
        : { ...owned, dogSlots: owned.dogSlots + 1 };
  return {
    kind: "bought",
    save: { ...save, bankCents: cents(save.bankCents - cost), owned: bought },
  };
}

// A dog's pay for each zone it walks, before the zone's multiplier, as its tile and the shop
// show it.
export function dogFeeText(data: Pick<GameData, "tuning">): string {
  return dollarText(payFor(data.tuning));
}

// The name of the walk's zone at position zone, counting from 1, or the world's name for a
// position the walk never picked a zone for.
function zoneName(data: Pick<GameData, "world">, route: readonly ZoneId[], zone: number): string {
  const id = route[zone - 1];
  return data.world.zones.find((candidate) => candidate.id === id)?.name ?? data.world.name;
}

// Dog names joined for a sentence: "Koda", "Koda and Biscuit", "Koda, Biscuit and Archie".
export function dogNames(
  data: Pick<GameData, "dogs" | "homeText">,
  dogs: readonly DogId[],
): string {
  return sentenceList(
    data.homeText.sentenceList,
    dogs.map((dog) => data.dogs[dog].name),
  );
}

type LogbookData = Pick<GameData, "dogs" | "homeText" | "world">;

const LOGBOOK_FIELDS = HOME_TEXT_FIELDS.logbook;

// The last walk as one line for the logbook, naming the last owner who fired you if one did.
export function lastWalkLine(data: LogbookData, walk: LastWalk): string {
  const text = data.homeText.logbook;
  const earned = fillLine(LOGBOOK_FIELDS, text, "lastEarned", {
    amount: dollarText(walk.earnedCents),
  });
  const firing = walk.firings.at(-1);
  if (firing !== undefined) {
    return fillLine(LOGBOOK_FIELDS, text, "lastFired", {
      earned,
      owner: data.dogs[firing.dog].owner.name,
      zone: zoneName(data, walk.route, firing.zone),
    });
  }
  if (walk.outcome === "finished") {
    return fillLine(LOGBOOK_FIELDS, text, "lastFinished", {
      earned,
      world: data.world.name,
      zones: String(walk.zonesFinished),
    });
  }
  return fillLine(LOGBOOK_FIELDS, text, "lastHeadedHome", {
    earned,
    zone: zoneName(data, walk.route, walk.zonesFinished + 1),
  });
}

// The home screen's logbook: the best walk, totals, and the last walk; null before any walk.
export interface Logbook {
  readonly best: string;
  readonly bestNote: string;
  readonly last: string;
  readonly totals: string;
}

export function logbookOf(data: LogbookData, stats: SaveStats): Logbook | null {
  const { bestWalk, lastWalk } = stats;
  if (bestWalk === null || lastWalk === null) {
    return null;
  }
  const text = data.homeText.logbook;
  const walks = walksPlayed(stats);
  const count = String(bestWalk.zonesFinished);
  const zones = fillLine(
    LOGBOOK_FIELDS,
    text,
    bestWalk.zonesFinished === 1 ? "zoneOne" : "zoneMany",
    {
      count,
    },
  );
  const dogs = dogNames(data, bestWalk.dogs);
  return {
    best: dollarText(bestWalk.earnedCents),
    bestNote: dogs === "" ? zones : fillLine(LOGBOOK_FIELDS, text, "bestNote", { dogs, zones }),
    last: lastWalkLine(data, lastWalk),
    totals: fillLine(LOGBOOK_FIELDS, text, "totals", {
      dogs: String(dogsWalked(stats)),
      fired: String(stats.timesFired),
      walks: String(walks),
    }),
  };
}

// What a dog's owner says when the player picks it: their name and one of their parting
// lines.
export function partingSpeech(
  data: Pick<GameData, "dogs" | "homeText" | "quips">,
  random: () => number,
  dog: DogId,
): string {
  return homeLine(data.homeText, "parting", {
    line: quipLine(data, random, { dog, moment: "parting" }),
    owner: data.dogs[dog].owner.name,
  });
}

type InfoData = ShopData & Pick<GameData, "debuffs" | "encounters" | "homeText">;

const FOCUS_FIELDS = HOME_TEXT_FIELDS.focus;

// What buying an item would take: its price, and how much more the bank needs if short.
function priceInfo(text: HomeText["focus"], bank: Cents, cost: Cents): string {
  const price = dollarText(cost);
  return cost > bank
    ? fillLine(FOCUS_FIELDS, text, "priceShort", { amount: dollarText(cents(cost - bank)), price })
    : fillLine(FOCUS_FIELDS, text, "priceBuy", { price });
}

// A dog's size and hearts in words ("big, 5♥"), as the info line and the shop's row say them.
export function dogKindText(
  data: Pick<GameData, "dogs" | "homeText" | "tuning">,
  dog: DogId,
): string {
  return fillLine(FOCUS_FIELDS, data.homeText.focus, "kind", {
    hearts: String(maxHearts(data.tuning, [], data.dogs[dog])),
    size: SIZE_NAMES[data.dogs[dog].size],
  });
}

// A dog in words for the home screen's info line, so its tile's icons never stand alone: an
// owned dog's name and size; a locked dog's price alone, as its tile names nothing.
export function dogInfo(data: InfoData, owned: Owned, bank: Cents, dog: DogId): string {
  const text = data.homeText.focus;
  const cost = purchasePrice(data, owned, { dog, kind: "dog" });
  if (cost === null) {
    const kind = dogKindText(data, dog);
    return fillLine(FOCUS_FIELDS, text, "dogOwned", { dog: data.dogs[dog].name, kind });
  }
  return fillLine(FOCUS_FIELDS, text, "dogLocked", { price: priceInfo(text, bank, cost) });
}

// A gear item and what it does, with its price while locked.
export function gearInfo(data: InfoData, owned: Owned, bank: Cents, gear: GearId): string {
  const text = data.homeText.focus;
  const item = data.shopGear[gear];
  const fields = { effect: effectClause(data, item.effects), gear: item.name };
  const cost = purchasePrice(data, owned, { gear, kind: "gear" });
  return cost === null
    ? fillLine(FOCUS_FIELDS, text, "gear", fields)
    : fillLine(FOCUS_FIELDS, text, "gearLocked", { ...fields, price: priceInfo(text, bank, cost) });
}
