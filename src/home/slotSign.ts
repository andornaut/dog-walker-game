import type { GameData } from "../data/types";
import { containsPoint } from "../lib/rect";
import type { Cents } from "../rules/units";
import type { Owned } from "../save/schema";
import { dollarText, type Purchase, purchasePrice } from "./home";
import { HOME_LAYOUT } from "./homeLayout";

type SignData = Pick<GameData, "dogSlots" | "dogs" | "homeText" | "shopGear" | "tuning">;

// What a tap on the dog slot sign opens the shop on: the next slot, the first one for sale.
export const SLOT_SIGN_PURCHASE: Purchase = { kind: "dogSlot" };

// The dog slot sign beside the Pet shop: its two lines (the call to buy over the next slot's
// price, as the shop shows prices) and whether the bank covers that slot. Null once every
// slot is owned.
export interface SlotSign {
  readonly affordable: boolean;
  readonly lines: readonly [string, string];
}

export function slotSign(data: SignData, owned: Owned, bank: Cents): SlotSign | null {
  const price = purchasePrice(data, owned, SLOT_SIGN_PURCHASE);
  if (price === null) {
    return null;
  }
  return { affordable: price <= bank, lines: [data.homeText.slotSign, dollarText(price)] };
}

// Whether a tap at (x, y) lands on the dog slot sign: on its hit area while it shows.
export function slotSignAt(
  data: SignData,
  owned: Owned,
  bank: Cents,
  x: number,
  y: number,
): boolean {
  return slotSign(data, owned, bank) !== null && containsPoint(HOME_LAYOUT.slotSign.hit, x, y);
}
