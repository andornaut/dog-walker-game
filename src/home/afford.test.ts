import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { unlockPrice } from "../rules/shop";
import { cents } from "../rules/units";
import type { LastWalk, Owned } from "../save/schema";
import { TEST_TUNING } from "../testing/tuning";
import { bankAtLastVisit, newlyAffordable } from "./afford";
import { isAffordable, type Purchase } from "./home";

const data = { ...gameData, tuning: TEST_TUNING };
const dollars = (amount: number) => cents(amount * 100);
const owned: Owned = {
  dogSlots: [1],
  dogs: ["biscuit", "duchess", "kilo"],
  gear: [],
  walkers: ["casey"],
};
const walk = (earned: number): LastWalk => ({
  dogs: ["kilo"],
  earnedCents: dollars(earned),
  firings: [],
  outcome: "finished",
  route: ["street", "park", "shops", "homeStretch"],
  zonesFinished: 4,
});

describe("isAffordable", () => {
  it("holds for what the bank covers, never for what is owned", () => {
    // Each slot not owned, at its own price, whichever others are owned.
    const slots = data.dogSlots.flatMap((slot, i): [string, Owned, number, Purchase, boolean][] => {
      const purchase: Purchase = { kind: "dogSlot", slot: i + 1 };
      const cost = unlockPrice(data.tuning, slot) / 100;
      return owned.dogSlots.includes(i + 1)
        ? []
        : [
            [`holds for slot ${i + 1} priced at the bank`, owned, cost, purchase, true],
            [`fails for slot ${i + 1} priced over the bank`, owned, cost - 1, purchase, false],
          ];
    });
    const cases: readonly [string, Owned, number, Purchase, boolean][] = [
      ["holds for a dog priced at the bank", owned, 600, { dog: "archie", kind: "dog" }, true],
      ["fails for a dog priced over the bank", owned, 599, { dog: "archie", kind: "dog" }, false],
      ...slots,
      ["never holds for an owned dog", owned, 100_000, { dog: "kilo", kind: "dog" }, false],
      [
        "never holds for an owned slot",
        { ...owned, dogSlots: [1, 3] },
        100_000,
        { kind: "dogSlot", slot: 3 },
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
