import { describe, expect, it } from "vitest";

import { DOG_SLOTS } from "../data/dogSlots";
import { TEST_TUNING } from "../testing/tuning";
import { cheapestDogSlot } from "./shop";

// Slot prices in dollars, slot 2 then slot 3.
const withPrices = (dogSlot2: number, dogSlot3: number) => ({
  dogSlots: DOG_SLOTS,
  tuning: {
    ...TEST_TUNING,
    money: { ...TEST_TUNING.money, prices: { ...TEST_TUNING.money.prices, dogSlot2, dogSlot3 } },
  },
});

describe("cheapestDogSlot", () => {
  it.each([
    ["the cheaper of two for sale", withPrices(800, 1800), [1], 2],
    ["the cheaper one when it comes later", withPrices(1800, 800), [1], 3],
    ["the lowest number on a tie", withPrices(2000, 2000), [1], 2],
    ["the only one left, a later slot owned first", withPrices(800, 1800), [1, 3], 2],
    ["the only one left, an earlier slot owned first", withPrices(800, 1800), [1, 2], 3],
    ["none once every slot is owned", withPrices(800, 1800), [1, 2, 3], null],
  ])("offers %s", (_, data, owned, expected) => {
    expect(cheapestDogSlot(data, owned)).toBe(expected);
  });
});
