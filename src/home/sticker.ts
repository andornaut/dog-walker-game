import type { GameData } from "../data/types";
import type { Cents } from "../rules/units";
import type { Owned } from "../save/schema";
import { isAffordable, purchases } from "./afford";
import { type Purchase, purchasePrice } from "./home";

type ShopData = Pick<GameData, "dogSlots" | "dogs" | "shopGear" | "tuning">;

// A dog or gear tile, the only items a sticker goes on.
export type TileItem = Exclude<Purchase, { kind: "dogSlot" }>;

// The home screen's one ui-sticker: new on a tile the bank covers now and did not at the last
// visit, else price on the cheapest locked item still out of reach.
export interface Sticker {
  readonly item: TileItem;
  readonly kind: "new" | "price";
  readonly price: Cents;
}

// new wins over price; among equals, the first in the shop's order.
export function homeSticker(
  data: ShopData,
  owned: Owned,
  before: Cents,
  bank: Cents,
): Sticker | null {
  const priced = purchases(data).flatMap((item) => {
    const price = item.kind === "dogSlot" ? null : purchasePrice(data, owned, item);
    return item.kind === "dogSlot" || price === null ? [] : [{ item, price }];
  });
  const fresh = priced.find(
    ({ item }) => isAffordable(data, owned, bank, item) && !isAffordable(data, owned, before, item),
  );
  if (fresh !== undefined) {
    return { ...fresh, kind: "new" };
  }
  const next = priced
    .filter(({ price }) => price > bank)
    .reduce<(typeof priced)[number] | undefined>(
      (cheapest, entry) =>
        cheapest === undefined || entry.price < cheapest.price ? entry : cheapest,
      undefined,
    );
  return next === undefined ? null : { ...next, kind: "price" };
}

export function sameItem(a: TileItem, b: TileItem): boolean {
  return a.kind === "dog"
    ? b.kind === "dog" && a.dog === b.dog
    : b.kind === "gear" && a.gear === b.gear;
}
