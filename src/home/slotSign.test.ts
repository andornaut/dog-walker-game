import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import type { DogId } from "../data/types";
import { startingDogSlots, unlockPrice } from "../rules/shop";
import { type Cents, cents } from "../rules/units";
import type { Owned } from "../save/schema";
import { TEST_TUNING } from "../testing/tuning";
import { dollarText } from "./home";
import { HOME_LAYOUT } from "./homeLayout";
import { shopRowId, slotRows } from "./shop";
import { SLOT_SIGN_PURCHASE, slotSign, slotSignAt } from "./slotSign";

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
const { hit } = HOME_LAYOUT.slotSign;
const inside = { x: hit.x + hit.width / 2, y: hit.y + hit.height / 2 };

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

describe("slotSignAt", () => {
  const rich = cents(Number.MAX_SAFE_INTEGER);

  it.each([
    { at: inside, bought: 0, lands: true },
    { at: { x: hit.x, y: hit.y }, bought: 0, lands: true },
    { at: { x: hit.x - 1, y: inside.y }, bought: 0, lands: false },
    { at: { x: inside.x, y: hit.y + hit.height }, bought: 0, lands: false },
    { at: inside, bought: forSale - 1, lands: true },
    { at: inside, bought: forSale, lands: false },
  ])("a tap at $at with $bought slots bought lands: $lands", ({ at, bought, lands }) => {
    expect(slotSignAt(data, ownedWith(bought), rich, at.x, at.y)).toBe(lands);
  });

  it.each(boughtCounts.slice(0, -1))(
    "with %i slots bought, opens the shop on the first slot for sale",
    (bought) => {
      const owned = ownedWith(bought);
      const first = slotRows(data, owned).find((row) => row.price !== null && row.blocked === null);
      expect(shopRowId(owned, SLOT_SIGN_PURCHASE)).toBe(first?.id);
    },
  );
});
