import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import type { LiveTuning } from "../data/types";
import { keysOf } from "../lib/records";
import { cents } from "../lib/units";
import { startingDogSlots } from "../rules/shop";
import type { Owned } from "../save/schema";
import { TEST_TUNING } from "../testing/tuning";
import { dollarText } from "./home";
import { type ShopRow, shopRowId, slotRows } from "./shop";
import { slotSign, slotSignPurchase } from "./slotSign";

const starting = startingDogSlots(gameData);
const dogs = keysOf(gameData.dogs).filter((dog) => gameData.dogs[dog].unlock === "start");
const forSale = gameData.dogSlots.map((_, i) => i + 1).filter((slot) => !starting.includes(slot));
// Every set of slots a player can own, named: the starting ones and any of the others.
const slotSets = forSale.reduce<number[][]>(
  (sets, slot) => [...sets, ...sets.map((set) => [...set, slot])],
  [starting],
);
const ownedWith = (dogSlots: number[]): Owned => ({ dogSlots, dogs, gear: [], walkers: [] });

// The slots for sale priced in dollars by pick, given each slot's place among them.
const withSlotPrices = (pick: (place: number) => number): LiveTuning => ({
  ...TEST_TUNING,
  money: {
    ...TEST_TUNING.money,
    prices: {
      ...TEST_TUNING.money.prices,
      ...Object.fromEntries(
        forSale.flatMap((slot, place) => {
          const item = gameData.dogSlots[slot - 1];
          return item?.unlock === "shop" ? [[item.price, pick(place)]] : [];
        }),
      ),
    },
  },
});
const tunings: readonly [string, LiveTuning][] = [
  ["the test prices", TEST_TUNING],
  ["one price for every slot", withSlotPrices(() => 2_000)],
  ["later slots cheaper", withSlotPrices((place) => 3_000 - 500 * place)],
];

// The row of the cheapest slot for sale, ties to the lowest number, read off the shop's rows.
const cheapestRow = (rows: readonly ShopRow[]): ShopRow | undefined => {
  const priced = rows.flatMap((row) => (row.price === null ? [] : [{ price: row.price, row }]));
  return priced.reduce<(typeof priced)[number] | undefined>(
    (best, next) => (best !== undefined && best.price <= next.price ? best : next),
    undefined,
  )?.row;
};

// With every slot owned there is nothing to afford, so the bank is checked once.
const cases = tunings.flatMap(([prices, tuning]) =>
  slotSets.flatMap((dogSlots) =>
    (forSale.every((slot) => dogSlots.includes(slot)) ? [true] : [true, false]).map(
      (affordable) => ({
        affordable,
        dogSlots,
        owned: dogSlots.join(" and "),
        prices,
        tuning,
      }),
    ),
  ),
);

describe("slotSign", () => {
  it.each(cases)(
    "at $prices with slots $owned owned and the bank covering the cheapest: $affordable",
    ({ affordable, dogSlots, tuning }) => {
      const data = { ...gameData, tuning };
      const owned = ownedWith(dogSlots);
      const price = cheapestRow(slotRows(data, owned))?.price ?? null;
      const bank = price === null ? cents(0) : cents(affordable ? price : price - 1);
      expect(slotSign(data, owned, bank)).toEqual(
        price === null ? null : { affordable, lines: [data.homeText.slotSign, dollarText(price)] },
      );
    },
  );
});

describe("slotSignPurchase", () => {
  it.each(cases.filter(({ affordable }) => affordable))(
    "at $prices with slots $owned owned, opens the shop on the cheapest slot for sale",
    ({ dogSlots, tuning }) => {
      const data = { ...gameData, tuning };
      const owned = ownedWith(dogSlots);
      const purchase = slotSignPurchase(data, owned);
      expect(purchase === null ? null : shopRowId(purchase)).toBe(
        cheapestRow(slotRows(data, owned))?.id ?? null,
      );
    },
  );
});
