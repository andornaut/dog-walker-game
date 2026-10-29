import { describe, expect, it } from "vitest";

import { DEBUFFS } from "../data/debuffs";
import { DOGS } from "../data/dogs";
import { DOG_SLOTS } from "../data/dogSlots";
import { ENCOUNTERS } from "../data/encounters";
import { HOME_TEXT } from "../data/homeText";
import { QUIPS } from "../data/quips";
import { SHOP_GEAR } from "../data/shop";
import type { DogId, GearId, LiveTuning } from "../data/types";
import { WORLD } from "../data/world";
import { keysOf } from "../lib/records";
import { cents } from "../lib/units";
import { price, unlockPrice } from "../rules/shop";
import { read, readTable } from "../rules/units";
import type { Owned } from "../save/schema";
import { defined } from "../testing/defined";
import { newPlayerSave, STARTER_DOGS } from "../testing/saves";
import { TEST_TUNING } from "../testing/tuning";
import {
  buy,
  type BuyResult,
  dogInfo,
  dollarAmountText,
  dollarText,
  gearByPrice,
  gearInfo,
  type HomeLoadout,
  type HomeTap,
  packCapacity,
  partingSpeech,
  type Purchase,
  purchasePrice,
  ROSTER_SIZES,
  rosterRows,
  shortDollarAmountText,
  signedDollarText,
  signedShortDollarText,
  tapDog,
  tapGear,
} from "./home";

const emptyLoadout: HomeLoadout = { dogs: [], gear: null };

const data = {
  debuffs: DEBUFFS,
  dogSlots: DOG_SLOTS,
  dogs: DOGS,
  encounters: ENCOUNTERS,
  homeText: HOME_TEXT,
  quips: QUIPS,
  shopGear: SHOP_GEAR,
  tuning: TEST_TUNING,
  world: WORLD,
} as const;
const owned: Owned = {
  dogSlots: [1, 2, 3],
  dogs: ["lady", "ginger", "kilo"],
  gear: ["fannyPack"],
  walkers: ["casey"],
};
const dollars = (amount: number) => cents(amount * 100);
const collarPrice = readTable(TEST_TUNING, "money", "prices", "luckyCollar");
// A dog slot's price, by number counting from 1.
const slotPrice = (slot: number) => unlockPrice(TEST_TUNING, DOG_SLOTS[slot - 1] ?? DOG_SLOTS[0]);

describe("money text", () => {
  it("shows cents in whole dollars with thousands separated, signed or not", () => {
    const cases: readonly [string, (amount: number) => string, number, string][] = [
      ["dollarText", (amount) => dollarText(cents(amount)), dollars(800), "$800"],
      ["dollarText", (amount) => dollarText(cents(amount)), dollars(1800), "$1,800"],
      ["dollarText", (amount) => dollarText(cents(amount)), 6_450, "$64"],
      ["dollarAmountText", (amount) => dollarAmountText(cents(amount)), dollars(1800), "1,800"],
      ["dollarAmountText", (amount) => dollarAmountText(cents(amount)), 4_299, "42"],
      ["signedDollarText", signedDollarText, dollars(240), "+$240"],
      ["signedDollarText", signedDollarText, -dollars(1200), "−$1,200"],
      ["signedDollarText", signedDollarText, -1_250, "−$12"],
      ["signedShortDollarText", signedShortDollarText, dollars(240), "+$240"],
      ["signedShortDollarText", signedShortDollarText, -dollars(1234), "−$1.2k"],
      ["signedShortDollarText", signedShortDollarText, 0, "$0"],
      ["signedShortDollarText", signedShortDollarText, 99, "$0"],
      ["signedShortDollarText", signedShortDollarText, -99, "$0"],
      ["signedShortDollarText", signedShortDollarText, 100, "+$1"],
    ];
    for (const [, text, amount, shown] of cases) {
      expect(text(amount)).toBe(shown);
    }
  });

  it("shortDollarAmountText shows cents at most three digits, rounded down", () => {
    const cases: readonly [number, string][] = [
      [4_299, "42"],
      [dollars(999), "999"],
      [dollars(1_000), "1k"],
      [dollars(1_234), "1.2k"],
      [dollars(12_345), "12k"],
      [dollars(999_999), "999k"],
      [dollars(1_000_000), "1M"],
      [dollars(1_234_567), "1.2M"],
      [dollars(123_456_789), "123M"],
      [dollars(1_234_567_890), "1.2B"],
      [dollars(12_345_678_901), "12B"],
      [dollars(123_456_789_012), "123B"],
      [Number.MAX_SAFE_INTEGER, "90T"],
    ];
    for (const [amount, shown] of cases) {
      expect(shortDollarAmountText(cents(amount))).toBe(shown);
    }
  });
});

