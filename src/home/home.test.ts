import { describe, expect, it } from "vitest";

import { DEBUFFS } from "../data/debuffs";
import { DOGS } from "../data/dogs";
import { DOG_SLOTS } from "../data/dogSlots";
import { ENCOUNTERS } from "../data/encounters";
import { QUIPS } from "../data/quips";
import { SHOP_GEAR } from "../data/shop";
import { WORLD } from "../data/world";
import { cents } from "../rules/units";
import { newPlayerSave, veteranSave } from "../save/fixtures";
import type { LastWalk, Owned } from "../save/schema";
import { TEST_TUNING } from "../testing/tuning";
import {
  buy,
  dogInfo,
  dogNames,
  dollarText,
  emptyLoadout,
  gearInfo,
  type HomeTap,
  lastWalkLine,
  logbookOf,
  packCapacity,
  packFeePerZone,
  packOf,
  partingSpeech,
  purchasePrice,
  tapDog,
  tapGear,
  wrapWords,
} from "./home";

const data = {
  debuffs: DEBUFFS,
  dogSlots: DOG_SLOTS,
  dogs: DOGS,
  encounters: ENCOUNTERS,
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
const loadoutOf = (tap: HomeTap) => (tap.kind === "loadout" ? tap.loadout : undefined);
const dollars = (amount: number) => cents(amount * 100);

describe("dollarText", () => {
  it("shows whole dollars with thousands separated", () => {
    expect(dollarText(dollars(800))).toBe("$800");
    expect(dollarText(dollars(1800))).toBe("$1,800");
    expect(dollarText(cents(6_450))).toBe("$64");
  });
});

describe("tapDog", () => {
  it("adds an owned dog to the pack, in the order picked", () => {
    const one = loadoutOf(tapDog(data, owned, "koda", emptyLoadout));
    expect(loadoutOf(tapDog(data, owned, "duchess", one ?? emptyLoadout))?.dogs).toEqual([
      "koda",
      "duchess",
    ]);
  });

  it("takes a picked dog back out of the pack", () => {
    const loadout = { dogs: ["koda", "duchess"] as const, gear: null };
    expect(loadoutOf(tapDog(data, owned, "koda", loadout))?.dogs).toEqual(["duchess"]);
  });

  it("refuses a dog past the slots owned", () => {
    const full = { dogs: ["koda"] as const, gear: null };
    expect(tapDog(data, { ...owned, dogSlots: 1 }, "duchess", full)).toEqual({ kind: "full" });
  });

  it("asks to buy a dog not owned yet, without touching the pack", () => {
    expect(tapDog(data, owned, "nugget", emptyLoadout)).toEqual({
      kind: "buy",
      purchase: { dog: "nugget", kind: "dog" },
    });
  });
});

describe("packCapacity", () => {
  it("holds one dog per slot, and no more than a pack can, however many slots", () => {
    expect(packCapacity(data, { dogSlots: 1 })).toBe(1);
    expect(packCapacity(data, { dogSlots: 9 })).toBe(3);
  });
});

describe("tapGear", () => {
  it("equips owned gear, and unequips it on a second tap", () => {
    const on = loadoutOf(tapGear(owned, "fannyPack", emptyLoadout));
    expect(on?.gear).toBe("fannyPack");
    expect(loadoutOf(tapGear(owned, "fannyPack", on ?? emptyLoadout))?.gear).toBeNull();
  });

  it("asks to buy gear not owned yet", () => {
    expect(tapGear(owned, "whistle", emptyLoadout)).toEqual({
      kind: "buy",
      purchase: { gear: "whistle", kind: "gear" },
    });
  });
});

describe("purchasePrice", () => {
  it("prices a locked dog, gear and the next dog slot from the tuning", () => {
    expect(purchasePrice(data, owned, { dog: "nugget", kind: "dog" })).toBe(dollars(600));
    expect(purchasePrice(data, owned, { gear: "whistle", kind: "gear" })).toBe(dollars(600));
    expect(purchasePrice(data, { ...owned, dogSlots: 1 }, { kind: "dogSlot" })).toBe(dollars(800));
    expect(purchasePrice(data, { ...owned, dogSlots: 2 }, { kind: "dogSlot" })).toBe(dollars(1800));
  });

  it("sells nothing already owned, and no slot past the last", () => {
    expect(purchasePrice(data, owned, { dog: "koda", kind: "dog" })).toBeNull();
    expect(purchasePrice(data, owned, { gear: "fannyPack", kind: "gear" })).toBeNull();
    expect(purchasePrice(data, owned, { kind: "dogSlot" })).toBeNull();
  });
});

describe("buy", () => {
  const rich = { ...newPlayerSave, bankCents: dollars(2_000) };

  it("takes the price from the bank and adds a dog", () => {
    const result = buy(data, { dog: "nugget", kind: "dog" }, rich);
    expect(result.kind).toBe("bought");
    if (result.kind === "bought") {
      expect(result.save.bankCents).toBe(dollars(1_400));
      expect(result.save.owned.dogs).toEqual(["biscuit", "duchess", "koda", "nugget"]);
    }
  });

  it("adds gear and dog slots", () => {
    const gear = buy(data, { gear: "whistle", kind: "gear" }, rich);
    expect(gear.kind === "bought" && gear.save.owned.gear).toEqual(["whistle"]);
    const slot = buy(data, { kind: "dogSlot" }, rich);
    expect(slot.kind === "bought" && slot.save.owned.dogSlots).toBe(2);
    expect(slot.kind === "bought" && slot.save.bankCents).toBe(dollars(1_200));
  });

  it("refuses what the bank cannot cover, and what is not for sale", () => {
    expect(buy(data, { kind: "dogSlot" }, newPlayerSave)).toEqual({
      kind: "refused",
      reason: "cantAfford",
    });
    expect(buy(data, { dog: "koda", kind: "dog" }, rich)).toEqual({
      kind: "refused",
      reason: "notForSale",
    });
  });

  it("buys with exactly the price in the bank", () => {
    const exact = { ...newPlayerSave, bankCents: dollars(800) };
    const result = buy(data, { kind: "dogSlot" }, exact);
    expect(result.kind === "bought" && result.save.bankCents).toBe(0);
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
    zonesFinished: 1,
  };

  it("names the zone the walk headed home from", () => {
    expect(lastWalkLine(data, walk)).toBe("+$64. Headed home from Bark Park.");
  });

  it("names the owner who fired you and where", () => {
    const fired = {
      ...walk,
      firings: [{ dog: "koda" as const, zone: 1 }],
      outcome: "noDogs" as const,
    };
    expect(lastWalkLine(data, fired)).toBe("+$64. Jesse fired you on Woof Way.");
  });

  it("says a finished walk walked the whole world", () => {
    expect(lastWalkLine(data, { ...walk, outcome: "finished", zonesFinished: 4 })).toBe(
      "+$64. Walked all of Maple Street.",
    );
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
  it("breaks between words, keeping each line within the width", () => {
    expect(wrapWords(12, "He already did 10K. He's fine.")).toEqual([
      "He already",
      "did 10K.",
      "He's fine.",
    ]);
  });

  it("gives a word longer than the width a line of its own", () => {
    expect(wrapWords(4, "a supercalifragilistic b")).toEqual(["a", "supercalifragilistic", "b"]);
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

describe("dogInfo", () => {
  it("describes an owned dog in words, with its fee", () => {
    expect(dogInfo(data, owned, cents(0), "koda")).toMatch(
      /^Koda: big chaser, \$\d+ a zone\. Jesse is laid-back\.$/,
    );
  });

  it("adds the price of a locked dog, and how much more the bank needs", () => {
    expect(dogInfo(data, owned, dollars(100), "nugget")).toMatch(/\$600: need \$500 more\.$/);
    expect(dogInfo(data, owned, dollars(600), "nugget")).toMatch(/\$600: tap to buy\.$/);
  });
});

describe("gearInfo", () => {
  it("says what gear does, with the price while locked", () => {
    expect(gearInfo(data, owned, cents(0), "fannyPack")).toMatch(/^Fanny pack: .+\.$/);
    expect(gearInfo(data, owned, cents(0), "whistle")).toMatch(/\$600: need \$600 more\.$/);
  });
});
