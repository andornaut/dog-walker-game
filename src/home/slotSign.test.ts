import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import type { DogId } from "../data/types";
import { startingDogSlots, unlockPrice } from "../rules/shop";
import { type Cents, cents } from "../rules/units";
import type { Owned } from "../save/schema";
import { TEST_TUNING } from "../testing/tuning";
import { dollarText } from "./home";
import { shopRowId, slotRows } from "./shop";
import { SLOT_SIGN_PURCHASE, slotSign } from "./slotSign";

const data = { ...gameData, tuning: TEST_TUNING };
const starting = startingDogSlots(data);
const dogs = (Object.keys(data.dogs) as DogId[]).filter((dog) => data.dogs[dog].unlock === "start");
const ownedWith = (bought: number): Owned => ({
  dogSlots: starting + bought,
  dogs,
  gear: [],
  walkers: [],
});
// The price of the slot after the bought ones, or null once every slot is owned.
const nextPrice = (bought: number): Cents | null => {
  const slot = data.dogSlots[starting + bought];
  return slot === undefined ? null : unlockPrice(data.tuning, slot);
};
const forSale = data.dogSlots.length - starting;
const boughtCounts = Array.from({ length: forSale + 1 }, (_, bought) => bought);

describe("slotSign", () => {
  const cases = boughtCounts.flatMap((bought) =>
    [true, false].map((affordable) => ({ affordable, bought })),
  );

  it.each(cases)(
    "with $bought slots bought and the bank covering the next: $affordable",
    ({ affordable, bought }) => {
      const price = nextPrice(bought);
      const bank = price === null ? cents(0) : cents(affordable ? price : price - 1);
      const sign = slotSign(data, ownedWith(bought), bank);
      expect(sign).toEqual(
        price === null ? null : { affordable, lines: [data.homeText.slotSign, dollarText(price)] },
      );
    },
  );
});

describe("SLOT_SIGN_PURCHASE", () => {
  it.each(boughtCounts.slice(0, -1))(
    "with %i slots bought, opens the shop on the first slot for sale",
    (bought) => {
      const owned = ownedWith(bought);
      const first = slotRows(data, owned).find((row) => row.price !== null && row.blocked === null);
      expect(shopRowId(owned, SLOT_SIGN_PURCHASE)).toBe(first?.id);
    },
  );
});