describe("tapDog and tapGear", () => {
  it("picks and drops owned dogs and gear, refuses a dog past the slots and opens the shop on one not owned", () => {
    const cases: readonly { expected: HomeTap; name: string; tap: () => HomeTap }[] = [
      {
        expected: { kind: "loadout", loadout: { dogs: ["kilo", "ginger"], gear: null } },
        name: "adds an owned dog to the pack, in the order picked",
        tap: () => tapDog(data, owned, "ginger", { dogs: ["kilo"], gear: null }),
      },
      {
        expected: { kind: "loadout", loadout: { dogs: ["ginger"], gear: null } },
        name: "takes a picked dog back out of the pack",
        tap: () => tapDog(data, owned, "kilo", { dogs: ["kilo", "ginger"], gear: null }),
      },
      {
        expected: { kind: "full" },
        name: "refuses a dog past the slots owned",
        tap: () =>
          tapDog(data, { ...owned, dogSlots: [1, 3] }, "lady", {
            dogs: ["kilo", "ginger"],
            gear: null,
          }),
      },
      {
        expected: { kind: "loadout", loadout: { dogs: ["ginger"], gear: null } },
        name: "swaps the dog of a full one-slot pack",
        tap: () =>
          tapDog(data, { ...owned, dogSlots: [1] }, "ginger", { dogs: ["kilo"], gear: null }),
      },
      {
        expected: { kind: "shop", purchase: { dog: "reggie", kind: "dog" } },
        name: "opens the shop on a dog not owned yet, without touching the pack",
        tap: () => tapDog(data, owned, "reggie", emptyLoadout),
      },
      {
        expected: { kind: "loadout", loadout: { dogs: [], gear: "fannyPack" } },
        name: "pockets owned gear",
        tap: () => tapGear(owned, "fannyPack", emptyLoadout),
      },
      {
        expected: { kind: "loadout", loadout: { dogs: [], gear: null } },
        name: "empties the Pocket on a second tap",
        tap: () => tapGear(owned, "fannyPack", { dogs: [], gear: "fannyPack" }),
      },
      {
        expected: { kind: "shop", purchase: { gear: "luckyCollar", kind: "gear" } },
        name: "opens the shop on gear not owned yet",
        tap: () => tapGear(owned, "luckyCollar", emptyLoadout),
      },
    ];
    for (const { expected, tap } of cases) {
      expect(tap()).toEqual(expected);
    }
  });
});

describe("packCapacity", () => {
  it.each([
    ["the starting slot", [1], 1],
    ["slots bought in order", [1, 2], 2],
    ["a later slot bought first", [1, 3], 2],
    ["every slot", [1, 2, 3], 3],
  ])("holds one dog per slot owned, whichever they are: %s", (_, dogSlots, expected) => {
    expect(packCapacity(data, { dogSlots })).toBe(expected);
  });

  it("holds no more than a pack can, however many slots", () => {
    const max = read(TEST_TUNING, "counts", "packSizeMax");
    const many = Array.from({ length: max + 2 }, (_, i) => i + 1);
    expect(packCapacity(data, { dogSlots: many })).toBe(max);
  });
});

describe("gearByPrice", () => {
  const dataOrder = keysOf(SHOP_GEAR);
  const priceKey = (gear: GearId) => SHOP_GEAR[gear].price;
  const listPrice = (tuning: LiveTuning, gear: GearId) => price(tuning, priceKey(gear));
  const withGearPrices = (pick: (gear: GearId) => number): LiveTuning => ({
    ...TEST_TUNING,
    money: {
      ...TEST_TUNING.money,
      prices: {
        ...TEST_TUNING.money.prices,
        ...Object.fromEntries(dataOrder.map((gear) => [priceKey(gear), pick(gear)])),
      },
    },
  });
  const dollarPrices = dataOrder.map((gear) => TEST_TUNING.money.prices[priceKey(gear)]);
  const cheapest = dataOrder.reduce((a, b) =>
    listPrice(TEST_TUNING, b) < listPrice(TEST_TUNING, a) ? b : a,
  );
  const tunings: readonly [string, LiveTuning][] = [
    ["today's prices", TEST_TUNING],
    ["every gear item at one price", withGearPrices(() => Math.max(...dollarPrices))],
    [
      "the cheapest item retuned above the dearest",
      withGearPrices((gear) =>
        gear === cheapest
          ? Math.max(...dollarPrices) + 1
          : TEST_TUNING.money.prices[priceKey(gear)],
      ),
    ],
  ];

  it.each(tunings)(
    "lists every gear item once, cheapest first, ties in data order, at %s",
    (_, tuning) => {
      const order = gearByPrice({ shopGear: SHOP_GEAR, tuning });
      expect([...order].sort()).toEqual([...dataOrder].sort());
      order.slice(1).forEach((gear, i) => {
        const before = order[i] as GearId;
        const step = listPrice(tuning, gear) - listPrice(tuning, before);
        expect(step).toBeGreaterThanOrEqual(0);
        if (step === 0) {
          expect(dataOrder.indexOf(gear)).toBeGreaterThan(dataOrder.indexOf(before));
        }
      });
    },
  );
});

