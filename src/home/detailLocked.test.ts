import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { cents } from "../rules/units";
import type { Owned } from "../save/schema";
import { TEST_TUNING } from "../testing/tuning";
import { dogDetail, gearDetail } from "./detail";

const data = { ...gameData, tuning: TEST_TUNING };
const owned: Owned = {
  dogSlots: [1],
  dogs: ["biscuit", "duchess", "kilo"],
  gear: ["luckyCollar"],
  walkers: ["casey"],
};
const loadout = { dogs: [], gear: null };

describe("a detail card's locked status", () => {
  it("locks a dog or gear item not owned that the bank cannot cover", () => {
    for (const { card, locked } of [
      { bank: 0, card: () => dogDetail(data, owned, cents(0), "kilo"), locked: false },
      { bank: 0, card: () => dogDetail(data, owned, cents(0), "reggie"), locked: true },
      {
        bank: 1_000_000,
        card: () => dogDetail(data, owned, cents(1_000_000), "reggie"),
        locked: false,
      },
      {
        bank: 0,
        card: () => gearDetail(data, owned, cents(0), loadout, "fannyPack"),
        locked: true,
      },
      {
        bank: 0,
        card: () => gearDetail(data, owned, cents(0), loadout, "luckyCollar"),
        locked: false,
      },
    ]) {
      expect(card().locked).toBe(locked);
    }
  });
});
