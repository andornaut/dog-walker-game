import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { cents, readTable } from "../rules/units";
import type { Owned } from "../save/schema";
import { TEST_TUNING } from "../testing/tuning";
import { homeSticker, type Sticker } from "./sticker";

// The prices these cases step between, held so a price change in the tuning keeps their order:
// the fanny pack is the cheapest, then every locked dog, then poop bags.
const tuning = {
  ...TEST_TUNING,
  money: {
    ...TEST_TUNING.money,
    prices: {
      ...TEST_TUNING.money.prices,
      archie: 600,
      fannyPack: 400,
      luckyCollar: 1000,
      nugget: 600,
      penny: 600,
      pierre: 600,
      poopBags: 700,
      runningShoes: 800,
      snowball: 600,
      zippy: 600,
    },
  },
};
const data = { ...gameData, tuning };
const dollars = (amount: number) => cents(amount * 100);
const price = (key: keyof typeof tuning.money.prices) => readTable(tuning, "money", "prices", key);
const owned: Owned = {
  dogSlots: 1,
  dogs: ["biscuit", "duchess", "koda"],
  gear: [],
  walkers: ["casey"],
};
const fannyPack = price("fannyPack") / 100;
const lockedDog = price("archie") / 100;

describe("homeSticker", () => {
  it("prices the cheapest item out of reach, marks a newly covered one new, and none once all are covered", () => {
    const cases: readonly [string, number, number, Sticker | null][] = [
      [
        "prices the cheapest locked item out of reach",
        0,
        0,
        { item: { gear: "fannyPack", kind: "gear" }, kind: "price", price: price("fannyPack") },
      ],
      [
        "marks an item the bank has just come to cover as new",
        0,
        fannyPack,
        { item: { gear: "fannyPack", kind: "gear" }, kind: "new", price: price("fannyPack") },
      ],
      [
        "puts new on the first newly covered item in the shop's order",
        fannyPack,
        lockedDog,
        { item: { dog: "archie", kind: "dog" }, kind: "new", price: price("archie") },
      ],
      [
        "prices the next item once nothing is new",
        lockedDog,
        lockedDog,
        { item: { gear: "poopBags", kind: "gear" }, kind: "price", price: price("poopBags") },
      ],
      ["shows none once the bank covers everything and nothing is new", 10_000, 10_000, null],
    ];
    for (const [, before, bank, expected] of cases) {
      expect(homeSticker(data, owned, dollars(before), dollars(bank))).toEqual(expected);
    }
  });
});
