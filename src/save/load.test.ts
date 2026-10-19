import * as v from "valibot";
import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { defined } from "../testing/defined";
import { knownOutsideData, newPlayerSave, testContext, veteranSave } from "./fixtures";
import { loadSave, saveContextFrom } from "./load";
import { type SaveDocument, saveSchema } from "./schema";

const stored = (document: unknown) => JSON.stringify(document);

// The document as JSON holds it: ids are any string, so a test can store unknown ones.
type StoredInput = v.InferInput<typeof saveSchema>;

// For changes that break the stored shape on purpose.
const untyped = (document: StoredInput) => document as unknown as Record<string, unknown>;

function withChanges(change: (document: StoredInput) => void): string {
  const document: StoredInput = veteranSave();
  change(document);
  return stored(document);
}

const loaded = (change: (document: StoredInput) => void): SaveDocument =>
  loadSave(testContext, withChanges(change)).save;

describe("loadSave", () => {
  it("gives a new player the free dogs and walker, and nothing else", () => {
    expect(loadSave(testContext, null)).toEqual({ save: newPlayerSave, status: "new" });
  });

  it("loads a valid save unchanged", () => {
    expect(loadSave(testContext, stored(veteranSave()))).toEqual({
      save: veteranSave(),
      status: "loaded",
    });
  });

  it("loads a pending checkpoint", () => {
    const checkpoint = {
      dogs: [{ fired: false, id: "koda", zonesFinished: 2 }],
      earnedCents: 4_250,
      zoneReached: 2,
    };
    const save = loaded((document) => {
      document.checkpoint = checkpoint;
    });
    expect(save.checkpoint).toEqual(checkpoint);
  });

  it("strips fields the schema does not know", () => {
    const save = loaded((document) => {
      untyped(document).extra = true;
      untyped(document).settings = { volume: 3 };
    });
    expect(save).toEqual(veteranSave());
  });

  describe("a save it cannot use", () => {
    const corruptCases: [string, string][] = [
      ["text that is not JSON", "{not json"],
      ["an empty string", ""],
      ["JSON null", "null"],
      ["an array", "[]"],
      [
        "a missing field",
        withChanges((document) => {
          delete untyped(document).owned;
        }),
      ],
      [
        "a field of the wrong type",
        withChanges((document) => {
          untyped(document).bankCents = "12345";
        }),
      ],
      [
        "negative cents in the bank",
        withChanges((document) => {
          document.bankCents = -1;
        }),
      ],
      [
        "fractional cents in the bank",
        withChanges((document) => {
          document.bankCents = 10.5;
        }),
      ],
      [
        "negative lifetime earnings",
        withChanges((document) => {
          document.stats.lifetimeCents = -100;
        }),
      ],
      [
        "fractional checkpoint earnings",
        withChanges((document) => {
          document.checkpoint = { dogs: [], earnedCents: 2.5, zoneReached: 1 };
        }),
      ],
      [
        "a fractional stat count",
        withChanges((document) => {
          defined(document.stats.dogs.koda).walks = 1.5;
        }),
      ],
      [
        "an empty loadout",
        withChanges((document) => {
          document.lastLoadout.dogs = [];
        }),
      ],
      [
        "a loadout of four dogs",
        withChanges((document) => {
          document.lastLoadout.dogs = ["koda", "biscuit", "duchess", "waffles"];
        }),
      ],
      [
        "fractional dog slots",
        withChanges((document) => {
          document.owned.dogSlots = 1.5;
        }),
      ],
      [
        "a version from a later game",
        withChanges((document) => {
          untyped(document).version = 2;
        }),
      ],
      [
        "a version with no migration",
        withChanges((document) => {
          untyped(document).version = 0;
        }),
      ],
      [
        "no version",
        withChanges((document) => {
          delete untyped(document).version;
        }),
      ],
    ];

    it.each(corruptCases)("returns a default save and the raw text for %s", (_, raw) => {
      expect(loadSave(testContext, raw)).toEqual({
        raw,
        reason: expect.any(String),
        save: newPlayerSave,
        status: "corrupt",
      });
    });

    it("says why a later version was rejected", () => {
      const raw = withChanges((document) => {
        untyped(document).version = 2;
      });
      const result = loadSave(testContext, raw);
      expect(result.status === "corrupt" && result.reason).toMatch(/newer than this game/);
    });
  });

  describe("unknown ids", () => {
    it("drops them from everything owned, and removes duplicates", () => {
      const save = loaded((document) => {
        document.owned = {
          dogSlots: 2,
          dogs: ["koda", "ghost", "waffles", "koda"],
          gear: ["whistle", "jetpack"],
          walkerKit: ["firmGrip", "rocketBoots", "firmGrip"],
          walkers: ["jordan", "retiredWalker"],
        };
      });
      expect(save.owned).toEqual({
        dogSlots: 2,
        dogs: ["biscuit", "duchess", "koda", "waffles"],
        gear: ["whistle"],
        walkerKit: ["firmGrip"],
        walkers: ["casey", "jordan"],
      });
    });

    it("keeps the free dogs and walker owned", () => {
      const save = loaded((document) => {
        document.owned.dogs = ["waffles"];
        document.owned.walkers = ["jordan"];
      });
      expect(save.owned.dogs).toEqual(["biscuit", "duchess", "koda", "waffles"]);
      expect(save.owned.walkers).toEqual(["casey", "jordan"]);
    });

    it("drops them from the loadout, along with picks the player does not own", () => {
      const save = loaded((document) => {
        // dash is a known dog that this player has not bought.
        document.lastLoadout = { dogs: ["ghost", "waffles", "dash"], gear: "luckyCollar" };
      });
      expect(save.lastLoadout).toEqual({ dogs: ["waffles"], gear: null });
    });

    it.each([
      [-2, 1],
      [0, 1],
      [4, 3],
      [3, 3],
    ])("clamps %i dog slots to %i", (stored, clamped) => {
      const save = loaded((document) => {
        document.owned.dogSlots = stored;
      });
      expect(save.owned.dogSlots).toBe(clamped);
    });

    it("trims the loadout to the clamped slots", () => {
      const save = loaded((document) => {
        document.owned.dogSlots = 0;
        document.lastLoadout.dogs = ["waffles", "koda"];
      });
      expect(save.lastLoadout.dogs).toEqual(["waffles"]);
    });

    it("keeps no more loadout dogs than the player has slots", () => {
      const save = loaded((document) => {
        document.lastLoadout.dogs = ["waffles", "koda", "biscuit"];
      });
      expect(save.lastLoadout.dogs).toEqual(["waffles", "koda"]);
    });

    it("keeps owned loadout gear", () => {
      expect(loaded(() => {}).lastLoadout.gear).toBe("whistle");
    });

    it("falls back to the default loadout when no loadout dog is left", () => {
      const save = loaded((document) => {
        document.lastLoadout = { dogs: ["ghost"], gear: "whistle" };
      });
      expect(save.lastLoadout).toEqual({ dogs: ["biscuit"], gear: null });
    });

    it("keeps an owned walker in use", () => {
      expect(loaded(() => {}).walker).toBe("jordan");
    });

    it.each([
      ["an unknown walker", "retiredWalker"],
      ["a walker the player has not bought", "robin"],
    ])("swaps %s for the free walker", (_, walker) => {
      const save = loaded((document) => {
        document.walker = walker;
      });
      expect(save.walker).toBe("casey");
    });

    it("drops stats for unknown dogs and keeps the total firings", () => {
      const save = loaded((document) => {
        document.stats.dogs.ghost = { timesFired: 2, walks: 3, zonesFinished: 4 };
        document.stats.timesFired = 3;
      });
      expect(Object.keys(save.stats.dogs).sort()).toEqual(["biscuit", "koda"]);
      expect(save.stats.timesFired).toBe(3);
    });

    it("drops them from a checkpoint and keeps its earnings", () => {
      const save = loaded((document) => {
        document.checkpoint = {
          dogs: [
            { fired: true, id: "ghost", zonesFinished: 1 },
            { fired: false, id: "koda", zonesFinished: 2 },
          ],
          earnedCents: 900,
          zoneReached: 2,
        };
      });
      expect(save.checkpoint).toEqual({
        dogs: [{ fired: false, id: "koda", zonesFinished: 2 }],
        earnedCents: 900,
        zoneReached: 2,
      });
    });

    it("drops unknown dogs and courses from training", () => {
      const save = loaded((document) => {
        document.training = { ghost: ["heel"], koda: ["heel", "agility", "heel"] };
      });
      expect(save.training).toEqual({ koda: ["heel"] });
    });

    it("drops unknown help topics", () => {
      const save = loaded((document) => {
        document.helpSeen = ["lanes", "retiredTopic"];
      });
      expect(save.helpSeen).toEqual(["lanes"]);
    });

    it("drops unknown accessories, and unequips one the dog does not own", () => {
      const save = loaded((document) => {
        document.cosmetics.accessories = {
          equipped: { ghost: "bandana", koda: "tophat", waffles: "raincoat" },
          owned: { ghost: ["bandana"], koda: ["bandana", "tophat"], waffles: ["bowTie"] },
        };
      });
      expect(save.cosmetics.accessories).toEqual({
        equipped: {},
        owned: { koda: ["bandana"], waffles: ["bowTie"] },
      });
    });

    it("keeps an owned, equipped accessory", () => {
      expect(loaded(() => {}).cosmetics.accessories.equipped).toEqual({ koda: "bandana" });
    });

    it("drops unknown leash colours, and unequips one the player does not own", () => {
      const save = loaded((document) => {
        document.cosmetics.leashColors = { equipped: "gold", owned: ["red", "neon"] };
      });
      expect(save.cosmetics.leashColors).toEqual({ equipped: null, owned: ["red"] });
    });

    it("keeps an owned, equipped leash colour", () => {
      expect(loaded(() => {}).cosmetics.leashColors.equipped).toBe("teal");
    });

    it("drops unknown decor, and removes placed decor the player does not own", () => {
      const save = loaded((document) => {
        document.cosmetics.decor = { owned: ["rug", "fountain"], placed: ["rug", "plant"] };
      });
      expect(save.cosmetics.decor).toEqual({ owned: ["rug"], placed: ["rug"] });
    });
  });
});