describe("rosterRows", () => {
  const dataOrder = keysOf(DOGS);
  const listPrice = (tuning: LiveTuning, dog: DogId) => unlockPrice(tuning, DOGS[dog]);
  const shopPrices = dataOrder.flatMap((dog) =>
    DOGS[dog].unlock === "start" ? [] : [DOGS[dog].price],
  );
  const dearest = Math.max(...shopPrices.map((key) => TEST_TUNING.money.prices[key]));
  const onePrice: LiveTuning = {
    ...TEST_TUNING,
    money: {
      ...TEST_TUNING.money,
      prices: {
        ...TEST_TUNING.money.prices,
        ...Object.fromEntries(shopPrices.map((key) => [key, dearest])),
      },
    },
  };
  const cases = (
    [
      ["today's prices", TEST_TUNING],
      ["every dog for sale at one price", onePrice],
    ] as const
  ).flatMap(([name, tuning]) =>
    ROSTER_SIZES.map((size, row) => [`${size} at ${name}`, tuning, size, row] as const),
  );

  it.each(cases)(
    "holds exactly the %s dogs, those for sale cheapest first with ties in data order, starters in the middle",
    (_, tuning, size, row) => {
      const dogs = rosterRows({ dogs: DOGS, tuning })[row] ?? [];
      expect([...dogs].sort()).toEqual(dataOrder.filter((dog) => DOGS[dog].size === size).sort());
      const forSale = dogs.filter((dog) => DOGS[dog].unlock !== "start");
      forSale.slice(1).forEach((dog, i) => {
        const before = forSale[i] as DogId;
        const step = listPrice(tuning, dog) - listPrice(tuning, before);
        expect(step).toBeGreaterThanOrEqual(0);
        if (step === 0) {
          expect(dataOrder.indexOf(dog)).toBeGreaterThan(dataOrder.indexOf(before));
        }
      });
      const starters = dogs.filter((dog) => DOGS[dog].unlock === "start");
      const first = Math.floor(forSale.length / 2);
      expect(dogs.slice(first, first + starters.length)).toEqual(starters);
    },
  );

  it.each([
    ["today's prices", TEST_TUNING],
    ["every dog for sale at one price", onePrice],
  ] as const)("puts the starting dog in the grid's centre cell at %s", (_, tuning) => {
    const rows = rosterRows({ dogs: DOGS, tuning });
    const middle = rows[Math.floor(rows.length / 2)] ?? [];
    expect(middle[Math.floor(middle.length / 2)]).toBe(
      dataOrder.find((dog) => DOGS[dog].unlock === "start"),
    );
  });
});

describe("purchasePrice", () => {
  it("prices what is for sale, and nothing owned or past the last slot", () => {
    const onlyFirst = { ...owned, dogSlots: [1] };
    const thirdFirst = { ...owned, dogSlots: [1, 3] };
    const slot = (number: number): Purchase => ({ kind: "dogSlot", slot: number });
    const cases: readonly [string, Owned, Purchase, number | null][] = [
      ["a locked dog", owned, { dog: "reggie", kind: "dog" }, dollars(600)],
      ["locked gear", owned, { gear: "luckyCollar", kind: "gear" }, collarPrice],
      ["slot 2 with only slot 1", onlyFirst, slot(2), slotPrice(2)],
      ["slot 3 with only slot 1", onlyFirst, slot(3), slotPrice(3)],
      ["slot 2 after slot 3", thirdFirst, slot(2), slotPrice(2)],
      ["an owned dog as not for sale", owned, { dog: "kilo", kind: "dog" }, null],
      ["owned gear as not for sale", owned, { gear: "fannyPack", kind: "gear" }, null],
      ["an owned slot as not for sale", thirdFirst, slot(3), null],
      ["no slot past the last", onlyFirst, slot(DOG_SLOTS.length + 1), null],
    ];
    for (const [, ownedNow, purchase, expected] of cases) {
      expect(purchasePrice(data, ownedNow, purchase)).toBe(expected);
    }
  });
});

