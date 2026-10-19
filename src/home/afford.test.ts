import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { cents } from "../rules/units";
import type { LastWalk, Owned } from "../save/schema";
import { TEST_TUNING } from "../testing/tuning";
import { bankAtLastVisit, isAffordable, newlyAffordable, purchases } from "./afford";

const data = { ...gameData, tuning: TEST_TUNING };
const dollars = (amount: number) => cents(amount * 100);
const owned: Owned = { dogSlots: 1, dogs: ["biscuit", "duchess", "koda"], gear: [] };
const walk = (earned: number): LastWalk => ({
  dogs: ["koda"],
  earnedCents: dollars(earned),
  firings: [],
  outcome: "finished",
  zonesFinished: 4,
});

describe("isAffordable", () => {
  it("holds for an item for sale at or under the bank", () => {
    expect(isAffordable(data, owned, dollars(600), { dog: "dash", kind: "dog" })).toBe(true);
    expect(isAffordable(data, owned, dollars(599), { dog: "dash", kind: "dog" })).toBe(false);
    expect(isAffordable(data, owned, dollars(800), { kind: "dogSlot" })).toBe(true);
  });

  it("never holds for an owned dog or a maxed-out slot", () => {
    const rich = dollars(100_000);
    expect(isAffordable(data, owned, rich, { dog: "koda", kind: "dog" })).toBe(false);
    expect(isAffordable(data, { ...owned, dogSlots: 3 }, rich, { kind: "dogSlot" })).toBe(false);
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
  it("holds when the bank crosses a price it was under", () => {
    expect(newlyAffordable(data, owned, dollars(500), dollars(650))).toBe(true);
  });

  it("does not hold when everything covered now was covered before", () => {
    expect(newlyAffordable(data, owned, dollars(610), dollars(650))).toBe(false);
    expect(newlyAffordable(data, owned, dollars(650), dollars(500))).toBe(false);
  });
});

describe("bankAtLastVisit", () => {
  it("prefers the bank remembered this session", () => {
    expect(bankAtLastVisit(dollars(100), dollars(900), walk(500))).toBe(dollars(100));
  });

  it("else takes the last walk's pay off the bank, never below zero", () => {
    expect(bankAtLastVisit(undefined, dollars(900), walk(500))).toBe(dollars(400));
    expect(bankAtLastVisit(undefined, dollars(100), walk(500))).toBe(dollars(0));
  });

  it("is the bank itself before any walk", () => {
    expect(bankAtLastVisit(undefined, dollars(300), null)).toBe(dollars(300));
  });
});
