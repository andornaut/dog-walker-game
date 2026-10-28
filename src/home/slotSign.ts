import type { GameData } from "../data/types";
import type { Cents } from "../lib/units";
import { cheapestDogSlot } from "../rules/shop";
import type { Owned } from "../save/schema";
import { dollarText, isAffordable, type Purchase, purchasePrice } from "./home";

type SignData = Pick<GameData, "dogSlots" | "dogs" | "homeText" | "shopGear" | "tuning">;

// The slot the dog slot sign offers, and a tap on it opens the shop on: the cheapest slot not
// owned, ties to the lowest number. Null once every slot is owned.
export function slotSignPurchase(
  data: Pick<GameData, "dogSlots" | "tuning">,
  owned: Pick<Owned, "dogSlots">,
): Purchase | null {
  const slot = cheapestDogSlot(data, owned.dogSlots);
  return slot === null ? null : { kind: "dogSlot", slot };
}

// The dog slot sign beside the Pet shop: its two lines (the call to buy over its slot's price,
// as the shop shows prices) and whether the bank covers that slot. Null once every slot is
// owned.
interface SlotSign {
  readonly affordable: boolean;
  readonly lines: readonly [string, string];
}

export function slotSign(data: SignData, owned: Owned, bank: Cents): SlotSign | null {
  const purchase = slotSignPurchase(data, owned);
  const price = purchase === null ? null : purchasePrice(data, owned, purchase);
  if (purchase === null || price === null) {
    return null;
  }
  return {
    affordable: isAffordable(data, owned, bank, purchase),
    lines: [data.homeText.slotSign, dollarText(price)],
  };
}
