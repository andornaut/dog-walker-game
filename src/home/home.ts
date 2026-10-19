import type { DogId, GameData, GearId } from "../data/types";
import { quipLine } from "../rules/choices";
import { zoneFee } from "../rules/dogs";
import { effectText, SIZE_NAMES, TEMPERAMENT_NAMES, TRAIT_NAMES } from "../rules/effectText";
import { nextDogSlot, price, unlockPrice } from "../rules/shop";
import { addCents, type Cents, cents, read } from "../rules/units";
import type { LastWalk, Owned, SaveDocument, SaveStats } from "../save/schema";
import type { PackDogs } from "../state/runState";

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

export const emptyLoadout: HomeLoadout = { dogs: [], gear: null };

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

function zoneName(data: Pick<GameData, "world">, zone: number): string {
  return data.world.zones[zone - 1]?.name ?? data.world.name;
}

// Dog names joined for a sentence: "Koda", "Koda and Biscuit", "Koda, Biscuit and Dash".
export function dogNames(data: Pick<GameData, "dogs">, dogs: readonly DogId[]): string {
  const names = dogs.map((dog) => data.dogs[dog].name);
  const last = names.pop();
  if (last === undefined) {
    return "";
  }
  return names.length === 0 ? last : `${names.join(", ")} and ${last}`;
}

// The last walk as one line for the logbook, naming the last owner who fired you if one did.
export function lastWalkLine(data: Pick<GameData, "dogs" | "world">, walk: LastWalk): string {
  const earned = `+${dollarText(walk.earnedCents)}.`;
  const firing = walk.firings.at(-1);
  if (firing !== undefined) {
    return `${earned} ${data.dogs[firing.dog].owner.name} fired you on ${zoneName(data, firing.zone)}.`;
  }
  if (walk.outcome === "finished") {
    return `${earned} Walked all of ${data.world.name}.`;
  }
  return `${earned} Headed home from ${zoneName(data, walk.zonesFinished + 1)}.`;
}

// The home screen's logbook: the best walk, totals, and the last walk; null before any walk.
export interface Logbook {
  readonly best: string;
  readonly bestNote: string;
  readonly last: string;
  readonly totals: string;
}

export function logbookOf(
  data: Pick<GameData, "dogs" | "world">,
  stats: SaveStats,
): Logbook | null {
  const { bestWalk, lastWalk } = stats;
  if (bestWalk === null || lastWalk === null) {
    return null;
  }
  const walks = stats.runs.finished + stats.runs.noDogs + stats.runs.wentHome;
  const dogsWalked = Object.values(stats.dogs).reduce((total, dog) => total + dog.walks, 0);
  const zones = `${bestWalk.zonesFinished} ${bestWalk.zonesFinished === 1 ? "zone" : "zones"}`;
  const dogs = dogNames(data, bestWalk.dogs);
  return {
    best: dollarText(bestWalk.earnedCents),
    bestNote: dogs === "" ? zones : `${zones} with ${dogs}`,
    last: lastWalkLine(data, lastWalk),
    totals: `Walks ${walks}   Dogs walked ${dogsWalked}   Fired ${stats.timesFired}`,
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

type InfoData = ShopData & Pick<GameData, "debuffs" | "encounters">;

// What buying an item would take: its price, and how much more the bank needs if short.
function priceInfo(bank: Cents, cost: Cents): string {
  return cost > bank
    ? `${dollarText(cost)}: need ${dollarText(cents(cost - bank))} more.`
    : `${dollarText(cost)}: tap to buy.`;
}

// A dog in words for the home screen's info line, so its tile's icons never stand alone: size
// and trait, fee or price, and its owner's temperament.
export function dogInfo(data: InfoData, owned: Owned, bank: Cents, dog: DogId): string {
  const { name, owner, size, trait } = data.dogs[dog];
  const kind = `${SIZE_NAMES[size]} ${TRAIT_NAMES[trait].toLowerCase()}`;
  const temper = `${owner.name} is ${TEMPERAMENT_NAMES[owner.temperament]}.`;
  const cost = purchasePrice(data, owned, { dog, kind: "dog" });
  if (cost === null) {
    const fee = dollarText(zoneFee(data.tuning, [], data.dogs[dog]));
    return `${name}: ${kind}, ${fee} a zone. ${temper}`;
  }
  return `${name}: ${kind}. ${temper} ${priceInfo(bank, cost)}`;
}

// A gear item and what it does, with its price while locked.
export function gearInfo(data: InfoData, owned: Owned, bank: Cents, gear: GearId): string {
  const item = data.shopGear[gear];
  const line = `${item.name}: ${effectText(data, item.effects)}.`;
  const cost = purchasePrice(data, owned, { gear, kind: "gear" });
  return cost === null ? line : `${line} ${priceInfo(bank, cost)}`;
}
