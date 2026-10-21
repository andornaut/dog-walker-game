import { describe, expect, it } from "vitest";

import { DEBUFFS } from "../data/debuffs";
import { DOGS } from "../data/dogs";
import { DOG_SLOTS } from "../data/dogSlots";
import { ENCOUNTERS } from "../data/encounters";
import { HOME_TEXT } from "../data/homeText";
import { QUIPS } from "../data/quips";
import { SHOP_GEAR } from "../data/shop";
import type { ZoneId } from "../data/types";
import { WORLD } from "../data/world";
import { cents, readTable } from "../rules/units";
import { newPlayerSave, veteranSave } from "../save/fixtures";
import type { LastWalk, Owned } from "../save/schema";
import { TEST_TUNING } from "../testing/tuning";
import { fillNames } from "../text/lines";
import {
  buy,
  type BuyResult,
  dogInfo,
  dogNames,
  dollarAmountText,
  dollarText,
  gearInfo,
  type HomeLoadout,
  type HomeTap,
  lastWalkLine,
  logbookOf,
  packCapacity,
  packOf,
  partingSpeech,
  type Purchase,
  purchasePrice,
  shortDollarAmountText,
  signedDollarText,
  tapDog,
  tapGear,
} from "./home";

const emptyLoadout: HomeLoadout = { dogs: [], gear: null };
const zoneName = (id: ZoneId) => WORLD.zones.find((zone) => zone.id === id)?.name;

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
  dogSlots: 3,
  dogs: ["biscuit", "duchess", "koda"],
  gear: ["fannyPack"],
  walkers: ["casey"],
};
const dollars = (amount: number) => cents(amount * 100);
const collarPrice = readTable(TEST_TUNING, "money", "prices", "luckyCollar");

describe("money text", () => {
  it.each<[string, (amount: number) => string, number, string]>([
    ["dollarText", (amount) => dollarText(cents(amount)), dollars(800), "$800"],
    ["dollarText", (amount) => dollarText(cents(amount)), dollars(1800), "$1,800"],
    ["dollarText", (amount) => dollarText(cents(amount)), 6_450, "$64"],
    ["dollarAmountText", (amount) => dollarAmountText(cents(amount)), dollars(1800), "1,800"],
    ["dollarAmountText", (amount) => dollarAmountText(cents(amount)), 4_299, "42"],
    ["signedDollarText", signedDollarText, dollars(240), "+$240"],
    ["signedDollarText", signedDollarText, -dollars(1200), "−$1,200"],
    ["signedDollarText", signedDollarText, -1_250, "−$12"],
  ])(
    "%s shows %i cents as %s, in whole dollars with thousands separated",
    (_, text, amount, shown) => {
      expect(text(amount)).toBe(shown);
    },
  );

  it.each<[number, string]>([
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
  ])(
    "shortDollarAmountText shows %i cents as %s, at most three digits rounded down",
    (amount, shown) => {
      expect(shortDollarAmountText(cents(amount))).toBe(shown);
    },
  );
});

