import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { cents } from "../rules/units";
import type { LastWalk, Owned } from "../save/schema";
import { TEST_TUNING } from "../testing/tuning";
import { bankAtLastVisit, newlyAffordable } from "./afford";
import { isAffordable, type Purchase } from "./home";

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
  it("holds for what the bank covers, never for what is owned or maxed out", () => {
    const cases: readonly [string, Owned, number, Purchase, boolean][] = [
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
    ];
    for (const [, ownedNow, bank, purchase, expected] of cases) {
      expect(isAffordable(data, ownedNow, dollars(bank), purchase)).toBe(expected);
    }
  });
});

describe("newlyAffordable", () => {
  it("holds only when the bank crosses a price it was under", () => {
    for (const [, before, now, expected] of [
      ["holds when the bank crosses a price it was under", 500, 650, true],
      ["does not hold when the bank was already over every price it covers", 610, 650, false],
      ["does not hold when the bank fell", 650, 500, false],
    ] as const) {
      expect(newlyAffordable(data, owned, dollars(before), dollars(now))).toBe(expected);
    }
  });
});

describe("bankAtLastVisit", () => {
  it("prefers the remembered bank, else takes the last walk off the bank, never below zero", () => {
    const cases: readonly [string, number | undefined, number, LastWalk | null, number][] = [
      ["prefers the bank remembered this session", 100, 900, walk(500), 100],
      ["else takes the last walk's pay off the bank", undefined, 900, walk(500), 400],
      ["never goes below zero", undefined, 100, walk(500), 0],
      ["is the bank itself before any walk", undefined, 300, null, 300],
    ];
    for (const [, remembered, bank, lastWalk, expected] of cases) {
      expect(
        bankAtLastVisit(
          remembered === undefined ? undefined : dollars(remembered),
          dollars(bank),
          lastWalk,
        ),
      ).toBe(dollars(expected));
    }
  });
});
