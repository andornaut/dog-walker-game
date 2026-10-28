import type { GameData } from "../data/types";
import { keysOf } from "../lib/records";
import { type Cents, cents } from "../lib/units";
import type { LastWalk, Owned } from "../save/schema";
import { isAffordable, type Purchase } from "./home";

type ShopData = Pick<GameData, "dogSlots" | "dogs" | "shopGear" | "tuning">;

// Everything the home screen sells: each dog, gear item and dog slot.
export function purchases(data: ShopData): Purchase[] {
  return [
    ...keysOf(data.dogs).map((dog): Purchase => ({ dog, kind: "dog" })),
    ...keysOf(data.shopGear).map((gear): Purchase => ({ gear, kind: "gear" })),
    ...data.dogSlots.map((_, i): Purchase => ({ kind: "dogSlot", slot: i + 1 })),
  ];
}

// Whether a bank of `bank` covers something that `before` did not.
export function newlyAffordable(data: ShopData, owned: Owned, before: Cents, bank: Cents): boolean {
  return purchases(data).some(
    (purchase) =>
      isAffordable(data, owned, bank, purchase) && !isAffordable(data, owned, before, purchase),
  );
}

// The bank at the player's last visit to the home screen: the one remembered this session,
// else the bank before the last walk paid out. With neither, the bank as it is now.
export function bankAtLastVisit(
  remembered: Cents | undefined,
  bank: Cents,
  lastWalk: LastWalk | null,
): Cents {
  if (remembered !== undefined) {
    return remembered;
  }
  return lastWalk === null ? bank : cents(Math.max(0, bank - lastWalk.earnedCents));
}
