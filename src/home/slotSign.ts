import type { GameData } from "../data/types";
import type { Cents } from "../rules/units";
import type { Owned } from "../save/schema";
import { dollarText, isAffordable, type Purchase, purchasePrice } from "./home";

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
  return {
    affordable: isAffordable(data, owned, bank, SLOT_SIGN_PURCHASE),
    lines: [data.homeText.slotSign, dollarText(price)],
  };
}