describe("saveContextFrom", () => {
  const context = saveContextFrom(gameData, knownOutsideData);

  it("knows every dog, gear item and walker in the game data", () => {
    expect([...context.known.dogs]).toEqual(Object.keys(gameData.dogs));
    expect([...context.known.gear]).toEqual(Object.keys(gameData.shopGear));
    expect([...context.known.walkers]).toEqual(Object.keys(gameData.walkers));
    expect(context.known.walkerKit).toBe(knownOutsideData.walkerKit);
  });

  it("starts a new player with one dog slot and the starter dogs, walking the first", () => {
    expect(context.defaults.dogSlots).toBe(1);
    expect(context.defaults.freeDogs).toEqual(["biscuit", "duchess", "koda"]);
    expect(context.defaults.lastLoadout).toEqual({ dogs: ["biscuit"], gear: null });
  });

  it("frees only walkers marked start, and uses the first of them", () => {
    const walkers = {
      ...gameData.walkers,
      casey: { ...gameData.walkers.casey, unlock: "shop" as const },
      robin: { ...gameData.walkers.robin, unlock: "shop" as const },
    };
    const { defaults } = saveContextFrom({ ...gameData, walkers }, knownOutsideData);
    expect(defaults.freeWalkers).toEqual(["jordan", "morgan"]);
    expect(defaults.walker).toBe("jordan");
  });
});
