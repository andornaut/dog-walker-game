import type { GameData, LiveTuning, PriceKey, Unlock } from "../data/types";
import { type Cents, cents } from "../units";
import { readTable } from "./units";

export function price(tuning: LiveTuning, key: PriceKey): Cents {
  return readTable(tuning, "money", "prices", key);
}

// What an unlockable item costs: nothing for one owned from the start.
export function unlockPrice(tuning: LiveTuning, item: Unlock): Cents {
  return item.unlock === "start" ? cents(0) : price(tuning, item.price);
}

// The dog slots a new player owns, by number counting from 1.
export function startingDogSlots(data: Pick<GameData, "dogSlots">): number[] {
  return data.dogSlots.flatMap((slot, i) => (slot.unlock === "start" ? [i + 1] : []));
}

// The cheapest dog slot not owned, by number counting from 1, ties to the lowest number; null
// once every slot is owned.
export function cheapestDogSlot(
  data: Pick<GameData, "dogSlots" | "tuning">,
  owned: readonly number[],
): number | null {
  const forSale = data.dogSlots.flatMap((item, i) =>
    owned.includes(i + 1) ? [] : [{ price: unlockPrice(data.tuning, item), slot: i + 1 }],
  );
  const [cheapest] = forSale.sort((a, b) => a.price - b.price || a.slot - b.slot);
  return cheapest?.slot ?? null;
}