describe("buy", () => {
  const start = newPlayerSave.owned;
  const outcome = (result: BuyResult) =>
    result.kind === "bought"
      ? { bankCents: result.save.bankCents, owned: result.save.owned }
      : result;

  it("takes the price from the bank for what is for sale, and refuses what it cannot cover", () => {
    const cases: readonly {
      bank: number;
      expected: ReturnType<typeof outcome>;
      name: string;
      purchase: Purchase;
    }[] = [
      {
        bank: 2_000,
        expected: {
          bankCents: dollars(1_400),
          owned: { ...start, dogs: [...start.dogs, "reggie"] },
        },
        name: "takes the price from the bank and adds a dog",
        purchase: { dog: "reggie", kind: "dog" },
      },
      {
        bank: collarPrice / 100 + 600,
        expected: { bankCents: dollars(600), owned: { ...start, gear: ["luckyCollar"] } },
        name: "adds gear",
        purchase: { gear: "luckyCollar", kind: "gear" },
      },
      ...DOG_SLOTS.flatMap((_, i) => {
        const slot = i + 1;
        const cost = slotPrice(slot) / 100;
        const purchase: Purchase = { kind: "dogSlot", slot };
        return start.dogSlots.includes(slot)
          ? []
          : [
              {
                bank: cost + 200,
                expected: { bankCents: dollars(200), owned: { ...start, dogSlots: [1, slot] } },
                name: `adds dog slot ${slot} on its own`,
                purchase,
              },
              {
                bank: cost,
                expected: { bankCents: cents(0), owned: { ...start, dogSlots: [1, slot] } },
                name: `buys dog slot ${slot} with exactly its price in the bank`,
                purchase,
              },
              {
                bank: cost - 1,
                expected: { kind: "refused", reason: "cantAfford" } as const,
                name: `refuses dog slot ${slot} when the bank cannot cover it`,
                purchase,
              },
            ];
      }),
      {
        bank: 2_000,
        expected: { kind: "refused", reason: "notForSale" },
        name: "refuses what is not for sale",
        purchase: { dog: defined(STARTER_DOGS[0]), kind: "dog" },
      },
    ];
    for (const { bank, expected, purchase } of cases) {
      expect(outcome(buy(data, purchase, { ...newPlayerSave, bankCents: dollars(bank) }))).toEqual(
        expected,
      );
    }
  });

  // Every order the slots for sale can be bought in.
  const forSale = DOG_SLOTS.map((_, i) => i + 1).filter((slot) => !start.dogSlots.includes(slot));
  const orders = (slots: readonly number[]): number[][] =>
    slots.length <= 1
      ? [[...slots]]
      : slots.flatMap((first) =>
          orders(slots.filter((slot) => slot !== first)).map((rest) => [first, ...rest]),
        );

  it.each(orders(forSale).map((order) => [order.join(" then "), order] as const))(
    "buys the slots for sale in any order (%s), paying each its own price",
    (_, order) => {
      const total = order.reduce((sum, slot) => sum + slotPrice(slot), 0);
      let save = { ...newPlayerSave, bankCents: cents(total) };
      order.forEach((slot, i) => {
        const result = buy(data, { kind: "dogSlot", slot }, save);
        expect(result.kind).toBe("bought");
        save = result.kind === "bought" ? result.save : save;
        expect(packCapacity(data, save.owned)).toBe(start.dogSlots.length + i + 1);
      });
      expect(save.bankCents).toBe(0);
      expect(save.owned.dogSlots).toEqual(DOG_SLOTS.map((_, i) => i + 1));
    },
  );
});

describe("partingSpeech", () => {
  it.each([
    [0, 0],
    [0.99, 1],
  ])("says the owner's parting line for a draw of %d, without their name", (draw, index) => {
    expect(partingSpeech(data, () => draw, "kilo")).toBe(QUIPS.kilo.parting[index]);
  });
});

describe("dogInfo and gearInfo", () => {
  it("describes dogs and gear, with a locked one's price and what the bank still needs", () => {
    const cases: readonly [string, () => string, RegExp][] = [
      [
        "describes an owned dog in words, with its size, hearts and pay",
        () => dogInfo(data, owned, cents(0), "kilo"),
        new RegExp(`^${DOGS.kilo.name}: ${DOGS.kilo.size}, \\d+♥\\.$`),
      ],
      [
        "adds a locked dog's price and how much more the bank needs",
        () => dogInfo(data, owned, dollars(100), "reggie"),
        /\$600: need \$500 more\.$/,
      ],
      [
        "offers a locked dog the bank can cover",
        () => dogInfo(data, owned, dollars(600), "reggie"),
        /\$600: tap to buy\.$/,
      ],
      [
        "says what owned gear does",
        () => gearInfo(data, owned, cents(0), "fannyPack"),
        /^Fanny pack: .+\.$/,
      ],
      [
        "adds locked gear's price",
        () => gearInfo(data, owned, cents(0), "luckyCollar"),
        new RegExp(`\\${dollarText(collarPrice)}: need \\${dollarText(collarPrice)} more\\.$`),
      ],
    ];
    for (const [, line, pattern] of cases) {
      expect(line()).toMatch(pattern);
    }
  });
});