describe("tapDog and tapGear", () => {
  it.each<{ expected: HomeTap; name: string; tap: () => HomeTap }>([
    {
      expected: { kind: "loadout", loadout: { dogs: ["koda", "duchess"], gear: null } },
      name: "adds an owned dog to the pack, in the order picked",
      tap: () => tapDog(data, owned, "duchess", { dogs: ["koda"], gear: null }),
    },
    {
      expected: { kind: "loadout", loadout: { dogs: ["duchess"], gear: null } },
      name: "takes a picked dog back out of the pack",
      tap: () => tapDog(data, owned, "koda", { dogs: ["koda", "duchess"], gear: null }),
    },
    {
      expected: { kind: "full" },
      name: "refuses a dog past the slots owned",
      tap: () =>
        tapDog(data, { ...owned, dogSlots: 2 }, "biscuit", {
          dogs: ["koda", "duchess"],
          gear: null,
        }),
    },
    {
      expected: { kind: "loadout", loadout: { dogs: ["duchess"], gear: null } },
      name: "swaps the dog of a full one-slot pack",
      tap: () => tapDog(data, { ...owned, dogSlots: 1 }, "duchess", { dogs: ["koda"], gear: null }),
    },
    {
      expected: { kind: "shop", purchase: { dog: "nugget", kind: "dog" } },
      name: "opens the shop on a dog not owned yet, without touching the pack",
      tap: () => tapDog(data, owned, "nugget", emptyLoadout),
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
  ])("$name", ({ expected, tap }) => {
    expect(tap()).toEqual(expected);
  });
});

describe("packCapacity", () => {
  it("holds one dog per slot, and no more than a pack can, however many slots", () => {
    expect(packCapacity(data, { dogSlots: 1 })).toBe(1);
    expect(packCapacity(data, { dogSlots: 9 })).toBe(3);
  });
});

describe("purchasePrice", () => {
  it.each<[string, Owned, Purchase, number | null]>([
    ["a locked dog", owned, { dog: "nugget", kind: "dog" }, dollars(600)],
    ["locked gear", owned, { gear: "luckyCollar", kind: "gear" }, collarPrice],
    ["the second dog slot", { ...owned, dogSlots: 1 }, { kind: "dogSlot" }, dollars(800)],
    ["the third dog slot", { ...owned, dogSlots: 2 }, { kind: "dogSlot" }, dollars(1800)],
    ["an owned dog as not for sale", owned, { dog: "koda", kind: "dog" }, null],
    ["owned gear as not for sale", owned, { gear: "fannyPack", kind: "gear" }, null],
    ["no slot past the last", owned, { kind: "dogSlot" }, null],
  ])("prices %s", (_name, ownedNow, purchase, expected) => {
    expect(purchasePrice(data, ownedNow, purchase)).toBe(expected);
  });
});

describe("buy", () => {
  const start = newPlayerSave.owned;
  const outcome = (result: BuyResult) =>
    result.kind === "bought"
      ? { bankCents: result.save.bankCents, owned: result.save.owned }
      : result;

  it.each<{
    bank: number;
    expected: ReturnType<typeof outcome>;
    name: string;
    purchase: Purchase;
  }>([
    {
      bank: 2_000,
      expected: {
        bankCents: dollars(1_400),
        owned: { ...start, dogs: [...start.dogs, "nugget"] },
      },
      name: "takes the price from the bank and adds a dog",
      purchase: { dog: "nugget", kind: "dog" },
    },
    {
      bank: collarPrice / 100 + 600,
      expected: { bankCents: dollars(600), owned: { ...start, gear: ["luckyCollar"] } },
      name: "adds gear",
      purchase: { gear: "luckyCollar", kind: "gear" },
    },
    {
      bank: 2_000,
      expected: { bankCents: dollars(1_200), owned: { ...start, dogSlots: 2 } },
      name: "adds a dog slot",
      purchase: { kind: "dogSlot" },
    },
    {
      bank: 800,
      expected: { bankCents: cents(0), owned: { ...start, dogSlots: 2 } },
      name: "buys with exactly the price in the bank",
      purchase: { kind: "dogSlot" },
    },
    {
      bank: 799,
      expected: { kind: "refused", reason: "cantAfford" },
      name: "refuses what the bank cannot cover",
      purchase: { kind: "dogSlot" },
    },
    {
      bank: 2_000,
      expected: { kind: "refused", reason: "notForSale" },
      name: "refuses what is not for sale",
      purchase: { dog: "biscuit", kind: "dog" },
    },
  ])("$name", ({ bank, expected, purchase }) => {
    expect(outcome(buy(data, purchase, { ...newPlayerSave, bankCents: dollars(bank) }))).toEqual(
      expected,
    );
  });
});

describe("packOf", () => {
  it("is undefined with no dogs, and the dogs in order otherwise", () => {
    expect(packOf(emptyLoadout)).toBeUndefined();
    expect(packOf({ dogs: ["koda", "biscuit"], gear: null })).toEqual(["koda", "biscuit"]);
  });
});

describe("dogNames", () => {
  it("joins names for a sentence", () => {
    expect(dogNames(data, [])).toBe("");
    expect(dogNames(data, ["koda"])).toBe("Koda");
    expect(dogNames(data, ["koda", "biscuit", "duchess"])).toBe("Koda, Biscuit and Duchess");
  });
});

describe("lastWalkLine", () => {
  const walk: LastWalk = {
    dogs: ["koda"],
    earnedCents: cents(6_400),
    firings: [],
    outcome: "wentHome",
    route: ["street", "park"],
    zonesFinished: 1,
  };

  it.each<{ changes: Partial<LastWalk>; expected: string; name: string }>([
    {
      changes: {},
      expected: `+$64. Headed home from ${zoneName("park")}.`,
      name: "names the zone the walk headed home from",
    },
    {
      changes: { firings: [{ dog: "koda", zone: 1 }], outcome: "noDogs" },
      expected: `+$64. Jesse fired you on ${zoneName("street")}.`,
      name: "names the owner who fired you and where",
    },
    {
      changes: { route: ["street"] },
      expected: `+$64. Headed home from ${WORLD.name}.`,
      name: "names a zone the walk never picked as the world",
    },
    {
      changes: { outcome: "finished", zonesFinished: 4 },
      expected: fillNames(HOME_TEXT.logbook.lastFinished, {
        earned: "+$64.",
        world: WORLD.name,
        zones: "4",
      }),
      name: "counts the zones a finished walk walked",
    },
  ])("$name", ({ changes, expected }) => {
    expect(lastWalkLine(data, { ...walk, ...changes })).toBe(expected);
  });
});

describe("logbookOf", () => {
  it("is null before the first walk", () => {
    expect(logbookOf(data, newPlayerSave.stats)).toBeNull();
  });

  it("shows the best walk, totals and the last walk", () => {
    expect(logbookOf(data, veteranSave().stats)).toEqual({
      best: "$90",
      bestNote: fillNames(HOME_TEXT.logbook.bestNote, {
        dogs: "Koda and Penny",
        zones: fillNames(HOME_TEXT.logbook.zoneMany, { count: "4" }),
      }),
      last: `+$25. Jesse fired you on ${zoneName("park")}.`,
      totals: fillNames(HOME_TEXT.logbook.totals, { dogs: "7", fired: "1", walks: "5" }),
    });
  });
});

describe("partingSpeech", () => {
  it("names the owner, then one of their parting lines", () => {
    expect(partingSpeech(data, () => 0, "koda")).toBe(`Jesse: ${QUIPS.koda.parting[0]}`);
    expect(partingSpeech(data, () => 0.99, "koda")).toBe(`Jesse: ${QUIPS.koda.parting[1]}`);
  });
});

describe("dogInfo and gearInfo", () => {
  it.each<[string, () => string, RegExp]>([
    [
      "describes an owned dog in words, with its size, hearts and pay",
      () => dogInfo(data, owned, cents(0), "koda"),
      new RegExp(`^${DOGS.koda.name}: ${DOGS.koda.size}, \\d+♥, \\$\\d+ a neighborhood\\.$`),
    ],
    [
      "adds a locked dog's price and how much more the bank needs",
      () => dogInfo(data, owned, dollars(100), "nugget"),
      /\$600: need \$500 more\.$/,
    ],
    [
      "offers a locked dog the bank can cover",
      () => dogInfo(data, owned, dollars(600), "nugget"),
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
  ])("%s", (_name, line, pattern) => {
    expect(line()).toMatch(pattern);
  });
});
