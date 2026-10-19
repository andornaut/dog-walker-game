import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { cents } from "../rules/units";
import type { LastWalk, Owned } from "../save/schema";
import { TEST_TUNING } from "../testing/tuning";
import { bankAtLastVisit, isAffordable, newlyAffordable, purchases } from "./afford";
import type { Purchase } from "./home";

const data = { ...gameData, tuning: TEST_TUNING };
const dollars = (amount: number) => cents(amount * 100);
const owned: Owned = {
  dogSlots: 1,
  dogs: ["biscuit", "duchess", "koda"],
  gear: [],
  walkers: ["casey"],
};
const walk = (earned: number): LastWalk => ({
  dogs: ["koda"],
  earnedCents: dollars(earned),
  firings: [],
  outcome: "finished",
  route: ["street", "park", "shops", "homeStretch"],
  zonesFinished: 4,
});

describe("isAffordable", () => {
  it.each<[string, Owned, number, Purchase, boolean]>([
    ["holds for a dog priced at the bank", owned, 600, { dog: "archie", kind: "dog" }, true],
    ["fails for a dog priced over the bank", owned, 599, { dog: "archie", kind: "dog" }, false],
    ["holds for the next slot priced at the bank", owned, 800, { kind: "dogSlot" }, true],
    ["never holds for an owned dog", owned, 100_000, { dog: "koda", kind: "dog" }, false],
    [
      "never holds for a maxed-out slot",
      { ...owned, dogSlots: 3 },
      100_000,
      { kind: "dogSlot" },
      false,
    ],
  ])("%s", (_name, ownedNow, bank, purchase, expected) => {
    expect(isAffordable(data, ownedNow, dollars(bank), purchase)).toBe(expected);
  });
});

describe("purchases", () => {
  it("lists every dog, every gear item and the slot", () => {
    const all = purchases(data);
    const items = Object.keys(data.dogs).length + Object.keys(data.shopGear).length;
    expect(all).toHaveLength(items + 1);
    expect(all).toContainEqual({ kind: "dogSlot" });
  });
});

describe("newlyAffordable", () => {
  it.each([
    ["holds when the bank crosses a price it was under", 500, 650, true],
    ["does not hold when the bank was already over every price it covers", 610, 650, false],
    ["does not hold when the bank fell", 650, 500, false],
  ])("%s", (_name, before, now, expected) => {
    expect(newlyAffordable(data, owned, dollars(before), dollars(now))).toBe(expected);
  });
});

describe("bankAtLastVisit", () => {
  it.each<[string, number | undefined, number, LastWalk | null, number]>([
    ["prefers the bank remembered this session", 100, 900, walk(500), 100],
    ["else takes the last walk's pay off the bank", undefined, 900, walk(500), 400],
    ["never goes below zero", undefined, 100, walk(500), 0],
    ["is the bank itself before any walk", undefined, 300, null, 300],
  ])("%s", (_name, remembered, bank, lastWalk, expected) => {
    expect(
      bankAtLastVisit(
        remembered === undefined ? undefined : dollars(remembered),
        dollars(bank),
        lastWalk,
      ),
    ).toBe(dollars(expected));
  });
});
