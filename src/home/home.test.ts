import { describe, expect, it } from "vitest";

import { DEBUFFS } from "../data/debuffs";
import { DOGS } from "../data/dogs";
import { DOG_SLOTS } from "../data/dogSlots";
import { ENCOUNTERS } from "../data/encounters";
import { HOME_TEXT } from "../data/homeText";
import { NEEDS } from "../data/needs";
import { QUIPS } from "../data/quips";
import { SHOP_GEAR } from "../data/shop";
import { WORLD } from "../data/world";
import { cents } from "../rules/units";
import { newPlayerSave, veteranSave } from "../save/fixtures";
import type { LastWalk, Owned } from "../save/schema";
import { TEST_TUNING } from "../testing/tuning";
import {
  buy,
  type BuyResult,
  dogInfo,
  dogNames,
  dollarText,
  gearInfo,
  type HomeLoadout,
  type HomeTap,
  lastWalkLine,
  logbookOf,
  packCapacity,
  packFeePerZone,
  packOf,
  partingSpeech,
  type Purchase,
  purchasePrice,
  tapDog,
  tapGear,
  wrapWords,
} from "./home";

const emptyLoadout: HomeLoadout = { dogs: [], gear: null };

const data = {
  debuffs: DEBUFFS,
  dogSlots: DOG_SLOTS,
  dogs: DOGS,
  encounters: ENCOUNTERS,
  homeText: HOME_TEXT,
  needs: NEEDS,
  quips: QUIPS,
  shopGear: SHOP_GEAR,
  tuning: TEST_TUNING,
  world: WORLD,
} as const;
const owned: Owned = {
  dogSlots: 3,
  dogs: ["biscuit", "duchess", "koda"],
  gear: ["fannyPack"],
};
const dollars = (amount: number) => cents(amount * 100);

describe("dollarText", () => {
  it("shows whole dollars with thousands separated", () => {
    expect(dollarText(dollars(800))).toBe("$800");
    expect(dollarText(dollars(1800))).toBe("$1,800");
    expect(dollarText(cents(6_450))).toBe("$64");
  });
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
      tap: () => tapDog(data, { ...owned, dogSlots: 1 }, "duchess", { dogs: ["koda"], gear: null }),
    },
    {
      expected: { kind: "buy", purchase: { dog: "nugget", kind: "dog" } },
      name: "asks to buy a dog not owned yet, without touching the pack",
      tap: () => tapDog(data, owned, "nugget", emptyLoadout),
    },
    {
      expected: { kind: "loadout", loadout: { dogs: [], gear: "fannyPack" } },
      name: "equips owned gear",
      tap: () => tapGear(owned, "fannyPack", emptyLoadout),
    },
    {
      expected: { kind: "loadout", loadout: { dogs: [], gear: null } },
      name: "unequips gear on a second tap",
      tap: () => tapGear(owned, "fannyPack", { dogs: [], gear: "fannyPack" }),
    },
    {
      expected: { kind: "buy", purchase: { gear: "whistle", kind: "gear" } },
      name: "asks to buy gear not owned yet",
      tap: () => tapGear(owned, "whistle", emptyLoadout),
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
    ["locked gear", owned, { gear: "whistle", kind: "gear" }, dollars(600)],
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
        owned: { ...start, dogs: ["biscuit", "duchess", "koda", "nugget"] },
      },
      name: "takes the price from the bank and adds a dog",
      purchase: { dog: "nugget", kind: "dog" },
    },
    {
      bank: 2_000,
      expected: { bankCents: dollars(1_400), owned: { ...start, gear: ["whistle"] } },
      name: "adds gear",
      purchase: { gear: "whistle", kind: "gear" },
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
      purchase: { dog: "koda", kind: "dog" },
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

describe("packFeePerZone", () => {
  it("adds up each picked dog's fee", () => {
    expect(packFeePerZone(data, { dogs: ["koda", "pierre"], gear: null })).toBe(2300);
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
      expected: "+$64. Headed home from Bark Park.",
      name: "names the zone the walk headed home from",
    },
    {
      changes: { firings: [{ dog: "koda", zone: 1 }], outcome: "noDogs" },
      expected: "+$64. Jesse fired you on Woof Way.",
      name: "names the owner who fired you and where",
    },
    {
      changes: { route: ["street"] },
      expected: "+$64. Headed home from Maple Street.",
      name: "names a zone the walk never picked as the world",
    },
    {
      changes: { outcome: "finished", zonesFinished: 4 },
      expected: "+$64. Walked 4 zones of Maple Street.",
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
      bestNote: "4 zones with Koda and Penny",
      last: "+$25. Jesse fired you on Bark Park.",
      totals: "Walks 5   Dogs walked 7   Fired 1",
    });
  });
});

describe("wrapWords", () => {
  it.each<[string, number, string, string[]]>([
    [
      "breaks between words, keeping each line within the width",
      12,
      "He already did 10K. He's fine.",
      ["He already", "did 10K.", "He's fine."],
    ],
    [
      "gives a word longer than the width a line of its own",
      4,
      "a supercalifragilistic b",
      ["a", "supercalifragilistic", "b"],
    ],
  ])("%s", (_name, width, text, expected) => {
    expect(wrapWords(width, text)).toEqual(expected);
  });
});

describe("partingSpeech", () => {
  it("names the owner, then one of their parting lines", () => {
    expect(partingSpeech(data, () => 0, 80, "koda")).toEqual([`Jesse: ${QUIPS.koda.parting[0]}`]);
    expect(partingSpeech(data, () => 0.99, 80, "koda")).toEqual([
      `Jesse: ${QUIPS.koda.parting[1]}`,
    ]);
  });
});

describe("dogInfo and gearInfo", () => {
  it.each<[string, () => string, RegExp]>([
    [
      "describes an owned dog in words, with its fee",
      () => dogInfo(data, owned, cents(0), "koda"),
      /^Koda: big chaser, \$\d+ a zone\. Jesse is laid-back\.$/,
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
      () => gearInfo(data, owned, cents(0), "whistle"),
      /\$600: need \$600 more\.$/,
    ],
  ])("%s", (_name, line, pattern) => {
    expect(line()).toMatch(pattern);
  });
});
