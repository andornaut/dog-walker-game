import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { cents } from "../rules/units";
import type { Owned } from "../save/schema";
import { TEST_TUNING } from "../testing/tuning";
import { homeSticker, type Sticker } from "./sticker";

const data = { ...gameData, tuning: TEST_TUNING };
const dollars = (amount: number) => cents(amount * 100);
const owned: Owned = { dogSlots: 1, dogs: ["biscuit", "duchess", "koda"], gear: [] };

// Under the test tuning the fanny pack is $400, the whistle and every locked dog $600, poop
// bags $700 and the lucky collar $1,000.
describe("homeSticker", () => {
  it.each<[string, number, number, Sticker | null]>([
    [
      "prices the cheapest locked item out of reach",
      0,
      0,
      { item: { gear: "fannyPack", kind: "gear" }, kind: "price", price: dollars(400) },
    ],
    [
      "marks an item the bank has just come to cover as new",
      0,
      450,
      { item: { gear: "fannyPack", kind: "gear" }, kind: "new", price: dollars(400) },
    ],
    [
      "puts new on the first newly covered item in the shop's order",
      450,
      650,
      { item: { dog: "archie", kind: "dog" }, kind: "new", price: dollars(600) },
    ],
    [
      "prices the next item once nothing is new",
      650,
      650,
      { item: { gear: "poopBags", kind: "gear" }, kind: "price", price: dollars(700) },
    ],
    ["shows none once the bank covers everything and nothing is new", 10_000, 10_000, null],
  ])("%s", (_name, before, bank, expected) => {
    expect(homeSticker(data, owned, dollars(before), dollars(bank))).toEqual(expected);
  });
});
