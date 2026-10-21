import { describe, expect, it } from "vitest";

import { DOGS } from "../data/dogs";
import { DOG_SLOTS } from "../data/dogSlots";
import { TEST_TUNING } from "../testing/tuning";
import { nextDogSlot, startingDogSlots, unlockPrice } from "./shop";

const data = { dogSlots: DOG_SLOTS, tuning: TEST_TUNING };

describe("unlockPrice", () => {
  it.each(Object.values(DOGS))("prices $name by its unlock", (dog) => {
    const expected = dog.unlock === "start" ? 0 : TEST_TUNING.money.prices[dog.price] * 100;
    expect(unlockPrice(TEST_TUNING, dog)).toBe(expected);
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
