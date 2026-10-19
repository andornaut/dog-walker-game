import type { DogId, GameData, GearId, HomeText, ZoneId } from "../data/types";
import { quipLine } from "../rules/choices";
import { zoneFee } from "../rules/dogs";
import { effectClause, SIZE_NAMES, TEMPERAMENT_NAMES, TRAIT_NAMES } from "../rules/effectText";
import { nextDogSlot, price, unlockPrice } from "../rules/shop";
import { addCents, type Cents, cents, read } from "../rules/units";
import type { LastWalk, Owned, SaveDocument, SaveStats } from "../save/schema";
import { dogsWalked, walksPlayed } from "../save/stats";
import type { PackDogs } from "../state/runState";
import { fillLine } from "../text/lines";
import { HOME_TEXT_FIELDS } from "./homeText";

// The pack being picked, in the order picked, and the gear to take.
export interface HomeLoadout {
  readonly dogs: readonly DogId[];
  readonly gear: GearId | null;
}

export type Purchase =
  | { readonly dog: DogId; readonly kind: "dog" }
  | { readonly kind: "dogSlot" }
  | { readonly gear: GearId; readonly kind: "gear" };

// A tap on the home screen changes the loadout, asks to buy a locked item, or is refused
// because the pack is full.
export type HomeTap =
  | { readonly kind: "buy"; readonly purchase: Purchase }
  | { readonly kind: "full" }
  | { readonly kind: "loadout"; readonly loadout: HomeLoadout };

type ShopData = Pick<GameData, "dogSlots" | "dogs" | "shopGear" | "tuning">;

// Money is counted in cents and shown in whole dollars, with thousands separated.
export function dollarText(amount: Cents): string {
  return `$${Math.floor(amount / 100).toLocaleString("en-US")}`;
}

// How many dogs the player's pack may hold: one per dog slot, up to counts.packSizeMax.
export function packCapacity(
  data: Pick<GameData, "tuning">,
  owned: Pick<Owned, "dogSlots">,
): number {
  return Math.min(owned.dogSlots, read(data.tuning, "counts", "packSizeMax"));
}

// An owned dog joins the pack, or leaves it if already picked; a full pack refuses it. A dog
// not owned yet is a purchase.
export function tapDog(
  data: Pick<GameData, "tuning">,
  owned: Owned,
  dog: DogId,
  loadout: HomeLoadout,
): HomeTap {
  if (!owned.dogs.includes(dog)) {
    return { kind: "buy", purchase: { dog, kind: "dog" } };
  }
  if (loadout.dogs.includes(dog)) {
    return {
      kind: "loadout",
      loadout: { ...loadout, dogs: loadout.dogs.filter((id) => id !== dog) },
    };
  }
  if (loadout.dogs.length >= packCapacity(data, owned)) {
    return { kind: "full" };
  }
  return { kind: "loadout", loadout: { ...loadout, dogs: [...loadout.dogs, dog] } };
}

// Owned gear is equipped, replacing any other, or unequipped if already on. Gear not owned
// yet is a purchase.
export function tapGear(owned: Owned, gear: GearId, loadout: HomeLoadout): HomeTap {
  if (!owned.gear.includes(gear)) {
    return { kind: "buy", purchase: { gear, kind: "gear" } };
  }
  return { kind: "loadout", loadout: { ...loadout, gear: loadout.gear === gear ? null : gear } };
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

// The picked dogs as a pack a walk can start with, or undefined with none picked.
export function packOf(loadout: HomeLoadout): PackDogs | undefined {
  const [first, second, third] = loadout.dogs;
  if (first === undefined) {
    return undefined;
  }
  if (second === undefined) {
    return [first];
  }
  return third === undefined ? [first, second] : [first, second, third];
}

// What the picked pack pays for each zone it finishes, before upgrades.
export function packFeePerZone(
  data: Pick<GameData, "dogs" | "tuning">,
  loadout: HomeLoadout,
): Cents {
  return loadout.dogs.reduce(
    (total, dog) => addCents(total, zoneFee(data.tuning, [], data.dogs[dog])),
    cents(0),
  );
}

// The name of the walk's zone at position zone, counting from 1, or the world's name for a
// position the walk never picked a zone for.
function zoneName(data: Pick<GameData, "world">, route: readonly ZoneId[], zone: number): string {
  const id = route[zone - 1];
  return data.world.zones.find((candidate) => candidate.id === id)?.name ?? data.world.name;
}

// Dog names joined for a sentence: "Koda", "Koda and Biscuit", "Koda, Biscuit and Archie".
export function dogNames(data: Pick<GameData, "dogs">, dogs: readonly DogId[]): string {
  const names = dogs.map((dog) => data.dogs[dog].name);
  const last = names.pop();
  if (last === undefined) {
    return "";
  }
  return names.length === 0 ? last : `${names.join(", ")} and ${last}`;
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

// Splits text into lines of at most maxChars, breaking between words; a longer word gets a
// line of its own.
export function wrapWords(maxChars: number, text: string): string[] {
  const lines: string[] = [];
  for (const word of text.split(/\s+/).filter((part) => part !== "")) {
    const last = lines.at(-1);
    if (last !== undefined && last.length + 1 + word.length <= maxChars) {
      lines[lines.length - 1] = `${last} ${word}`;
    } else {
      lines.push(word);
    }
  }
  return lines;
}

// What a dog's owner says when the player picks it: their name and one of their parting
// lines, wrapped to the speech bubble.
export function partingSpeech(
  data: Pick<GameData, "dogs" | "quips">,
  random: () => number,
  maxChars: number,
  dog: DogId,
): string[] {
  const line = quipLine(data, random, { dog, moment: "parting" });
  return wrapWords(maxChars, `${data.dogs[dog].owner.name}: ${line}`);
}

type InfoData = ShopData & Pick<GameData, "debuffs" | "encounters" | "homeText" | "needs">;

const FOCUS_FIELDS = HOME_TEXT_FIELDS.focus;

// What buying an item would take: its price, and how much more the bank needs if short.
function priceInfo(text: HomeText["focus"], bank: Cents, cost: Cents): string {
  const price = dollarText(cost);
  return cost > bank
    ? fillLine(FOCUS_FIELDS, text, "priceShort", { amount: dollarText(cents(cost - bank)), price })
    : fillLine(FOCUS_FIELDS, text, "priceBuy", { price });
}

// A dog in words for the home screen's info line, so its tile's icons never stand alone: size
// and trait, fee or price, and its owner's temperament.
export function dogInfo(data: InfoData, owned: Owned, bank: Cents, dog: DogId): string {
  const text = data.homeText.focus;
  const { name, owner, size, trait } = data.dogs[dog];
  const kind = fillLine(FOCUS_FIELDS, text, "kind", {
    size: SIZE_NAMES[size],
    trait: TRAIT_NAMES[trait].toLowerCase(),
  });
  const temper = fillLine(FOCUS_FIELDS, text, "temper", {
    owner: owner.name,
    temperament: TEMPERAMENT_NAMES[owner.temperament],
  });
  const cost = purchasePrice(data, owned, { dog, kind: "dog" });
  if (cost === null) {
    const fee = dollarText(zoneFee(data.tuning, [], data.dogs[dog]));
    return fillLine(FOCUS_FIELDS, text, "dogOwned", { dog: name, fee, kind, temper });
  }
  const price = priceInfo(text, bank, cost);
  return fillLine(FOCUS_FIELDS, text, "dogLocked", { dog: name, kind, price, temper });
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
