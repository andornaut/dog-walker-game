import { describe, expect, it } from "vitest";

import { DOGS } from "../data/dogs";
import { DOG_SLOTS } from "../data/dogSlots";
import { TEST_TUNING } from "../testing/tuning";
import { nextDogSlot, startingDogSlots, unlockPrice } from "./shop";

const data = { dogSlots: DOG_SLOTS, tuning: TEST_TUNING };

describe("unlockPrice", () => {
  it("charges nothing for a starter and the price for a shop item", () => {
    expect(unlockPrice(TEST_TUNING, DOGS.koda)).toBe(0);
    expect(unlockPrice(TEST_TUNING, DOGS.waffles)).toBe(TEST_TUNING.money.prices.lockedDog * 100);
  });
});

describe("dog slots", () => {
  it("starts a new player with the slots marked start", () => {
    expect(startingDogSlots(data)).toBe(1);
  });

  it("sells the next slot at its price, and nothing once every slot is owned", () => {
    expect(nextDogSlot(data, 1)).toEqual({ price: 80_000, slot: 2 });
    expect(nextDogSlot(data, 2)).toEqual({ price: 180_000, slot: 3 });
    expect(nextDogSlot(data, 3)).toBeNull();
  });
});
