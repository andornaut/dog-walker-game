import { describe, expect, it } from "vitest";

import { DOG_SLOTS } from "../data/dogSlots";
import { TEST_TUNING } from "../testing/tuning";
import { nextDogSlot } from "./shop";

const data = { dogSlots: DOG_SLOTS, tuning: TEST_TUNING };

describe("dog slots", () => {
  it("sells the next slot at its price, and nothing once every slot is owned", () => {
    expect(nextDogSlot(data, 1)).toEqual({ price: 80_000, slot: 2 });
    expect(nextDogSlot(data, 2)).toEqual({ price: 180_000, slot: 3 });
    expect(nextDogSlot(data, 3)).toBeNull();
  });
});
