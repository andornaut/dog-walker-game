import type { GameData, LiveTuning, PriceKey, Unlock } from "../data/types";
import { type Cents, cents, dollarsToCents } from "./units";

export function price(tuning: LiveTuning, key: PriceKey): Cents {
  return dollarsToCents(tuning.money.prices[key]);
}

// What an unlockable item costs: nothing for one owned from the start.
export function unlockPrice(tuning: LiveTuning, item: Unlock): Cents {
  return item.unlock === "start" ? cents(0) : price(tuning, item.price);
}

// How many dog slots a new player owns.
export function startingDogSlots(data: Pick<GameData, "dogSlots">): number {
  return data.dogSlots.filter((slot) => slot.unlock === "start").length;
}

// The next dog slot to buy, numbered from 1, and its price; null once every slot is owned.
export function nextDogSlot(
  data: Pick<GameData, "dogSlots" | "tuning">,
  slotsOwned: number,
): { readonly price: Cents; readonly slot: number } | null {
  const next = data.dogSlots[slotsOwned];
  return next === undefined
    ? null
    : { price: unlockPrice(data.tuning, next), slot: slotsOwned + 1 };
}
