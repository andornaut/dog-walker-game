import { describe, expect, it } from "vitest";

import { DOGS } from "../data/dogs";
import { QUIPS } from "../data/quips";
import { SHOP_GEAR } from "../data/shop";
import { WORLD } from "../data/world";
import { cents } from "../rules/units";
import { newRun, type RunState } from "../state/runState";
import { defined } from "../testing/defined";
import { TEST_TUNING } from "../testing/tuning";
import {
  dogSlotPrice,
  emptyLoadout,
  type HomeProfile,
  type HomeTap,
  lastWalkLine,
  nextDogSlot,
  packCapacity,
  packFeePerZone,
  packOf,
  partingSpeech,
  recordWalk,
  tapDog,
  tapGear,
  walkResult,
  wrapWords,
} from "./home";
import { sampleProfile } from "./sampleProfile";

const data = {
  defaultWalker: "casey",
  dogs: DOGS,
  quips: QUIPS,
  shopGear: SHOP_GEAR,
  tuning: TEST_TUNING,
  world: WORLD,
} as const;
const profile: HomeProfile = {
  ...sampleProfile(data),
  logbook: null,
  ownedGear: ["fannyPack"],
};
const loadoutOf = (tap: HomeTap) => (tap.kind === "loadout" ? tap.loadout : undefined);

describe("sampleProfile", () => {
  it("owns exactly the starter dogs and no gear", () => {
    const sample = sampleProfile(data);
    expect([...sample.ownedDogs].sort()).toEqual(["biscuit", "duchess", "koda"]);
    expect(sample.ownedGear).toEqual([]);
  });
});

describe("tapDog", () => {
  it("adds an owned dog to the pack, in the order picked", () => {
    const one = loadoutOf(tapDog(data, profile, "koda", emptyLoadout));
    expect(loadoutOf(tapDog(data, profile, "duchess", one ?? emptyLoadout))?.dogs).toEqual([
      "koda",
      "duchess",
    ]);
  });

  it("takes a picked dog back out of the pack", () => {
    const loadout = { dogs: ["koda", "duchess"] as const, gear: null };
    expect(loadoutOf(tapDog(data, profile, "koda", loadout))?.dogs).toEqual(["duchess"]);
  });

  it("adds no dog past the most a pack holds", () => {
    const owner = { ...profile, ownedDogs: [...profile.ownedDogs, "nugget" as const] };
    const full = { dogs: ["koda", "duchess", "biscuit"] as const, gear: null };
    expect(loadoutOf(tapDog(data, owner, "nugget", full))).toEqual(full);
  });

  it("asks to buy a dog not owned yet, without touching the pack", () => {
    expect(tapDog(data, profile, "nugget", emptyLoadout)).toEqual({
      kind: "buy",
      purchase: { dog: "nugget", kind: "dog" },
    });
  });
});

describe("dog slots", () => {
  const oneSlot = { ...profile, dogSlots: 1 };

  it("fill up with one dog per slot", () => {
    const full = { dogs: ["koda"] as const, gear: null };
    expect(loadoutOf(tapDog(data, oneSlot, "duchess", full))).toEqual(full);
    expect(loadoutOf(tapDog(data, { ...oneSlot, dogSlots: 2 }, "duchess", full))?.dogs).toEqual([
      "koda",
      "duchess",
    ]);
  });

  it("hold no more dogs than a pack can, however many slots are owned", () => {
    expect(packCapacity(data, { ...profile, dogSlots: 9 })).toBe(3);
  });

  it("sell the next slot until the pack holds the most it can", () => {
    expect(nextDogSlot(data, oneSlot)).toBe(2);
    expect(nextDogSlot(data, { ...profile, dogSlots: 3 })).toBeUndefined();
  });

  it("price the second and third slots", () => {
    expect(dogSlotPrice(data, 2)).toBeGreaterThan(0);
    expect(dogSlotPrice(data, 3)).toBeGreaterThan(dogSlotPrice(data, 2) ?? 0);
    expect(dogSlotPrice(data, 4)).toBeUndefined();
  });
});

describe("tapGear", () => {
  it("equips owned gear, and unequips it on a second tap", () => {
    const on = loadoutOf(tapGear(profile, "fannyPack", emptyLoadout));
    expect(on?.gear).toBe("fannyPack");
    expect(loadoutOf(tapGear(profile, "fannyPack", on ?? emptyLoadout))?.gear).toBeNull();
  });

  it("asks to buy gear not owned yet", () => {
    expect(tapGear(profile, "whistle", emptyLoadout)).toEqual({
      kind: "buy",
      purchase: { gear: "whistle", kind: "gear" },
    });
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

describe("walkResult", () => {
  it("counts every zone for a finished walk and only those passed when heading home", () => {
    const run = newRun(data, 3, { dogs: ["koda"], gear: null });
    const finished = { ...run, phase: { kind: "ended", reason: "finished" } as const };
    expect(walkResult(data, finished).zonesFinished).toBe(4);
    const home = { ...run, phase: { kind: "ended", reason: "wentHome" } as const, zoneIndex: 2 };
    expect(walkResult(data, home).zonesFinished).toBe(2);
  });

  it("lists the owners who fired you", () => {
    const run = newRun(data, 3, { dogs: ["koda", "duchess"], gear: null });
    const fired: RunState = {
      ...run,
      pack: [defined(run.pack[0]), { dog: "duchess", status: "fired", zoneIndex: 1 }],
    };
    expect(walkResult(data, fired).firings).toEqual([{ dog: "duchess", zoneIndex: 1 }]);
  });
});

describe("lastWalkLine", () => {
  const result = {
    dogs: ["koda" as const],
    earned: cents(6_400),
    firings: [],
    reason: "wentHome" as const,
    zonesFinished: 1,
  };

  it("names the zone the walk headed home from", () => {
    expect(lastWalkLine(data, result)).toBe("+$64. Headed home from Bark Park.");
  });

  it("names the owner who fired you and where", () => {
    const fired = { ...result, firings: [{ dog: "koda" as const, zoneIndex: 0 }] };
    expect(lastWalkLine(data, fired)).toBe("+$64. Jesse fired you on Woof Way.");
  });
});

describe("recordWalk", () => {
  const result = {
    dogs: ["koda" as const, "duchess" as const],
    earned: cents(5_000),
    firings: [{ dog: "duchess" as const, zoneIndex: 2 }],
    reason: "finished" as const,
    zonesFinished: 4,
  };

  it("banks the earnings and starts the logbook on the first walk", () => {
    const after = recordWalk(data, result, profile);
    expect(after.bank).toBe(profile.bank + 5_000);
    expect(after.logbook).toMatchObject({
      bestWalk: 5_000,
      bestWalkZones: 4,
      dogsWalked: 2,
      timesFired: 1,
      walks: 1,
    });
  });

  it("keeps an earlier best walk that was worth more", () => {
    const once = recordWalk(data, result, profile);
    const twice = recordWalk(data, { ...result, earned: cents(1_000) }, once);
    expect(twice.logbook?.bestWalk).toBe(5_000);
    expect(twice.logbook?.walks).toBe(2);
    expect(twice.logbook?.lastWalk).toMatch(/^\+\$10\./);
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
    expect(partingSpeech(data, () => 0, 40, "koda")).toEqual(["Jesse:", QUIPS.koda.parting[0]]);
    expect(partingSpeech(data, () => 0.99, 40, "koda")).toEqual(["Jesse:", QUIPS.koda.parting[1]]);
  });
});
